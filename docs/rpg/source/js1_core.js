
/* ============================================================
   RPG LAYER 1/6 — state, seeded PRNG, modes, definitions, layout
   All new shared state lives in RPG. Shared random outcomes come from R()
   (a PRNG built from the host's seed) and never from Math.random().
   ============================================================ */
const MODES = {
  std:       { icon: '🏰', name: 'Dungeon RPG',   desc: 'Everything on: new tiles, bosses, world events and the Arena. Recommended.' },
  classic:   { icon: '📜', name: 'Classic',       desc: 'The original rules only: no new tiles, events, bosses or Arena.' },
  chaos:     { icon: '🌪️', name: 'Chaos Mode',    desc: 'Many more portals, traps and events (every 2-3 rounds).' },
  hardcore:  { icon: '💀', name: 'Hardcore',      desc: 'One life. Lose a boss fight and you are out for good. Last survivor wins.' },
  richest:   { icon: '💎', name: 'Richest Wins',  desc: '20 rounds. Reaching tile 100 pays +$400 and sends you around again. Most gold wins.' },
  survival:  { icon: '🔥', name: 'Survival',      desc: 'Only harmful world events, getting nastier every round. Reach tile 100 alive.' },
  double:    { icon: '⏩', name: 'Double Trouble', desc: 'Snake drops and ladder climbs are twice as long.' },
  bounty:    { icon: '🎯', name: 'Bounty Hunter', desc: 'Every successful hit on a rival pays you a bounty.' },
  nomarket:  { icon: '🚫', name: 'No Market',     desc: 'The Black Market is closed. Tiles, bosses and the Arena only.' },
  speed:     { icon: '⚡', name: 'Speed Race',    desc: 'Start on tile 21, faster animations, bigger salary, quicker events.' }
};
const MODE_CFG = {
  std: {}, classic: { rpg: false }, chaos: { evMin: 2, evMax: 3, density: 1.7, trapMul: 2, portalMul: 2.2 },
  hardcore: { lives: 1 }, richest: { rounds: 20 }, survival: { evMin: 2, evMax: 3, harmful: true },
  double: { dbl: true }, bounty: { bounty: true }, nomarket: { market: false },
  speed: { speed: 0.55, startPos: 21, evMin: 3, evMax: 4, salaryMul: 1.5 }
};
const BASE_CFG = { rpg: true, evMin: 3, evMax: 5, density: 1, trapMul: 1, portalMul: 1, lives: 0, rounds: 0, market: true, dbl: false, bounty: false, speed: 1, harmful: false, salaryMul: 1, startPos: 1 };
const validMode = m => (typeof m === 'string' && MODES[m]) ? m : 'std';

const BOSSES = {
  ice:    { tile: 33, name: 'Ice Titan',      icon: '🧊', tint: '#38bdf8', hp: 16, cry: 'THE FROST AWAKENS' },
  dragon: { tile: 56, name: 'Ancient Dragon', icon: '🐉', tint: '#f97316', hp: 20, cry: 'FIRE AND RUIN' },
  lich:   { tile: 82, name: 'Lich King',      icon: '💀', tint: '#a855f7', hp: 22, cry: 'KNEEL, MORTALS' }
};
const BOSS_AT = Object.fromEntries(Object.entries(BOSSES).map(([k, b]) => [b.tile, k]));

