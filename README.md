# Yutfi MiniGames

A small collection of browser mini-games by Yutfi. Two single-file pages (`index.html` hub + Snake Game, `party.html` Party Game), no build step.

**Play:** https://yutfi.github.io/Yutfi-MiniGames/ (after GitHub Pages is enabled, see below)

| Game | Status |
|------|--------|
| 🐍 **Snake Game** — *Dungeon of Snakes & Ladders*: a dungeon-themed Snakes & Ladders with cash, traps and class powers. Solo, 2 players on one screen, or online with up to 5. | Playable |
| 👑 **Party Game — Save the Princess** (`party.html`): a fantasy party game for 2–4 players (humans and/or bots) on one screen. Win mini-games to cross a branching map, sabotage rivals, beat bosses and clear the Dark Castle. | Playable (core game + 10 mini-games) |

## Welcome splash and music
Opening the link shows a **Welcome to Yutfi MiniGames** splash. Tap (or press any key) to start. Browsers only allow sound after a tap, so the music begins from that tap rather than on page load.

The splash is animated (aurora, god-rays, twinkling stars, drifting game icons, an orbiting crest, a shimmering title and a torch-lit castle). The soundtrack is a slow, heroic D-minor adventure theme generated live with Tone.js (no audio files): warm pad, plucked arpeggios, a simple hero melody, war drum and soft shaker. It plays fuller on the splash and menus and drops to a quiet background bed during a match.
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
Local **or online** 2–4 players (any mix of humans and bots, three bot difficulties). Pick a race (Human, Angel, Devil, Wizard — each has a one-time ability) and a mode (Classic, Chaos, Speed Rescue).

- **Loop:** each round is a mini-game; finishing order moves you along the map and pays gold. Choose a route at the crossroads, play cards (Tornado, Curse, Swap, Bandit, Freeze, Reverse, Trap, Lucky, Shield, Double) on rivals, shop at the Magic River bazaar, survive world and personal events.
- **Bosses:** Ice Titan, Ancient Dragon and Bandit Lord are co-op fights on the map; top damage dealer gets a bonus.
- **Finale:** reach the Dark Castle and clear its 5 trials (3 in Speed Rescue). First to finish rescues the princess — the ending depends on who wins (Hero, Devil, Angel, Wizard, a secret-path ending, or the Dragon takes the kingdom if time runs out).
- **Mini-games (10, all playable by 2, 3 or 4 players — no 1-v-1-only games):** Archery Target Challenge, Fantasy Horse Race, Sword Fighting Arena, Penguin Platform Push, Arrow Reaction Challenge, **Slime Slayer Hunt**, **Royal Feast Rush**, **Cursed Crown Chase**, Magical Potion Mixing, Treasure Hunting Race — plus the co-op boss arenas. Every one has a medieval / isekai-fantasy theme.
- **Clear controls (phone, tablet and keyboard):** every game opens with a "how to play" card (🎯 Goal · 🕹️ Move · big action button) and shows the goal again on screen during the countdown and the first seconds of play. On touch screens you get a floating **analog joystick** (left thumb, touch anywhere on the left) and one big **action button** (right thumb) that **renames itself to match the game** — JUMP in the horse race, SHOOT, SWING (plus a BLOCK button), CHARGE → RELEASE, SLASH, MAGNET, DASH, DROP, DIG, STRIKE. Games that don't need a stick show a D-pad or just the one button. Portrait and landscape both work (the board sits on top in portrait, controls underneath).
- **Keyboard controls:** four direction keys + one action key per player — P1 `A D W S` + `Space`, P2 arrows + `Enter`, P3 `J L I K` + `U`, P4 numpad `4 6 8 5` + `0`.
- **Sound & music:** ~25 generated sound effects (jumps, slashes, coins, fanfares, crowns…) and five original uplifting adventure songs that change with the kind of mini-game (rising-hero theme on the map, quest, clash, bounce, sparkle, boss). 🔊 turns all sound off, 🎵 turns just the music off; both are remembered.
- **Look & feel:** crisp HiDPI canvas, glass-style UI, quest-curtain transitions into every mini-game, animated results (staggered rows, gold count-up, medal pops), map tokens with name tags, a crown on the leader and a progress bar on each player card.
- **Isekai cheat skills:** at the start every hero is reincarnated by the goddess with a random skill (Common → Rare → Super Rare → Legendary): Hero Awakening, Godspeed, Chaos Hex, Absolute Zero, Berserker Rage, Gravity Well, **Time Stop**, **Reality Rewrite**, plus passives (Midas Touch, Plot Armor). Press your **Power key** during a challenge (P1 `E`, P2 Right Shift, P3 `O`, P4 Num `+`, or the ⚡ button on phones) for an anime-style cut-in and the effect. Skills cost ⚡ mana (start with 2, +1 per round).
- **Snakes & ladders on the map:** 🪜 ladder (+2), 🐍 snake (−2), 🔄 swap portal, 💣 mine (gold + frozen start), ⛩️ goddess shrine (+2 mana, may re-roll your skill), each with a full-screen splash.
- **Animation:** shared effects engine (slash arcs, shockwaves, sparks, dust, confetti, screen shake, hit-stop). The sword arena has a proper wind-up/strike/recovery swing, parries and KO fly-offs; the slime hunt has combo multipliers, a King Slime and bombs.
- **Animation (v2):** the world map is alive — drifting cloud shadows, fireflies in the forest and graveyard, river sparkles, snow in the Frozen Kingdom, birds, castle embers; tokens breathe, stretch while hopping, squash and puff dust with a landing ring; each round opens with a cinematic "ROUND n / m" splash with light rays; countdown digits pop with shock rings, **GO!** flashes the screen with a shockwave, and finishes slam in a shining ribbon with confetti cannons from both corners; the winner's result row pulses gold.
- **Not built yet:** the other 20 mini-games, rivalries/alliances, team challenges, Team Rescue / Survival / Boss Rush modes.

### Play Save the Princess online
Press **🌐 Play online** on the setup screen. One person taps **Create room** and shares the 4-letter room code or the invite link (`party.html#room-XXXX`, opens straight into the room); the others tap **Join** and enter the code. The host sets the mode, difficulty and bots in the lobby (max 4 seats in total, empty seats can be bots) and presses **Start**. Everyone plays on their own device with their own touch/keyboard controls — every device maps its controls to its own seat.

- **How it works:** no server of our own. Devices talk through free public MQTT brokers (EMQX, HiveMQ, Mosquitto, tried in that order). The host runs the adventure (map, cards, shop, events) and every device runs the mini-games in lockstep: same random seed, host relays everybody's inputs every frame. Results and the adventure state always come from the host, so a tiny floating-point difference between browsers cannot split the game.
- **Choices:** whoever's turn it is (route at a crossroads, card to play, shop) gets the controls; everyone else sees the same screen, read-only. Shared prompts wait for all humans (20 s auto-continue).
- **Leaving:** if a player closes the tab or loses connection, a bot takes their seat after the current round. If the host leaves, the room closes. There is no mid-match re-join.
- **Limits:** needs internet on every device; the host's tab should stay open and in the foreground (phones may pause background tabs); public brokers are shared and can be slow or briefly unavailable, so a little input delay (about your network round-trip) is normal; rooms are public-by-code, so don't reuse a code you don't want strangers to join.

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
