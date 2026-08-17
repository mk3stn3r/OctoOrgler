class ObstacleEngine {
  constructor(hueBridge, settings) {
    this.hue = hueBridge;
    this.settings = settings;
    this.activeObstacles = new Map();
  }

  obstacleChance(round, mode, modeSettings) {
    const base = modeSettings.obstacleBaseChance;
    const growth = this.settings.obstacles.obstacleChanceGrowthPerRound;
    const cap = this.settings.obstacles.obstacleChanceCap;
    return Math.min(cap, base + round * growth);
  }

  maybeSpawnObstacle(bulbIndex, playerColor, round, modeName, modeSettings, colorPalette, onFlip) {
    if (Math.random() > this.obstacleChance(round, modeName, modeSettings)) return false;
    const type = ['trick', 'blinker', 'decoy'][Math.floor(Math.random() * 3)];
    const obs = this.settings.obstacles;

    if (type === 'trick') {
      onFlip(bulbIndex, playerColor);
      setTimeout(() => {
        const trick = colorPalette.find(c => c !== playerColor) || colorPalette[0];
        onFlip(bulbIndex, trick);
      }, obs.trickLightFlashMs);
    } else if (type === 'blinker') {
      let ticks = 0;
      const strobe = setInterval(() => {
        const c = colorPalette[ticks % colorPalette.length];
        onFlip(bulbIndex, c);
        ticks++;
        if (ticks > obs.blinkerFlips) { clearInterval(strobe); this.activeObstacles.delete(bulbIndex); }
      }, obs.blinkerIntervalMs);
      this.activeObstacles.set(bulbIndex, strobe);
    } else if (type === 'decoy') {
      const decoyColor = this.nearColor(playerColor, obs.decoyColorShiftRange);
      onFlip(bulbIndex, decoyColor);
    }

    return true;
  }

  nearColor(hex, shiftRange) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    const shift = () => Math.round((Math.random() - 0.5) * shiftRange);
    r = Math.max(0, Math.min(255, r + shift()));
    g = Math.max(0, Math.min(255, g + shift()));
    b = Math.max(0, Math.min(255, b + shift()));
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }

  clearAll() {
    this.activeObstacles.forEach(id => clearInterval(id));
    this.activeObstacles.clear();
  }
}

module.exports = ObstacleEngine;
