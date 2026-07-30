# OctoOrgler

OctoOrgler is a 1-4 player reaction game built around an 8-LED satellite lamp (GDR-style, two rings of four bulbs). Each player is assigned a color and a set of bulbs to monitor on their phone. Bulbs flash through colors at increasing speed — tap your phone's button the instant "your" bulb shows your color to capture it. Most captures when the round ends wins.

The game drives a real Philips Hue-connected lamp via OSC (through the `osc2hue` bridge to the openhue/Hue API), and automatically falls back to a split-screen browser visualization if the physical lamp isn't reachable on the network.

> Meet the OctoOrgler mascot — a violet comic octopus whose head is a glowing lightbulb and whose tentacles are lined with color-coded bulbs instead of suction cups, echoing the game's 8-bulb lamp mechanic. See `octoorgler_mascot.png` in this repo for the artwork.
>
> A retro 16-bit reinterpretation, styled after classic early-90s LucasArts adventure game art (think *Day of the Tentacle*), is also included as `octoorgler_16bit.png` for a nostalgic alternate branding option.
>
> A refined version with a uniform turquoise tentacle and an in-scene "OCTO ORGLER" door sign, downsampled for an even more authentic chunky-pixel look, is included as `octoorgler_16bit_v2.png`.
>
> The final version, `octoorgler_16bit_v3.png`, gives each tentacle its own single distinct color (one uniform color per arm across all eight) and features a blue Verner Panton "Amoeba" chair in the background room.
>
> The latest version, `octoorgler_16bit_v4.png`, features the correct Verner Panton "Amoeba Highback Lounge Chair" in cobalt blue and a fully redesigned retro-futuristic space-age room (curved shapes, atomic-age decor, glossy accents), while keeping the original carpet unchanged.
>
> The final version, `octoorgler_16bit_v5.png`, corrects the chair to the tall C-shaped curled-base lounge design (cobalt blue) and gives the octopus a sly, asymmetrical smirk with one eye larger than the other for extra character.
>
> The definitive version, `octoorgler_16bit_v6.png`, uses the correct Verner Panton "Amoebe Highback" legless continuous-curve chair (cobalt blue), and swaps the floor lamp for a twin pleated-shade retro design.
>
> `octoorgler_16bit_v7.png` rescales the Amoebe chair to a proportionally accurate size relative to the twin-shade floor lamp for a more realistic room composition.
>
> `octoorgler_16bit_v8.png` completes the room styling with an abstract geometric art print (replacing the wall clock), a tall record shelf unit (replacing the low sideboard), and a white Art Deco-style door still bearing the "OCTO ORGLER" sign.

## Features

- 1-4 player support, including a solo "beat your high score" mode
- Three difficulty modes (Beginner, Novice, Expert) tuning grace window, bulb speed, bulb count, color count, and color-display probability
- Dynamic, admin-adjustable grace window (how long after a color change a tap still counts)
- Physical lamp control via OSC → openhue, with automatic browser fallback (split-screen virtual lamp + phone buzzers)
- Obstacle system for single-player: trick lights, blinkers, and decoy colors that scale in frequency each round
- Persistent high-score tracking per player/mode
- Miss penalty in single-player mode (minus points for failing to capture in time)
- Central `settings.json` config with a live admin dashboard — changes are staged and apply starting the next round, never mid-round
- Real-time multiplayer via Socket.IO

## Project Structure

```
octoorgler/
├── server.js                  # Express + Socket.IO entry point
├── config/
│   └── settings.json          # All adjustable game settings
├── data/
│   └── highscores.json        # Persisted single-player high scores
├── game/
│   ├── GameEngine.js          # Round loop, scoring, capture/miss logic
│   ├── BulbAssigner.js        # Bulb-to-player assignment rules
│   ├── DifficultyModes.js     # Mode presets (grace, speed, colors, obstacles)
│   ├── ObstacleEngine.js      # Trick lights, blinkers, decoys
│   ├── HueOSCBridge.js        # OSC client → openhue/osc2hue bridge
│   ├── HighScoreStore.js      # High score persistence
│   └── SettingsManager.js     # Settings load/save/staging
└── public/
    ├── index.html             # Lobby: join, pick mode, start
    ├── admin/
    │   └── index.html         # Live settings dashboard
    ├── lamp.html               # Split-screen fallback view
    └── client.js               # Shared client logic (buzzer + lamp render)
```

## Quick Start

See BUILD.md for full setup instructions. In short:

```bash
npm install
npm start
```

Then open `http://localhost:3000` on each player's phone (same Wi-Fi network) and `http://localhost:3000/admin` for the settings dashboard.

## How to Play

See RULES_OF_THE_GAME.md for full rules, difficulty mode breakdowns, and scoring details.

## Requirements

- Node.js 18+
- A Philips Hue Bridge (optional — game works in browser-only fallback mode without one)
- `osc2hue` bridge running locally if you want to drive a real Hue-connected lamp
- Phones or devices with a browser for each player (same local network as the server)

## License

Internal / personal project — add your preferred license here before distributing.


The game now boots with a retro loading screen (`public/loading.html`) featuring the 16-bit mascot artwork and a floppy-disk-drive sound effect before transitioning into the main lobby.