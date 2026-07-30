# BUILD.md — Setup & Deployment Guide

## Prerequisites

- Node.js 18 or later
- npm (comes with Node.js)
- (Optional) A Philips Hue Bridge on the same local network, with your 8-bulb GDR satellite lamp added as two 4-light groups/rings
- (Optional) [osc2hue](https://github.com/ilesinge/osc2hue) running locally if you want real hardware control

## 1. Clone / Create the Project

```bash
mkdir octoorgler && cd octoorgler
npm init -y
```

## 2. Install Dependencies

```bash
npm install express socket.io osc nanoid
```

## 3. Directory Setup

Create the following folders if they don't exist yet:

```bash
mkdir -p config data game public/admin
```

Place `settings.json` inside `config/`. An empty `highscores.json` (`{}`) will be auto-created in `data/` on first run if missing.

## 4. Configure Hue / OSC Bridge (Optional)

If you want to control the real lamp:

1. Download and run `osc2hue` for your OS (see its README for the exact binary).
2. Press the physical link button on your Hue Bridge when prompted during first-run pairing.
3. Confirm `osc2hue` is listening (default port `8080`).
4. In `config/settings.json`, set `hue.oscHost` to the machine running osc2hue (use `127.0.0.1` if it's the same machine as the game server) and `hue.oscPort` to match.
5. Run `openhue get light --json` (via the OpenHue CLI) once to find the actual light IDs for your 8 bulbs, and set `hue.bulbLightIds` in order matching your lamp's physical ring layout (outer ring first, then inner ring).

If no Hue Bridge is reachable, skip this section entirely — the game auto-detects this at startup and switches every client into browser fallback mode.

## 5. Environment Variables (Optional Overrides)

```bash
export HUE_OSC_HOST=127.0.0.1
export PORT=3000
```

These override values baked into `settings.json` at runtime if set.

## 6. Run the Server

```bash
npm start
```

Or directly:

```bash
node server.js
```

You should see:

```
OctoOrgler running on :3000
```

## 7. Connect Players

- On each player's phone (same Wi-Fi/LAN as the server), open `http://<server-ip>:3000`
- Enter a name to join the lobby (2-4 players, or start alone for single-player mode)
- One device (a laptop/tablet/TV) can optionally open `http://<server-ip>:3000/lamp.html` to display the split-screen fallback lamp visualization for spectators

## 8. Open the Admin Dashboard

Visit `http://<server-ip>:3000/admin` from any browser on the network to view and adjust all settings live. Changes save immediately to `config/settings.json` but only take effect starting the next round — a banner in the dashboard confirms when pending vs. committed.

## 9. Production Notes

- Run behind a process manager (e.g. `pm2 start server.js`) for persistent uptime.
- If exposing beyond your LAN, put the server behind a reverse proxy (e.g. nginx) with TLS — Socket.IO and OSC traffic should stay on the local network only; do not expose the OSC bridge port publicly.
- Back up `data/highscores.json` periodically if you care about long-term score history.

## 10. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Lamp never lights up | osc2hue not running or wrong host/port | Verify osc2hue is running and `hue.oscHost`/`hue.oscPort` match |
| Game always falls back to browser mode | Hue Bridge unreachable within timeout | Increase `hue.reachabilityTimeoutMs` in settings, check bridge is powered and on same subnet |
| Players can't join from phones | Server bound to localhost only, or firewall blocking port 3000 | Ensure server listens on `0.0.0.0` and allow port 3000 through firewall |
| Colors look wrong on physical lamp | XY color conversion mismatch or wrong `bulbLightIds` order | Re-run `openhue get light --json` and re-map IDs to correct ring order |
| Settings changes not applying | Working as intended — changes are staged | Wait for current round to end; dashboard shows "pending" vs "committed" status |
