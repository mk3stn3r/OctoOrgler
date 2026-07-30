const { assignBulbs, TOTAL_BULBS } = require('./BulbAssigner');
const ObstacleEngine = require('./ObstacleEngine');
const HighScoreStore = require('./HighScoreStore');
const settingsManager = require('./SettingsManager');

class GameEngine {
  constructor(io, hueBridge) {
    this.io = io;
    this.hue = hueBridge;
    this.players = new Map();
    this.round = 0;
    this.settings = settingsManager.getLive();
    this.modeName = 'novice';
    this.mode = this.settings.difficultyModes[this.modeName];
    this.roundLengthMs = this.settings.server.roundLengthMs;
    this.speedMultiplier = this.settings.gameplay.speedMultiplier;
    this.bulbState = Array(TOTAL_BULBS).fill(null);
    this.bulbChangedAt = Array(TOTAL_BULBS).fill(0);
    this.assignment = {};
    this.running = false;
    this.currentGraceMs = this.mode.graceMs;
    this.obstacles = new ObstacleEngine(hueBridge, this.settings);
    this.isSinglePlayer = false;
    this.missTimers = {};
    this.reassignCounts = {};
  }

  applySettings(settings) {
    this.settings = settings;
    this.mode = settings.difficultyModes[this.modeName];
    this.roundLengthMs = settings.server.roundLengthMs;
    this.speedMultiplier = settings.gameplay.speedMultiplier;
    this.obstacles.settings = settings;
  }

  setMode(modeName) {
    if (!this.settings.difficultyModes[modeName]) return;
    this.modeName = modeName;
    this.mode = this.settings.difficultyModes[modeName];
    this.currentGraceMs = this.mode.graceMs;
    this.io.emit('modeChanged', { mode: modeName, ...this.mode });
  }

