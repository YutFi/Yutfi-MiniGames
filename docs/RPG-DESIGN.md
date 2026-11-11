# Dungeon RPG layer — design notes

The original game is a **deterministic engine fed by a shared move log** (see `ARCHITECTURE.md`).
Every browser replays the same log, so boards match. The RPG layer extends that engine instead of
replacing it, and all new state lives in one object, `RPG`, which is rebuilt by `rpgReset()`.

## Where randomness comes from

Existing rule: the player whose turn it is rolls the die and pushes the digit into the log.

New shared random outcomes (chest contents, wheel result, portal destination, world events, boss
dice, duel rolls, trap layout...) must be identical on every client, so they are **never** drawn from
`Math.random()`. Instead:

* The **host** generates one 32-bit `seed` when it starts a match (or a rematch). It travels in the
  room record next to `gen/seats/log`, so it is part of the existing record and needs no new topic.
* Every client builds the same PRNG (`mulberry32`) from that seed and draws from it in the same
  order while replaying the log. A reload therefore replays to exactly the same state.
* Clients never roll shared outcomes; a client that edits its own PRNG only desyncs itself, and the
  existing rule "higher generation / longer prefix-compatible log wins" still applies.
* Honest limitation: the seed is visible in the (public, unencrypted) MQTT record, so a determined
  cheater could read it and predict outcomes. That is true of the existing dice too. It is a
  friends-game trust model, not an anti-cheat system.

## Log grammar (additive)

Existing tokens are unchanged. New tokens:

| token | meaning |
|---|---|
| `r i l p k n` | Time Rewind, Mirror Curse, Loaded Dice, Phantom Cloak, Snakeslayer Hook, Chain Lightning purchases |
| `o`+target | Bounty Contract purchase |
| `d`+target | Magical Duel challenge |
| `a`+target | Alliance offer |
| `e` | Treasure Competition |
| `v` | Betray ally |
| `A` / `D` | Cursed Altar: sacrifice / refuse |
| `g` / `x` | Accept / reject an alliance offer |

Targets stay `J..N` (player 1..5). Decision tokens (`A D g x`, like power-ups `H C S F`) are only
consumed while the engine is actually waiting for that decision, exactly like the existing power-up wait.

Room record additions (optional, backward compatible): `mode` (game-mode key) and `seed`.

## Systems

* **Modes:** `std` (Dungeon RPG, all features), `classic` (the untouched original rules), plus Chaos,
  Hardcore (1 life), Richest Wins (20 rounds, laps pay), Survival (3 lives, growing toll), Double Trouble,
  Bounty Hunter, No Market, Speed Race. The host picks it in the lobby; offline modes pick it in the
  champion dialog. **A room record without a `mode` (created before this update) is played as `classic`**,
  and an unknown mode also falls back to `classic`, so old rooms replay exactly as they used to.
* **Board:** 3 bosses on fixed tiles (33 Ice Titan, 56 Ancient Dragon, 82 Lich King); chests, portals,
  wheels, altars, rest camps and hidden traps are placed from the seed on free tiles.
* **Balance guards:** shop stays 1 purchase/turn; per-item match limits and cooldowns; tiles go dormant
  after use; teleports never target teleporters, snakes, ladders or bosses and `resolveTile` keeps its
  8-step loop guard; gold from bounties/events comes from the bank and is capped per round; the Wanted
  bonus has a payout cap and cooldown; trailing players get a catch-up salary; nothing but landing on
  tile 100 by exact roll wins (except the documented Hardcore last-survivor and Richest Wins rules).
* **Cosmetics:** achievements and titles are display-only and never change any number.
