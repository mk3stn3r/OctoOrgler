const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const GameEngine = require('./game/GameEngine');
const HueOSCBridge = require('./game/HueOSCBridge');
const settingsManager = require('./game/SettingsManager');

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use('/admin', express.static('public/admin'));

const server = http.createServer(app);
const io = new Server(server);

const initialSettings = settingsManager.getLive();

const hueBridge = new HueOSCBridge({
  host: process.env.HUE_OSC_HOST || initialSettings.hue.oscHost,
  port: initialSettings.hue.oscPort,
  bulbLightIds: initialSettings.hue.bulbLightIds,
  timeoutMs: initialSettings.hue.reachabilityTimeoutMs,
});

const engine = new GameEngine(io, hueBridge);

settingsManager.on('updated', settings => {
  io.emit('settingsUpdated', settings);
});
settingsManager.on('pendingUpdated', pending => {
  io.emit('settingsPending', pending);
});
settingsManager.on('committed', live => {
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

const PORT = process.env.PORT || initialSettings.server.port || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`OctoOrgler running on :${PORT}`));
