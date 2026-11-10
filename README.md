# Dungeon of Snakes & Ladders

A dungeon-themed Snakes & Ladders with cash, traps and class powers. Single-file game (`index.html`), no build step.

**Play:** https://yutfi.github.io/Dungeon-of-Snakes-Ladders/ (after GitHub Pages is enabled, see below)

## Modes
- **vs AI Bot** and **2 Players** on one screen
- **🌐 Online** — rooms for **2–5 players**, no account or sign-in needed

## Online play
1. One player presses **Online → Create room** and gets a 4-character code.
2. Everyone else opens the same link, presses **Online**, enters the code (or opens the **invite link** the host copies) and joins.
3. The host presses **Start match** once 2–5 players are in.

How it works: players don't need to be on the same Wi-Fi or network. Each browser makes an ordinary outbound WebSocket connection to a free public [MQTT](https://mqtt.org) broker (EMQX, then HiveMQ, then Mosquitto as fallbacks) which relays only the tiny presence/move messages for your 4-letter room code. Every move (a dice roll, a market purchase, a power-up choice) is added to a shared move log and replayed identically in every browser, so everyone sees the same board. Reloading the page rejoins your seat and replays the log.

Limits worth knowing:
- The room lives in the players' browsers. If the **host** (the player who created the room) closes the page, the room ends.
- It depends on free public MQTT brokers. If all three are down, or a network blocks outbound WebSocket ports (some school/work networks do), online rooms won't connect; try mobile data. Room codes are not secret, so share them only with friends. Offline modes still work.
- Matches can't be joined after the host presses Start.

## Rules in brief
- Roll a die and climb ladders / slide down snakes. You need the **exact** roll to land on tile 100.
- Earn salary each turn, spend gold at the **Black Market** (one purchase per turn): swap places, freeze a rival, bribe a snake, set a checkpoint, plant a serpent trap or a mine.
- Roll a **6** for an extra roll and a power-up.
- Classes: **Human** (extra income), **Wizard** (cheaper market, longer ladders), **Demon** (steals gold as it passes rivals), **Angel** (starts shielded, immune to freeze).
- Every mine, snake bite, swap, power-up and penalty triggers a full-screen meme splash (toggle with **Memes On/Off**; tap or press Space to skip).

## Enable GitHub Pages
Repository **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**, then save. The site appears at the URL above within a minute or two.

## Run locally
Open `index.html` in a browser. It loads Tailwind, Tone.js, MQTT.js and Google Fonts from CDNs, so it needs an internet connection.