const TILE_INFO = {
  chest:  { icon: '🎁', lbl: 'Chest',  cd: 5, tip: 'Treasure Chest: gold, discounts, shields... or a Mimic!' },
  portal: { icon: '🌀', lbl: 'Portal', cd: 0, tip: 'Mystery Portal: teleport, swap or a secret bonus room' },
  wheel:  { icon: '🎡', lbl: 'Wheel',  cd: 4, tip: 'Wheel of Fortune: spin for a reward... or a penalty' },
  altar:  { icon: '🔮', lbl: 'Altar',  cd: 6, tip: 'Cursed Altar: pay $100 for a blessing, or risk a curse' },
  camp:   { icon: '🏕️', lbl: 'Camp',   cd: 6, tip: 'Rest Camp: cures ailments, restores a shield, small gold' },
  trap:   { icon: '❓', lbl: '',       cd: 0, tip: 'Hidden trap!' },
  boss:   { icon: '👹', lbl: 'Boss',   cd: 0, tip: 'Boss tile' }
};
const TRAP_KINDS = {
  spike:  { icon: '🗡️', name: 'Spike Trap' },
  poison: { icon: '☠️', name: 'Poison Cloud' },
  steal:  { icon: '🕳️', name: 'Gold-Thief Pit' },
  jail:   { icon: '⛓️', name: 'Iron Cage' }
};
const CURSES = {
  snakebait: { icon: '🐍', name: 'Snake Curse',  desc: 'Your next snake bite drops you 8 tiles further.' },
  leaden:    { icon: '🪨', name: 'Leaden Boots', desc: 'Your next roll is 2 lower (min 1).' },
  hexed:     { icon: '🧿', name: 'Pauper Hex',   desc: 'Your next salary is halved.' }
};
const WORLD_EVENTS = {
  goldrush: { icon: '💰', name: 'Gold Rush',        sub: 'Everyone receives $50!',                    tint: '#eab308', good: true  },
  awaken:   { icon: '🐍', name: 'Snake Awakening',  sub: 'Snakes bite 4 tiles deeper for 2 rounds!',  tint: '#be123c', good: false },
  blessing: { icon: '🛡️', name: 'Goddess Blessing', sub: 'Everyone receives a Holy Shield!',          tint: '#22d3ee', good: true  },
  storm:    { icon: '⛈️', name: 'Dark Storm',       sub: 'Dice are capped at 4 this round!',          tint: '#475569', good: false },
  festival: { icon: '🎪', name: 'Merchant Festival', sub: 'Black Market prices −30% for 2 rounds!',   tint: '#f97316', good: true  },
  wrath:    { icon: '🐲', name: "Dragon's Wrath",   sub: 'A random hero is scorched for gold!',       tint: '#dc2626', good: false },
  lucky:    { icon: '🍀', name: 'Lucky Day',        sub: 'Everyone earns an extra dice roll!',        tint: '#22c55e', good: true  },
  frozenk:  { icon: '🥶', name: 'Frozen Kingdom',   sub: 'A deep chill: heroes may freeze solid!',    tint: '#38bdf8', good: false },
  salary:   { icon: '🤑', name: 'Double Salary',    sub: 'Salaries are doubled for 3 rounds!',        tint: '#fbbf24', good: true  },
  chaosday: { icon: '🎭', name: 'Chaos Day',        sub: 'The dungeon itself lashes out at heroes!',  tint: '#d946ef', good: false }
};
const ACH = {
  firstblood: { icon: '🩸', name: 'First Blood',     desc: 'Land the first successful hit on a rival.' },
  gambler:    { icon: '🎰', name: 'Lucky Gambler',   desc: 'Win a $200+ jackpot from a gamble.' },
  survivor:   { icon: '🐍', name: 'Snake Survivor',  desc: 'Survive 3 snake encounters in one match.' },
  millionaire:{ icon: '💎', name: 'Millionaire',     desc: 'Hold $1000 at once.' },
  slayer:     { icon: '🐉', name: 'Dragon Slayer',   desc: 'Land the final blow on the Ancient Dragon.' },
  unstoppable:{ icon: '🔥', name: 'Unstoppable',     desc: 'Play 6 turns in a row without suffering a setback.' },
  comeback:   { icon: '👑', name: 'Comeback King',   desc: 'Win after trailing the leader by 25+ tiles.' },
  trader:     { icon: '🛒', name: 'Master Trader',   desc: 'Buy 5 different Black Market items in one match.' }
};
const TITLE_DEFS = [   // later = more prestigious; shown title is the latest earned
  ['gambler',  '🎰 Gambler',      p => p.st.risk >= 4],
  ['lucky',    '🍀 Lucky One',    p => p.st.lucky >= 4],
  ['guardian', '🛡️ Guardian',     p => p.st.block >= 3],
  ['snake',    '🐍 Snake Master', p => p.st.snakes >= 3],
  ['merchant', '💰 Merchant',     p => p.st.spent >= 600],
  ['villain',  '😈 Villain',      p => p.st.sab >= 3],
  ['champion', '🏆 Champion',     p => p.st.won]
];
const ITEM_LIMITS = {   // per-match caps and cooldowns (in rounds) for the new Black Market items
  rewind:    { max: 2, cd: 3 }, mirror: { max: 3, cd: 0 }, loaded: { max: 1, cd: 0 }, cloak: { max: 3, cd: 2 },
  hook:      { max: 3, cd: 0 }, bounty: { max: 2, cd: 3 }, lightning: { max: 2, cd: 4 }
};