  setGraceOverride(ms) {
    this.currentGraceMs = ms;
    this.io.emit('graceChanged', { graceMs: ms });
  }

  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
  }

  addPlayer(id, name, socketId) {
    const palette = this.settings.gameplay.colorPalette;
    const usedColors = [...this.players.values()].map(p => p.color);
    const color = palette.find(c => !usedColors.includes(c)) || palette[this.players.size % palette.length];
    this.players.set(id, { name, color, socketId, score: 0 });
    return color;
  }

  async start() {
    const reachable = await this.hue.checkReachable();
    this.io.emit('lampMode', reachable ? 'physical' : 'browser-fallback');
    this.io.emit('modeChanged', { mode: this.modeName, ...this.mode });
    this.running = true;
    this.loopRound();
  }

  pickColorForBulb(playerColors) {
    const { colorCount, colorDisplayProbability } = this.mode;
    const palette = this.settings.gameplay.colorPalette.slice(0, colorCount);
    const activeSet = new Set(palette);
    playerColors.forEach(c => activeSet.add(c));
    const workingPalette = [...activeSet];

    const showTargetColor = Math.random() < colorDisplayProbability;
    if (showTargetColor && playerColors.length) {
      return playerColors[Math.floor(Math.random() * playerColors.length)];
    }
    const nonTarget = workingPalette.filter(c => !playerColors.includes(c));
    return nonTarget[Math.floor(Math.random() * nonTarget.length)] || workingPalette[0];
  }

  loopRound() {
    if (!this.running) return;

    const settings = settingsManager.commitPending();
    this.applySettings(settings);

    this.reassignCounts = {};
    this.round += 1;
    const playerIds = [...this.players.keys()];
    this.isSinglePlayer = playerIds.length === 1;
    this.assignment = assignBulbs(playerIds, this.round, this.mode);

    if (this.isSinglePlayer) {
      const pid = playerIds[0];
      const best = HighScoreStore.getBest(this.players.get(pid).name, this.modeName);
      this.io.to(this.players.get(pid).socketId).emit('highScoreTarget', { best });
    }

    playerIds.forEach(pid => {
      const p = this.players.get(pid);
      this.io.to(p.socketId).emit('assignment', {
        round: this.round,
        bulbs: this.assignment[pid],
        color: p.color,
      });
    });

    playerIds.forEach(pid => {
      const p = this.players.get(pid);
      this.assignment[pid].forEach(b => this.flipBulb(b, p.color));
    });
    this.io.emit('bulbState', this.bulbState);

    const interval = Math.max(250, this.mode.baseIntervalMs / (this.speedMultiplier * Math.sqrt(this.round)));
    this.currentGraceMs = Math.max(80, this.mode.graceMs * Math.pow(this.mode.graceDecay, this.round - 1));

    const flipTimer = setInterval(() => {
      const bulb = Math.floor(Math.random() * TOTAL_BULBS);
      const assignedPlayerId = Object.keys(this.assignment).find(pid => this.assignment[pid].includes(bulb));
      const playerColors = assignedPlayerId ? [this.players.get(assignedPlayerId).color] : [];

      if (this.isSinglePlayer && this.settings.obstacles.enabledSinglePlayer) {
        const pid = playerIds[0];
        const player = this.players.get(pid);
        const spawned = this.obstacles.maybeSpawnObstacle(
          bulb, player.color, this.round, this.modeName, this.mode,
          this.settings.gameplay.colorPalette,
          (b, c) => { this.flipBulb(b, c); this.io.emit('bulbUpdate', { bulb: b, color: c }); }
        );
        if (spawned) return;
      }

      const color = this.pickColorForBulb(playerColors);
      this.flipBulb(bulb, color);
      this.io.emit('bulbUpdate', { bulb, color });
    }, interval);

    this.io.emit('roundStart', {
      round: this.round,
      lengthMs: this.roundLengthMs,
      interval,
      graceMs: this.currentGraceMs,
      mode: this.modeName,
      singlePlayer: this.isSinglePlayer,
    });

    setTimeout(() => {
      clearInterval(flipTimer);
      this.obstacles.clearAll();
      this.io.emit('roundEnd', this.scoreboard());

      if (this.isSinglePlayer) {
        const pid = playerIds[0];
        const player = this.players.get(pid);
        const result = HighScoreStore.saveScore(player.name, this.modeName, player.score);
        this.io.to(player.socketId).emit('highScoreResult', result);
      }

      setTimeout(() => this.loopRound(), this.settings.server.intermissionMs);
    }, this.roundLengthMs);
  }

  flipBulb(bulbIndex, color) {
    this.bulbState[bulbIndex] = color;
    this.bulbChangedAt[bulbIndex] = Date.now();
    this.hue.setBulbColor(bulbIndex, color, 300);

    if (this.missTimers[bulbIndex]) clearTimeout(this.missTimers[bulbIndex]);
    if (this.isSinglePlayer) this.scheduleMissCheck(bulbIndex, color);
  }

  scheduleMissCheck(bulbIndex, colorAtFlip) {
    const playerId = [...this.players.keys()][0];
    if (!playerId) return;
    const player = this.players.get(playerId);
    const assigned = this.assignment[playerId] || [];
    if (!assigned.includes(bulbIndex) || colorAtFlip !== player.color) return;

    this.missTimers[bulbIndex] = setTimeout(() => {
      if (this.bulbState[bulbIndex] === colorAtFlip) {
        const penalty = this.settings.gameplay.missPenaltyPoints;
        const floor = this.settings.gameplay.scoreFloorZero;
        player.score = floor ? Math.max(0, player.score - penalty) : player.score - penalty;
        this.io.to(player.socketId).emit('missPenalty', { bulbIndex, newScore: player.score, penalty });
        this.io.emit('scoreboardUpdate', this.scoreboard());
      }
    }, this.currentGraceMs);
  }

  requestReassign(playerId, bulbIndex) {
    const player = this.players.get(playerId);
    if (!player) return;
    const assigned = this.assignment[playerId] || [];
    if (!assigned.includes(bulbIndex)) return;

    this.reassignCounts[playerId] = this.reassignCounts[playerId] || 0;
    const maxReassigns = this.settings.gameplay.maxReassignsPerRound || 2;
    if (this.reassignCounts[playerId] >= maxReassigns) {
      this.io.to(player.socketId).emit('reassignDenied', { reason: 'limit_reached', max: maxReassigns });
      return;
    }

    const allAssignedBulbs = new Set(Object.values(this.assignment).flat());
    const candidates = [...Array(TOTAL_BULBS).keys()].filter(
      b => b !== bulbIndex && !allAssignedBulbs.has(b)
    );

    if (candidates.length === 0) {
      this.io.to(player.socketId).emit('reassignDenied', { reason: 'no_alternatives' });
      return;
    }

    const newBulb = candidates[Math.floor(Math.random() * candidates.length)];
    const idx = assigned.indexOf(bulbIndex);
    assigned[idx] = newBulb;
    this.reassignCounts[playerId]++;

    this.flipBulb(newBulb, player.color);

    this.io.to(player.socketId).emit('bulbReassigned', {
      oldBulb: bulbIndex,
      newBulb,
      remaining: maxReassigns - this.reassignCounts[playerId],
    });
    this.io.emit('bulbState', this.bulbState);
  }

  pickDifferentColor(excludeColor) {
    const options = this.settings.gameplay.colorPalette.filter(c => c !== excludeColor);
    return options[Math.floor(Math.random() * options.length)];
  }

  handlePress(playerId, bulbIndex) {
    const player = this.players.get(playerId);
    if (!player) return;
    const assigned = this.assignment[playerId] || [];
    if (!assigned.includes(bulbIndex)) return;

    const elapsed = Date.now() - this.bulbChangedAt[bulbIndex];
    const withinGrace = elapsed <= this.currentGraceMs;
    const colorMatches = this.bulbState[bulbIndex] === player.color;

    if (colorMatches && withinGrace) {
      if (this.missTimers[bulbIndex]) {
        clearTimeout(this.missTimers[bulbIndex]);
        delete this.missTimers[bulbIndex];
      }
      player.score += 1;
      const nextColor = this.pickColorForBulb([player.color]);
      this.flipBulb(bulbIndex, nextColor);
      this.io.emit('capture', { playerId, bulbIndex, newColor: nextColor, scoreboard: this.scoreboard() });
    } else if (colorMatches && !withinGrace) {
      this.io.to(player.socketId).emit('missedGrace', { bulbIndex, elapsed, graceMs: this.currentGraceMs });
    }
  }

  scoreboard() {
    return [...this.players.entries()].map(([id, p]) => ({ id, name: p.name, color: p.color, score: p.score }));
  }
}

module.exports = GameEngine;
