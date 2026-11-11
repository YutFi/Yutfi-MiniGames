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
The host can set a **move clock** in the lobby (Off / 30 / 60 / 90 / 120 s, default 60 s). It gives everyone time to read a power-up or think; you can add 30 s twice per move, and if time runs out a safe default is played (a normal roll, a Shield, or "decline"). On phones the game starts in **Smooth mode** (fewer heavy effects); change it any time in the settings.

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

### The Dungeon RPG layer
Everything below is on in the default **Dungeon RPG** mode. Pick **📜 Classic** (🎭 Champions dialog, or the host's lobby for online rooms) to play the plain rules below, with no special tiles or RPG items. Dice, the finish rule and Jack of Trader work in every mode.

**Special tiles** (shown on the board; each rests for a few rounds after use)
- 🎁 **Treasure Chest** – random gold, a half-price Black Market coupon, a shield, a Phantom Cloak, an extra roll… or a rare **Mimic**.
- 🌀 **Mystery Portal** – warp forward or back, swap places with a random rival, or reach a secret bonus vault.
- 🎡 **Wheel of Fortune** – animated roulette: $200 jackpots, extra rolls, shields, a free item… or a snake curse / lost turn.
- 🔮 **Cursed Altar** – pay $100 for a blessing, or refuse and risk a curse (the choice is asked first).
- 🏕️ **Rest Camp** – cures freezes, poison and curses, restores a shield, a little gold.
- ❓ **Hidden traps** – spikes, poison cloud, gold-thief pit, iron cage. 🧙 Wizards sense traps ahead, 🧑 Humans may disarm them, 😇 Angels resist poison and cages, 😈 Demons ignore spikes.
- 👹 **Bosses** – Ice Titan (tile 33), Ancient Dragon (56), Lich King (82). A boss blocks the road: you stop on its tile and trade up to three exchanges of blows. Boss health is **shared**, so every visit chips it down for everyone; the killing blow wins gold and a piece of gear.

**New Black Market items** (the six originals are unchanged; still one purchase per turn, with per-match limits and cooldowns): ⏪ Time Rewind $150 · 🪞 Mirror Curse $120 · 🎲 Loaded Dice $200 (once per match) · 👻 Phantom Cloak $160 (2 turns) · 🪝 Snakeslayer Hook $130 · 🎯 Bounty Contract $100 · ⚡ Chain Lightning $180.

**World events** every 3–5 rounds, identical for every player: Gold Rush, Snake Awakening, Goddess Blessing, Dark Storm, Merchant Festival, Dragon's Wrath, Lucky Day, Frozen Kingdom, Double Salary, Chaos Day.

**The Arena** (one action per turn, before you roll): Magical Duel ($50 stake), Treasure Competition, a 3-round Alliance (shared rewards, you cover each other… until someone betrays), and **Wanted** – the hero who runs far ahead gets a bounty on their head.

**Titles & achievements** (cosmetic only): Merchant, Snake Master, Villain, Guardian, Lucky One, Champion, Gambler · First Blood, Lucky Gambler, Snake Survivor, Millionaire, Dragon Slayer, Unstoppable, Comeback King, Master Trader.

**Game modes** (host chooses before an online match): 🏰 Dungeon RPG · 📜 Classic · 🌪️ Chaos · 💀 Hardcore (one life) · 💎 Richest Wins (20 rounds, laps pay $400) · 🔥 Survival (3 lives, growing toll, harmful events) · ⏩ Double Trouble · 🎯 Bounty Hunter · 🚫 No Market · ⚡ Speed Race.

Open **📖 Guide** in the game for the same summary; it is next to ✨ **FX** in the header. ✨ **FX** toggles heavy particle effects (it also lowers itself automatically on slow phones).

### Rules in brief
- Roll a die and climb ladders / slide down snakes. You need the **exact** roll to land on tile 100. By default, if you roll too high you walk up to 100 and **bounce back** with the leftover steps (e.g. on 98 rolling 5: 99, 100, then back 99, 98, 97). Prefer the stricter **🎯 Exact finish** rule (a roll past 100 is simply wasted)? Pick it in the class screen, or the host picks it in the online lobby. It is shared by the whole room.
- **Four dice** (pick one before you roll, keys `1`–`4`): 🎲 Normal (free, fair 1–6), 🎯 Steady (free, always 3, 4 or 5), 🍀 Lucky ($200, 2–6) and 🎰 Gambler's ($250, 1, 2, 7 or 8). A die you can't afford falls back to the normal one. A 6 on a Normal or Lucky die — or an 8 on the Gambler's die — gives the extra roll and power-up.
- Earn salary each turn, spend gold at the **Black Market** (one purchase per turn): swap places, freeze a rival, bribe a snake, set a checkpoint, plant a serpent trap or a mine, or gamble on **🃏 Jack of Trader**.
- **🃏 Jack of Trader** ($200): three face-down cards, you pick one, and you don't know what you bought until it flips. 60% a boon (Golden Jackpot, Divine Protection, Lucky Leap, Merchant's Blessing, Second Chance, Golden Investment, Phoenix Rebirth, Secret Shortcut, Fate Reversal, King's Fortune, 6% each) and 40% a curse (Merchant's Scam, Serpent's Curse, Frozen Contract, Explosive Debt, Broken Protection, Bandit's Ambush, Time Collapse, Void Portal, Cursed Fortune, Jack's Final Betrayal, 4% each). Jack never carries a piece onto tile 100: the finish has to be earned with the dice. In online rooms the **host** draws the outcome once and writes it into the shared move log, so every screen plays the same card, a reload replays it, and a duplicate can't pay out twice.
- Roll a **6** for an extra roll and a power-up.
- Classes: **Human** (extra salary, bonus on even rolls), **Wizard** (cheaper market, longer ladders), **Demon** (steals $100 as it passes rivals, +$25 salary), **Angel** (starts shielded, immune to freeze).
- Every mine, snake bite, swap, power-up and penalty triggers a full-screen meme splash (toggle with **Memes On/Off**; tap or press Space to skip).
- The winner screen shows a **match summary** (turns, snake bites, ladders, mines, bounces, gold earned/spent/stolen, special dice, Jack gambles) and **Play again** starts a rematch in the same room.

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
docs/RPG-DESIGN.md      design notes for the Dungeon RPG layer
docs/rpg/               RPG layer source parts, merge script and screenshots of every cinematic
tests/                  jsdom tests: multiplayer sync (all modes), main menu and chat, finish rule + dice, Jack of Trader, RPG gameplay logic, cinematics  (cd tests && npm install && npm test)
tests/balance.js        bot-vs-bot balance simulations: classes, Black Market items, dice, Jack  (node balance.js classes|items|dice|jack)
.gitignore
```
