# BUILD.md — Setup & Deployment Guide

## Prerequisites

- Node.js 18 or later
- npm (comes with Node.js)
- A deCONZ gateway (ConBee II/III or RaspBee) on the same local network, with your 8-bulb GDR satellite lamp's Zigbee bulbs paired

## 1. Clone / Create the Project

```bash
mkdir octoorgler && cd octoorgler
npm init -y
```

## 2. Install Dependencies

```bash
npm install express socket.io nanoid dotenv
npm install --save-dev jest supertest socket.io-client
```

## 3. Directory Setup

```bash
mkdir -p config data game public/admin public/assets
```

Place `settings.json` inside `config/`. An empty `highscores.json` (`{}`) will be auto-created in `data/` on first run if missing.

## 4. Configure the deCONZ Gateway

OctoOrgler talks directly to your deCONZ REST API over HTTP — no OSC bridge or third-party relay needed.

1. Find your gateway's IP address (check your router, or `GET https://phoscon.de/discover`).
2. Unlock the gateway for pairing: Phoscon → Settings → Gateway → Advanced → **Authenticate app**.
3. Acquire an API key:

```bash
curl -X POST http://<gateway-ip>:<port>/api -d '{"devicetype":"octoorgler"}'
```

4. Confirm it works:

```bash
curl http://<gateway-ip>:<port>/api/<your-key>/config
```

This should return your gateway's config JSON (name, swversion, etc.) if the key and port are correct.

5. List your lights to find their numeric IDs:

```bash
curl http://<gateway-ip>:<port>/api/<your-key>/lights
```

6. Set `deconz.bulbLightIds` in `config/settings.json` to those 8 IDs, ordered to match your lamp's physical ring layout (outer ring first, then inner ring).

## 5. Environment Variables (Credentials — Required)

Never commit your real API key to version control. Copy `.env.example` to `.env` and fill in your real values:

```bash
cp .env.example .env
```

```
DECONZ_API_KEY=your_real_key_here
DECONZ_HOST=192.168.1.100
DECONZ_PORT=8081
```

`.env` is already excluded via `.gitignore`. `server.js` loads it automatically via `dotenv` and will refuse to start if no API key is found anywhere (neither `.env` nor `config/settings.json`).

Other optional overrides:

```bash
export PORT=3000
export HOST=0.0.0.0
```

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
deCONZ gateway reachable: true
OctoOrgler running on 0.0.0.0:3000
Admin dashboard: http://localhost:3000/admin
```

## Changing the Listening Port

Precedence (highest wins): CLI flag (`--port=8080`) > `PORT` env var > `server.port` in settings.json > default `3000`. Same pattern applies to `HOST` / `server.host`. Changing the port via the admin dashboard requires a manual restart to take effect.

## 7. Connect Players

- On each player's phone (same Wi-Fi/LAN as the server), open `http://<server-ip>:3000`
- Enter a name to join the lobby (1-4 players)
- Each player's page shows a compact Sputnik-lamp graphic above the tap button, with a pulsing ring around their assigned bulb(s) so they always know where to watch — this updates live as colors change during the round
- One device (a laptop/tablet/TV) can optionally open `http://<server-ip>:3000/lamp.html` for a full split-screen fallback lamp visualization for spectators

## 8. Open the Admin Dashboard

Visit `http://<server-ip>:3000/admin` to view and adjust settings live, including the deCONZ gateway host/port and reachability timeout. Changes save immediately but only take effect at the start of the next round.

## 8b. Lamp Control Panel

Open the burger menu (top-right on every page) and choose **Lamp control**, or visit `http://<server-ip>:3000/control/`. Outside of a game you can use it to run static scenes (warm white/yellow/orange), circular chases and a breathing effect, or set colors for the whole lamp.

