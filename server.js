require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const GameEngine = require('./game/GameEngine');
const DeconzBridge = require('./game/DeconzBridge');
const settingsManager = require('./game/SettingsManager');
const createDeconzProxy = require('./game/DeconzProxy');
const createLampOrderRouter = require('./game/LampOrder');

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'loading.html'));
});
app.use('/admin', express.static('public/admin'));

const server = http.createServer(app);
const io = new Server(server);

const initialSettings = settingsManager.getLive();

const resolvedApiKey = process.env.DECONZ_API_KEY || initialSettings.deconz.apiKey;
if (!resolvedApiKey) {
  console.error('No deCONZ API key found. Set DECONZ_API_KEY in your .env file (see .env.example) or deconz.apiKey in config/settings.json.');
  process.exit(1);
}

const deconzBridge = new DeconzBridge({
  gatewayHost: process.env.DECONZ_HOST || initialSettings.deconz.gatewayHost,
  gatewayPort: process.env.DECONZ_PORT ? parseInt(process.env.DECONZ_PORT, 10) : initialSettings.deconz.gatewayPort,
  apiKey: resolvedApiKey,
  bulbLightIds: initialSettings.deconz.bulbLightIds,
  timeoutMs: initialSettings.deconz.reachabilityTimeoutMs,
});

deconzBridge.checkReachable().then(reachable => {
  console.log(`deCONZ gateway reachable: ${reachable}`);
});

const engine = new GameEngine(io, deconzBridge);

function lampControlLock() {
  return engine.running && engine.players.size > 0 ? 'A game is running. Lamp control is paused until the game ends.' : null;
}

// Lamp control panel (/control/) reaches deCONZ through this proxy, so the API key stays on the server.
// Writes are refused while a game round is running so the panel can't disturb play.
app.use('/api/lampctl', createDeconzProxy({
  getGateway: () => {
    const live = settingsManager.getLive().deconz || {};
    return {
      host: process.env.DECONZ_HOST || live.gatewayHost,
      port: process.env.DECONZ_PORT ? parseInt(process.env.DECONZ_PORT, 10) : live.gatewayPort,
      apiKey: process.env.DECONZ_API_KEY || live.apiKey,
    };
  },
  isLocked: lampControlLock,
}));

// Saved lamp order (set via Identify in the lamp view). Applied to the game bridge immediately.
app.use('/api/lamp-order', createLampOrderRouter({
  settings: settingsManager,
  isLocked: lampControlLock,
  onChange: order => {
    deconzBridge.bulbLightIds = order;
    io.emit('lampOrderUpdated', { order });
  },
}));

settingsManager.on('updated', settings => { io.emit('settingsUpdated', settings); });
settingsManager.on('pendingUpdated', pending => { io.emit('settingsPending', pending); });
settingsManager.on('committed', live => {
  if (live.deconz && Array.isArray(live.deconz.bulbLightIds)) deconzBridge.bulbLightIds = live.deconz.bulbLightIds;
  io.emit('settingsCommitted', live);
});

app.get('/api/settings', (req, res) => {
  res.json({
    live: settingsManager.getLive(),
    pending: settingsManager.getPending(),
    hasPendingChanges: settingsManager.hasPendingChanges(),
  });
});

app.patch('/api/settings/field', (req, res) => {
  const { path: fieldPath, value } = req.body;
  settingsManager.updatePending(fieldPath, value);
  res.json({ ok: true, pending: settingsManager.getPending() });
});

app.get('/api/deconz/status', async (req, res) => {
  const reachable = await deconzBridge.checkReachable();
  res.json({ reachable });
});

io.on('connection', socket => {
  socket.on('join', ({ name }) => {
    if (engine.players.size >= 4) return socket.emit('joinError', 'Room full');
    const color = engine.addPlayer(socket.id, name, socket.id);
    socket.emit('joined', { color, id: socket.id });
    io.emit('lobby', engine.scoreboard());
  });

  socket.on('setMode', ({ mode }) => engine.setMode(mode));
  socket.on('setGrace', ({ graceMs }) => engine.setGraceOverride(graceMs));
  socket.on('setSpeed', ({ speed }) => engine.setSpeed(speed));

  socket.on('startGame', ({ speed, mode }) => {
    if (mode) engine.setMode(mode);
    if (speed) engine.setSpeed(speed);
    engine.start();
  });

  socket.on('press', ({ bulbIndex }) => engine.handlePress(socket.id, bulbIndex));
  socket.on('requestReassign', ({ bulbIndex }) => engine.requestReassign(socket.id, bulbIndex));

  socket.on('disconnect', () => {
    engine.players.delete(socket.id);
    io.emit('lobby', engine.scoreboard());
  });
});

function resolvePort() {
  const cliArg = process.argv.find(a => a.startsWith('--port='));
  if (cliArg) return parseInt(cliArg.split('=')[1], 10);
  if (process.env.PORT) return parseInt(process.env.PORT, 10);
  return initialSettings.server.port || 3000;
}

function resolveHost() {
  if (process.env.HOST) return process.env.HOST;
  return initialSettings.server.host || '0.0.0.0';
}

const PORT = resolvePort();
const HOST = resolveHost();

server.listen(PORT, HOST, () => {
  console.log(`OctoOrgler running on ${HOST}:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});

process.on('SIGINT', async () => {
  await deconzBridge.allOff().catch(() => {});
  process.exit(0);
});

module.exports = { app, server, deconzBridge };
