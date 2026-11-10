# Yutfi MiniGames

A small collection of browser mini-games by Yutfi. Single-file site (`index.html`), no build step.

**Play:** https://yutfi.github.io/Yutfi-MiniGames/ (after GitHub Pages is enabled, see below)

| Game | Status |
|------|--------|
| 🐍 **Snack Game** — *Dungeon of Snakes & Ladders*: a dungeon-themed Snakes & Ladders with cash, traps and class powers. Solo, 2 players on one screen, or online with up to 5. | Playable |
| 👑 **Party Game — Save the Princess**: mini-game contests, sabotage and a race to the castle. | Coming soon |

## Welcome splash and music
Opening the link shows a **Welcome to Yutfi MiniGames** splash. Tap (or press any key) to start. Browsers only allow sound after a tap, so the music begins from that tap rather than on page load.

The soundtrack is a slow, heroic D-minor adventure theme generated live with Tone.js (no audio files): warm pad, plucked arpeggios, a simple hero melody, war drum and soft shaker. It plays fuller on the splash and menus and drops to a quiet background bed during a match.
- **Audio** (menu or header button) is the master switch for all sound.
- **Music** (menu) turns just the music off or on and is remembered next time.
- It pauses when the tab is in the background.

## Dungeon of Snakes & Ladders

### Main menu
After the splash you land on the **Yutfi MiniGames** screen with two game modes:
- **🐍 Snack Game** — this game (Snakes & Ladders in the dungeon). Opens the menu below.
- **👑 Party Game — Save the Princess** — *coming soon*; shown as a placeholder card for now.

Inside **Snack Game**:
- **▶ Resume match** — appears when you reopen the menu (☰ **Menu**, top right) during a match
- **⚔️ Play Solo** → **vs AI Bot** or **2 Players** on one screen, then pick your champions
- **🌐 Play Online** — rooms for **2–5 players**, no account or sign-in needed
- **📖 How to Play** — rules, classes, the Black Market and controls

Esc (or **← Game modes**) goes back one step. Your online name and champion are remembered for next time.

### Online play
1. One player presses **Play Online → Create a room** and gets a 4-character code.
2. Everyone else opens the same link, presses **Play Online → Join a room**, enters the code (or just opens the **invite link** the host copies, which lands straight on the Join tab) and joins.
3. The host presses **Start match** once 2–5 players are in.

#### Table Talk (chat and taunts)
During an online match a **💬 Chat** button appears bottom-right (with an unread badge). It opens a drawer with:
- **Quick chat** phrases ("Good luck!", "Is that all you've got?", "Watch your step…")
- **Emoji taunts** 😂 😈 🐍 💣 🤡 😎 😭 👏 🥶 🔥 — they pop up over your token on everyone's board
- a **typed message** box (80 characters)

Quick chat and emoji show over the sender's token even while the drawer is closed. **🔔 Chat on/off** mutes other players. Chat is only for online matches and is not stored: it is delivered once to whoever is connected and never replayed. Like the rest of online play it is open to anyone who knows the room code, so share codes only with friends.

How it works: players don't need to be on the same Wi-Fi or network. Each browser makes an ordinary outbound WebSocket connection to a free public [MQTT](https://mqtt.org) broker (EMQX, then HiveMQ, then Mosquitto as fallbacks) which relays only the tiny presence/move messages for your 4-letter room code. Every move (a dice roll, a market purchase, a power-up choice) is added to a shared move log and replayed identically in every browser, so everyone sees the same board. Reloading the page rejoins your seat and replays the log.

Limits worth knowing:
- The room lives in the players' browsers. If the **host** (the player who created the room) closes the page, the room ends.
- It depends on free public MQTT brokers. If all three are down, or a network blocks outbound WebSocket ports (some school/work networks do), online rooms won't connect; try mobile data. Room codes are not secret, so share them only with friends. Offline modes still work.
- Matches can't be joined after the host presses Start.

### Rules in brief
- Roll a die and climb ladders / slide down snakes. You need the **exact** roll to land on tile 100.
- Earn salary each turn, spend gold at the **Black Market** (one purchase per turn): swap places, freeze a rival, bribe a snake, set a checkpoint, plant a serpent trap or a mine.
- Roll a **6** for an extra roll and a power-up.
- Classes: **Human** (extra income), **Wizard** (cheaper market, longer ladders), **Demon** (steals gold as it passes rivals), **Angel** (starts shielded, immune to freeze).
- Every mine, snake bite, swap, power-up and penalty triggers a full-screen meme splash (toggle with **Memes On/Off**; tap or press Space to skip).

## Enable GitHub Pages
Repository **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**, then save. The site appears at the URL above within a minute or two.

## Run locally
Open `index.html` in a browser. It loads Tailwind, Tone.js, MQTT.js and Google Fonts from CDNs, so it needs an internet connection.

## Project layout
```
index.html              the whole game (open it, or host it)
README.md
docs/ARCHITECTURE.md    how replication and the online relay work
tests/                  jsdom tests: multiplayer sync, main menu and chat  (cd tests && npm install && npm test)
.gitignore
```
