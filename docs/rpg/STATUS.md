# RPG edition status

## Merge status (final)
Merged and committed on branch `rpg-edition` (never main). All suites green on the merged build: rpg 4,628 checks, stages 30, jack 129, rules-dice 50, menu-chat 69, online-sync (2p, 5p and 9 three-player mode rooms, all clients identical to a fresh replay). 40/40 repeated std rooms match.

## Online-sync bugs found and fixed (commit 917d62c)
1. A player could buy / act while another player's alliance/altar answer was pending -> the purchase landed in the log ahead of the answer and every other client stalled. Fix: `canAct()` is false while `NET.decWait`.
2. Dice cube / key shortcut could start the next roll during a Jack deal (button was disabled, handler was not). Fix: `handleRollClick()` returns while `jack`, and `canAct()` is false while `jack`.
Diagnostics: `ONLYMODE=<mode>` and `TRACE=1` in tests/online-sync.test.js dump a fresh-replayer comparison and per-log traces on mismatch.

## Honest limitations
Seed is visible in the public MQTT room record; boss fights auto-play; the roller's own die uses Math.random but is logged; Hook / Richest Wins / Survival are interpretation choices; bots (single device only) have no dedicated test; Jack's Phoenix cleanse does not clear RPG curses.
