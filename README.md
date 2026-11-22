# OctoOrgler

OctoOrgler is a 1-4 player reaction game built around an 8-LED satellite lamp (GDR-style, two rings of four bulbs). Each player is assigned a color and a set of bulbs to monitor on their phone. Bulbs flash through colors at increasing speed — tap your phone's button the instant "your" bulb shows your color to capture it.

The game drives a real Zigbee-connected lamp directly via the deCONZ REST API (ConBee/RaspBee gateway), and automatically falls back to a browser-rendered Sputnik-lamp visualization if the gateway isn't reachable.

A **Lamp control** page in the burger menu (`/control/`) lets you run scenes, chases and a breathing effect on the lamp between games, with automatic recovery for bulbs that drop off the Zigbee mesh.

Each player's own game page also shows a compact live view of the lamp with a highlight ring around their assigned bulb(s), so they always know where to watch — see BUILD.md for full setup instructions.