function blankP(lives) {
  return { out: false, lives, skip: 0, why: '', poison: 0, curse: null, mirror: false, loaded: false, cloak: 0, hook: false, disc: false,
    lastFrom: 0, lightAt: -9, rewindAt: -9, contract: null, bonusRoll: false, slow: 0, gear: null, gearN: 0, allyGuard: 1, allyCd: 0,
    bought: {}, boughtAt: {}, duelAt: -9, hits: 0, wantedPaid: -9, behind: 0,
    st: { spent: 0, snakes: 0, sab: 0, block: 0, lucky: 0, risk: 0, kinds: {}, streak: 0, won: false, trapsHit: 0 }, ach: {} };
}
function rpgBlank(modeKey, seed) {
  modeKey = validMode(modeKey);
  const cfg = Object.assign({}, BASE_CFG, MODE_CFG[modeKey]);
  return { mode: modeKey, cfg, seed: (seed >>> 0) || 1, s: (seed >>> 0) || 1, round: 1, speed: cfg.speed,
    tiles: {}, cool: {}, boss: {}, ev: null, evLeft: 0, nextEv: 99, evCount: 0, danger: 0,
    mods: { snake: 0, storm: 0, fest: 0, sal: 0 }, p: {}, allies: [], offers: [], compAt: -9, wanted: 0, wantedHits: 0, wantedAt: -9, wantedCd: 0,
    teleHops: 0, actionUsed: false, fromLog: false, firstBlood: false, bountyTurn: 0, lastRoundEvent: 0 };
}
let RPG = rpgBlank('std', 1);
const RP = p => RPG.p[p];
const rpgOn = () => !!RPG.cfg.rpg;
const alive = () => PLAYERS().filter(p => !RPG.p[p].out);