- It reaches deCONZ through the OctoOrgler server (`/api/lampctl/...`, see `game/DeconzProxy.js`) using the gateway host, port and API key the server already uses. The browser never sees the API key, and the gateway needs no CORS setup.
- Group actions (scenes, breathing, All on/off) need a deCONZ group named exactly **OctoOrgler** that contains the eight lamps. Create it in Phoscon.
- While a game with players is running, the server refuses lamp commands from the panel (HTTP 409) and the panel shows that it is paused. Once all players leave, the game loop stops and the panel works again.
- Automatic bulb recovery checks every 10 seconds. It reapplies the last requested state to a lamp that dropped off the Zigbee mesh and came back, and re-sends it if a lamp's reported power or brightness has drifted (e.g. after a short power dip). It never resets or re-pairs lamps.
- **Lamp order** is the list of deCONZ light IDs clockwise from the top bulb. Chases follow it. It is saved on the server (`deconz.bulbLightIds` in `config/settings.json`), so the game also maps its bulb positions to the right physical lamps. Separate IDs with commas or spaces. Typing all eight IDs once each saves the order; a shorter list is used only until the page is reloaded.

## 8c. Identify the Lamp Order

1. Open **Lamp view** from the burger menu (`/lamp.html`) and press **Identify** (not possible while a game is running).
2. All OctoOrgler lamps switch off. Then one lamp at a time switches on (white) while its deCONZ ID is shown in large green text. It advances every 3 seconds; use **Pause**, **Previous**, **Next** or change **Seconds per lamp** as needed.
3. Look at the real lamp. Type the shown ID into the field next to the bulb in the drawing that matches the lit bulb (Pos 1 is the top bulb, then clockwise), or tap that bulb in the drawing to fill it in. Fields that are already saved are pre-filled; duplicates and unknown IDs turn red, and the line below lists the IDs not placed yet.
4. When all eight are placed, press **Save as lamp order**. Lamp control shows the new order in its **Lamp order** field and the game uses it right away. **Close identify** switches the last lamp off.

## 9. Production Notes

- Run behind a process manager (e.g. `pm2 start server.js`).
- Keep deCONZ traffic on your local network only; do not expose the gateway's REST API port publicly.
- Rotate your deCONZ API key periodically via Phoscon's whitelist management (Settings → Gateway → Advanced), especially if it's ever been shared or pasted anywhere outside your local environment.
- Back up `data/highscores.json` periodically.

## Custom Sputnik Lamp SVG (Shared Lamp Board + Per-Player Board)

Both the shared browser fallback view (`lamp.html`) and each player's own game page (`index.html`) render the 8-bulb lamp using the same tagged SVG at `public/assets/sputnik_lamp.svg`.

The SVG's 8 bulb shapes are tagged `id="bulb-0"` through `id="bulb-7"`, ordered clockwise starting from the top bulb, matching the lamp's physical ring layout. `lampBoard.js` drives the shared board; `myBulbBoard.js` drives the smaller per-player board above the tap button and additionally overlays a pulsing highlight ring around whichever bulb(s) are currently assigned to that player. If the SVG fails to load, both fall back to simple animated CSS dots so the game stays playable.

## Loading Screen

The server root (`/`) serves `public/loading.html` first — a retro boot screen with mascot art, a green terminal progress bar, and a synthesized floppy-drive sound (`public/assets/floppy_drive.wav`, an approximation, not a licensed recording), then auto-redirects to `index.html` after ~3.4 seconds.

## 10. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `TypeError: Cannot read properties of undefined (reading 'bulbLightIds')` | `config/settings.json` still has the old `hue` key instead of `deconz` | Replace the `hue` block with a `deconz` block as shown in this file |
| Server exits immediately with "No deCONZ API key found" | `.env` missing or `DECONZ_API_KEY` not set | Create `.env` from `.env.example` and fill in your real key |
| Lamp never lights up | Wrong gateway host/port, or API key revoked | Re-run the `curl .../config` check in Step 4 |
| Game always falls back to browser mode | Gateway unreachable within timeout | Increase `deconz.reachabilityTimeoutMs`, confirm gateway is powered and reachable |
| Players can't join from phones | Server bound to localhost only, or firewall blocking the port | Ensure `HOST=0.0.0.0` and the port is allowed through your firewall |
| Bulb graphic not showing on player page | `public/assets/sputnik_lamp.svg` missing, or bulb IDs not tagged `bulb-0`..`bulb-7` | Confirm the file exists at that path and check browser console for a 404 |
| Settings changes not applying | Working as intended — changes are staged | Wait for the current round to end |
