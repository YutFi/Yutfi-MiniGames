# Yutfi MiniGames

A small collection of browser mini-games by Yutfi. Two single-file pages (`index.html` hub + Snake Game, `party.html` Party Game), no build step.

**Play:** https://yutfi.github.io/Yutfi-MiniGames/ (after GitHub Pages is enabled, see below)

| Game | Status |
|------|--------|
| 🐍 **Snake Game** — *Dungeon of Snakes & Ladders*: a dungeon-themed Snakes & Ladders with cash, traps and class powers. Solo, 2 players on one screen, or online with up to 5. | Playable |
| 👑 **Party Game — Save the Princess** (`party.html`): a fantasy party game for 2–4 players (humans and/or bots) on one screen. Win mini-games to cross a branching map, sabotage rivals, beat bosses and clear the Dark Castle. | Playable (core game + 10 mini-games) |

## Welcome splash and music
Opening the link shows a **Welcome to Yutfi MiniGames** splash. Tap (or press any key) to start. Browsers only allow sound after a tap, so the music begins from that tap rather than on page load.

The soundtrack is a slow, heroic D-minor adventure theme generated live with Tone.js (no audio files): warm pad, plucked arpeggios, a simple hero melody, war drum and soft shaker. It plays fuller on the splash and menus and drops to a quiet background bed during a match.
- **Audio** (menu or header button) is the master switch for all sound.
- **Music** (menu) turns just the music off or on and is remembered next time.
- It pauses when the tab is in the background.

## Dungeon of Snakes & Ladders

### Main menu
After the splash you land on the **Yutfi MiniGames** screen with two game modes:
- **🐍 Snake Game** — this game (Snakes & Ladders in the dungeon). Opens the menu below.
- **👑 Party Game — Save the Princess** — opens `party.html` (see below).

Inside **Snake Game**:
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

## Party Game — Save the Princess
Local 2–4 players (any mix of humans and bots, three bot difficulties). Pick a race (Human, Angel, Devil, Wizard — each has a one-time ability) and a mode (Classic, Chaos, Speed Rescue).

- **Loop:** each round is a mini-game; finishing order moves you along the map and pays gold. Choose a route at the crossroads, play cards (Tornado, Curse, Swap, Bandit, Freeze, Reverse, Trap, Lucky, Shield, Double) on rivals, shop at the Magic River bazaar, survive world and personal events.
- **Bosses:** Ice Titan, Ancient Dragon and Bandit Lord are co-op fights on the map; top damage dealer gets a bonus.
- **Finale:** reach the Dark Castle and clear its 5 trials (3 in Speed Rescue). First to finish rescues the princess — the ending depends on who wins (Hero, Devil, Angel, Wizard, a secret-path ending, or the Dragon takes the kingdom if time runs out).
- **Mini-games (10):** Archery Target Challenge, Fantasy Horse Race, Sword Fighting Arena, Penguin Platform Push, Arrow Reaction Challenge, Magical Chess (duel), Archer vs Obstacle Runner (duel), Dragon Egg Delivery, Magical Potion Mixing, Treasure Hunting Race — plus a Dragon boss arena.
- **Controls:** four direction keys + one action key per player — P1 `A D W S` + `Space`, P2 arrows + `Enter`, P3 `J L I K` + `U`, P4 numpad `4 6 8 5` + `0`. On phones/tablets Player 1 gets an on-screen pad; chess is click/tap.
- **Not built yet:** the other 20 mini-games, rivalries/alliances, team challenges, Team Rescue / Survival / Boss Rush modes, online multiplayer.

## Enable GitHub Pages
Repository **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**, then save. The site appears at the URL above within a minute or two.

## Run locally
Open `index.html` (or `party.html` directly) in a browser. They load Tailwind (Snake Game only), Tone.js, MQTT.js (Snake Game only) and Google Fonts from CDNs, so an internet connection is needed.

## Project layout
```
index.html              hub + Snake Game (open it, or host it)
party.html              Party Game — Save the Princess
README.md
docs/ARCHITECTURE.md    how replication and the online relay work
tests/                  jsdom tests: multiplayer sync, main menu and chat  (cd tests && npm install && npm test)
.gitignore
```
