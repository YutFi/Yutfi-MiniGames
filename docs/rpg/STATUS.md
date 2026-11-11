# RPG edition status

## Merge status (final)
Merged and committed on branch `rpg-edition` (never main). All suites green on the merged build: rpg 4,628 checks, stages 30, jack 129, rules-dice 50, menu-chat 69, online-sync (2p, 5p and 9 three-player mode rooms, all clients identical to a fresh replay). 40/40 repeated std rooms match.

## Online-sync bugs found and fixed (commit 917d62c)
1. A player could buy / act while another player's alliance/altar answer was pending -> the purchase landed in the log ahead of the answer and every other client stalled. Fix: `canAct()` is false while `NET.decWait`.
2. Dice cube / key shortcut could start the next roll during a Jack deal (button was disabled, handler was not). Fix: `handleRollClick()` returns while `jack`, and `canAct()` is false while `jack`.
Diagnostics: `ONLYMODE=<mode>` and `TRACE=1` in tests/online-sync.test.js dump a fresh-replayer comparison and per-log traces on mismatch.

## Honest limitations
Seed is visible in the public MQTT room record; boss fights auto-play; the roller's own die uses Math.random but is logged; Hook / Richest Wins / Survival are interpretation choices; bots (single device only) have no dedicated test; Jack's Phoenix cleanse does not clear RPG curses.

## Added after the merge
- **Balance by table size** (`TABLE_BAL` / `itemLimit()` in index.html): 3 players = original tuning. 2 players: item caps -1 (min 1), cooldowns +1, duel cooldown 4, competition 8. 4 players: caps +1, duel 3, competition 5. 5 players: caps +2, cooldowns -1, duel 2, competition 4. Loaded Dice stays 1 per match everywhere. `NP` is the same on every client, so replay is unaffected.
- **First-time animated tour** (`tourStart()` and `TOUR_STEPS`): spotlight + pulsing ring + animated mini-demos, 10 steps (9 in Classic), keyboard and phone friendly, starts once automatically after the first game opens, replay from the 🎓 Tour button or the Guide. Local only (never touches the move log). Tests: `tests/tour.test.js`. Previews: `docs/rpg/screenshots/tour-*.jpg`.
- Chat button follows the visible viewport on phones (visualViewport + safe-area).