/* ---- seeded PRNG (mulberry32): identical on every client that replays the same log ---- */
function R() {
  RPG.s = (RPG.s + 0x6D2B79F5) | 0;
  let t = Math.imul(RPG.s ^ (RPG.s >>> 15), 1 | RPG.s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const Ri = n => Math.floor(R() * n);                  // 0..n-1
const Rd6 = () => 1 + Ri(6);
const Rpick = a => a[Ri(a.length)];
function Rweighted(pairs) {                          // [[value, weight], ...]
  let tot = 0; pairs.forEach(x => { tot += x[1]; });
  let r = R() * tot;
  for (const [v, w] of pairs) { if ((r -= w) < 0) return v; }
  return pairs[pairs.length - 1][0];
}
function Rshuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const newSeed = () => ((typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967295)) >>> 0 || 7;

/* ---- reset: called from resetGame() ---- */
function rpgReset(modeKey, seed) {
  RPG = rpgBlank(modeKey, seed);
  const C = RPG.cfg;
  PLAYERS().forEach(p => { RPG.p[p] = blankP(C.lives); });
  document.body.classList.toggle('rpg-off', !C.rpg);
  if (!C.rpg) { renderHudChips(); return; }
  if (C.startPos > 1) PLAYERS().forEach(p => { playerPositions[p] = C.startPos; });
  rpgLayout();
  Object.entries(BOSSES).forEach(([k, b]) => {
    const hp = b.hp + Math.max(0, NP - 2) * 4;
    RPG.boss[k] = { hp, max: hp, alive: true, dmg: {} };
    RPG.tiles[b.tile] = { t: 'boss', k };
  });
  RPG.nextEv = 1 + C.evMin + Ri(C.evMax - C.evMin + 1);
  renderHudChips();
}

function rpgLayout() {
  const taken = new Set([1, 100]);
  Object.entries(LADDERS).forEach(([a, b]) => { taken.add(+a); taken.add(+b); });
  Object.entries(BASE_SNAKES).forEach(([a, b]) => { taken.add(+a); taken.add(+b); });
  Object.keys(SPECIAL_TILES).forEach(k => taken.add(+k));
  Object.keys(BOSS_AT).forEach(k => taken.add(+k));
  const pool = Rshuffle(Array.from({ length: 95 }, (_, i) => i + 4).filter(n => !taken.has(n)));
  const C = RPG.cfg, d = C.density;
  const plan = [['chest', Math.round(4 * d)], ['portal', Math.round(3 * C.portalMul)], ['wheel', Math.round(2 * d)],
    ['altar', Math.round(2 * d)], ['camp', Math.round(3 * d)], ['trap', Math.round(6 * C.trapMul)]];
  plan.forEach(([t, n]) => {
    for (let i = 0; i < n && pool.length; i++) {
      const tile = pool.pop();
      RPG.tiles[tile] = t === 'trap' ? { t, k: Rweighted([['spike', 3], ['poison', 3], ['steal', 3], ['jail', 2]]), hidden: true, rev: false } : { t };
    }
  });
}
// traps are topped back up every 5 rounds so the dungeon keeps some bite (never more than the starting count)
function rpgRespawnTraps() {
  const want = Math.round(6 * RPG.cfg.trapMul);
  let have = Object.values(RPG.tiles).filter(x => x.t === 'trap').length;
  if (have >= want) return;
  const taken = new Set([1, 100, ...Object.keys(LADDERS).map(Number), ...Object.values(LADDERS), ...Object.keys(SNAKES).map(Number), ...Object.values(SNAKES),
    ...Object.keys(SPECIAL_TILES).map(Number), ...Object.keys(RPG.tiles).map(Number), ...Object.keys(placedMines).map(Number), ...PLAYERS().map(p => playerPositions[p])]);
  for (let tries = 0; tries < 40 && have < Math.min(want, have + 2); tries++) {
    const n = 4 + Ri(94);
    if (taken.has(n)) continue;
    taken.add(n); have++;
    RPG.tiles[n] = { t: 'trap', k: Rweighted([['spike', 3], ['poison', 3], ['steal', 3], ['jail', 2]]), hidden: true, rev: false };
  }
}

/* ---- small shared helpers ---- */
const allyOf = p => { const a = RPG.allies.find(x => x.a === p || x.b === p); return a ? (a.a === p ? a.b : a.a) : 0; };
const isAllied = (p, q) => allyOf(p) === q && q !== 0;
const leaderPos = () => Math.max(...alive().map(p => playerPositions[p]));
const dormant = n => RPG.round < (RPG.cool[n] || 0);
const clampGold = p => { if (playerCash[p] < 0) playerCash[p] = 0; };
function titleOf(p) {
  const r = RP(p); if (!r) return '';
  let t = '';
  TITLE_DEFS.forEach(d => { if (d[2](r)) t = d[1]; });
  return t;
}
const eligibleTarget = (me, q) => q !== me && !RP(q).out;
function rpgTarget(me) { const r = alive().filter(q => q !== me); return r.length === 1 ? r[0] : 0; }
function bank(p, amt, label, color) {              // every free gold payout goes through here (rounded, floored, visible)
  amt = Math.max(0, Math.round(amt));
  if (!amt) return 0;
  playerCash[p] += amt;
  if (playerCash[p] >= 1000) rpgAch(p, 'millionaire');
  if (!fastMode) { floatAtPlayer(p, `+$${amt}`, color || '#fde68a'); coinFly(p); }
  return amt;
}
function lose(p, amt) {                            // returns what was actually lost
  amt = Math.min(Math.max(0, Math.round(amt)), playerCash[p]);
  playerCash[p] -= amt;
  if (amt && !fastMode) floatAtPlayer(p, `-$${amt}`, '#fb7185');
  return amt;
}
function rpgLog(p, html) { addLogEntry(p, html); }
