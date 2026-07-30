# RULES_OF_THE_GAME.md

## Objective

Capture the most bulbs in your assigned color before time runs out. In single-player mode, beat your own previous high score instead of competing against others.

## Setup

1. Each player joins from their phone and enters a name.
2. The game assigns each player one of up to 8 distinct colors.
3. At the start of each round, players are assigned one or more of the lamp's 8 bulbs to monitor — the assigned bulbs briefly flash to show which ones are "yours."
4. Rounds last 30 seconds by default (adjustable by the host/admin).

## Bulb Assignment Rules

| Players | Bulb assignment |
|---|---|
| 1 (solo) | All monitored bulbs belong to you; count increases every two rounds, up to all 8 |
| 2 | Progressive: 1 bulb in round 1, 2 in round 2, 3 in round 3 and beyond |
| 3 | Two players randomly get more bulbs (heavier load), one gets fewer, re-randomized each round |
| 4 | Everyone gets 1 bulb in round 1, then 2 bulbs from round 2 onward |

Exact bulb counts scale further depending on the selected difficulty mode (see below).

## How to Capture a Bulb

- Watch your assigned bulb(s) on your phone screen (mirrored from the physical lamp, or shown in the browser fallback view).
- The moment a bulb lights up in your color, tap the big button on your phone.
- You must tap within the current grace window — a short time limit after the bulb changes to your color. Tapping too late doesn't count as a capture.
- A successful capture scores a point and the bulb immediately relights with a new color (it never stays dark) — it's back in play right away.

## Difficulty Modes

| Mode | Grace window | Bulb re-color speed (round 1) | Bulbs assigned (start) | Colors shown | Chance of seeing your color |
|---|---|---|---|---|---|
| Beginner | 900 ms (shrinks slowly) | 2600 ms | Fewer (starts at 2 for solo) | 4 colors | 35% |
| Novice | 500 ms | 1800 ms | Moderate (starts at 4 for solo) | 6 colors | 25% |
| Expert | 200 ms (shrinks fastest) | 1100 ms | Most (starts at 6 for solo) | 8 colors | 18% |

Both bulb re-color speed and grace window get progressively tighter as rounds go on within a single game, on top of these mode baselines. The number of colors in circulation and how often your own color actually appears are both configurable per mode too — fewer colors and higher display-probability make Beginner more forgiving, while Expert throws more competing colors at you less often.

## Single-Player Mode

- Play alone against the full 8-bulb lamp.
- Your assigned bulb count grows over time instead of being split with rivals.
- Obstacles appear and increase in frequency each round:
  - **Trick light** — briefly flashes your real color, then swaps to a different one before most grace windows would expire, punishing pure reflex-tapping.
  - **Blinker** — rapidly strobes between multiple colors including yours; timing your tap to the correct flash matters.
  - **Decoy** — shows a color very close to yours, testing color discrimination.
- Missing a capture (your color appeared, grace window expired, no tap) costs you a point (configurable penalty, default -1, floored at zero).
- At the end of a run, your score is compared against your personal best for that difficulty mode — beat it to set a new high score.

## Speed & Round Progression

Every round, bulbs change color faster than the last, and the grace window shrinks slightly — so late rounds demand much sharper reflexes than round one. Both the base speed and grace window can be adjusted globally by the host via the admin dashboard, but any changes only apply starting the next round to keep an active round fair.

## Physical Lamp vs Browser Mode

If a real Hue-connected 8-bulb satellite lamp is detected on the network, it lights up in real time alongside your phone screen. If no lamp is reachable, the game automatically switches everyone to a split-screen browser view: the virtual 8-LED lamp on top, your color-coded tap button on the bottom.

## Winning

- **Multiplayer (2-4 players):** Whoever has the most captured bulbs when the round timer ends wins.
- **Single-player:** There's no "opponent" — success means beating your previously saved high score for the chosen difficulty mode.
