
/* ============================================================
   RPG LAYER 4/6 — shared services (guards, credit, decisions) and board tiles
   ============================================================ */
function rpgAch(p, key) {
  const r = RP(p); if (!r || !rpgOn() || r.ach[key]) return;
  r.ach[key] = true;
  rpgLog(p, `🏅 Achievement: <b>${ACH[key].icon} ${ACH[key].name}</b>`);
  if (!fastMode) { sfx('ach'); toast(`🏅 ${playerName(p)}: ${ACH[key].icon} ${ACH[key].name}!`, 'good'); }
  const mine = NET.on ? NET.seat : 1;
  if (p === mine && !fastMode) { try { const o = JSON.parse(localStorage.getItem('sl-ach') || '{}'); o[key] = (o[key] || 0) + 1; localStorage.setItem('sl-ach', JSON.stringify(o)); } catch (e) {} }
}
const rpgLucky = p => { if (rpgOn()) RP(p).st.lucky++; };
const rpgRisk = p => { if (rpgOn()) RP(p).st.risk++; };
const isLeader = p => { const o = alive().filter(q => q !== p); return o.length > 0 && playerPositions[p] >= Math.max(...o.map(q => playerPositions[q])) + 8; };
const isTrailing = p => rpgOn() && leaderPos() - playerPositions[p] >= 25;
const sharePct = 0.25;
function rpgShare(p, amt) {                        // allies share part of selected rewards (paid by the bank, capped)
  const a = allyOf(p);
  if (!a || RP(a).out) return;
  const g = bank(a, Math.min(30, amt * sharePct), '', '#86efac');
  if (g) rpgLog(a, `🤝 Alliance share: <b>+$${g}</b> from ${playerName(p)}'s reward.`);
}
function rpgSetback(p) { const r = RP(p); if (r) r.hurt = true; }

/* what happens when `source` tries a hostile action on `victim`: 'hit' | 'blocked' | 'reflect' */
function rpgGuard(victim, source, kind) {
  if (!rpgOn() || !source || source === victim) return 'hit';
  const v = RP(victim);
  if (isAllied(victim, source)) { rpgLog(source, `🤝 The alliance with ${playerName(victim)} stops the ${kind}.`); return 'blocked'; }
  if (v.cloak > 0) { v.st.block++; rpgLog(victim, `👻 Phantom Cloak <b>blocked</b> ${playerName(source)}'s ${kind}!`); floatAtPlayer(victim, 'Cloaked!', '#c4b5fd'); sfx('cloak'); return 'blocked'; }
  if (v.gear === 'frost' && kind === 'freeze' && v.gearN > 0) { v.gearN--; if (!v.gearN) v.gear = null; v.st.block++; rpgLog(victim, `🧊 Frost Armor <b>shattered</b>, shrugging off the freeze!`); return 'blocked'; }
  if (v.mirror) { v.mirror = false; v.st.block++; rpgLog(victim, `🪞 Mirror Curse <b>reflected</b> ${playerName(source)}'s ${kind} back at them!`); floatAtPlayer(victim, 'Reflected!', '#e9d5ff'); sfx('mirror'); return 'reflect'; }
  const ally = allyOf(victim);
  if (ally && !RP(ally).out && v.allyGuard > 0) { v.allyGuard--; RP(ally).st.block++; rpgLog(ally, `🤝 ${playerName(ally)} <b>covered</b> ${playerName(victim)} against the ${kind}!`); return 'blocked'; }
  return 'hit';
}
/* credit for a successful hostile action (reputation, First Blood, Wanted bounty, Bounty Hunter mode, Soul Reaver) */
function rpgHit(src, victim, kind) {
  if (!rpgOn() || !src || src === victim || RP(src).out) return;
  const a = RP(src); a.st.sab++; a.hits++; rpgSetback(victim);
  if (!RPG.firstBlood) { RPG.firstBlood = true; rpgAch(src, 'firstblood'); }
  if (RPG.wanted === victim && RPG.wantedHits < 3 && a.wantedPaid <= RPG.round - 3 && !isAllied(src, victim)) {
    const g = bank(src, 75); a.wantedPaid = RPG.round; RPG.wantedHits++;
    rpgLog(src, `🎯 Wanted bounty! ${playerName(src)} collects <b>$${g}</b> for sabotaging ${playerName(victim)}.`);
    if (RPG.wantedHits >= 3) { rpgLog(victim, `🎯 The bounty on ${playerName(victim)} is lifted — they are granted a Holy Shield.`); playerShields[victim] = true; RPG.wanted = 0; RPG.wantedCd = RPG.round + 4; }
  }
  if (RPG.cfg.bounty) {
    if (RPG.bhRound !== RPG.round) { RPG.bhRound = RPG.round; RPG.bhCount = 0; }
    if (RPG.bhCount < 3) { RPG.bhCount++; const g = bank(src, 60); rpgLog(src, `🎯 Bounty Hunter: <b>+$${g}</b> for the hit on ${playerName(victim)}.`); }
  }
  if (a.gear === 'reaver' && a.gearN > 0) { a.gearN--; if (!a.gearN) a.gear = null; const g = Math.min(40, lose(victim, 40)); bank(src, g); rpgLog(src, `🗡️ Soul Reaver drinks <b>$${g}</b> from ${playerName(victim)}!`); }
}
/* the victim walked into a snake, mine or trap: pay out Bounty Contracts, track streaks */
function rpgTriggered(p, kind) {
  if (!rpgOn()) return;
  rpgSetback(p);
  PLAYERS().forEach(q => {
    const c = RP(q).contract;
    if (!c || c.on !== p || RP(q).out) return;
    if (RPG.round > c.exp || c.paid >= 2) { RP(q).contract = null; return; }
    c.paid++;
    const g = bank(q, 70);
    rpgLog(q, `🎯 Bounty Contract pays <b>$${g}</b>: ${playerName(p)} triggered a ${kind}!`);
    rpgHit(q, p, 'contract');
    if (c.paid >= 2) RP(q).contract = null;
  });
}

/* ---- decisions that arrive through the move log (altar, alliance offers) ---- */
function promptDecision(kind, need, ui, botPick, who) {
  who = who || currentPlayer;
  return new Promise(resolve => {
    const w = { kind, need, who, res: resolve, show: null };
    w.show = () => { const r = ui(ch => { if (NET.on) netPush(ch); if (NET.decWait === w) NET.decWait = null; resolve(ch); }); return r; };
    if (isBot(who) && !NET.on) { resolve(botPick()); return; }
    if (NET.on) {
      const logHas = !!NET.G && NET.applied < NET.G.log.length;
      if (who !== NET.seat || logHas || fastMode) {        // the answer comes through the shared move log
        NET.decWait = w;
        if (!fastMode) setBanner(`<p class="text-xs font-bold text-violet-300">${playerName(who)} is deciding…</p>`);
        updateControls();
        return;
      }
    }
    w.show();
  });
}
function netResolveDecision(ch) { const w = NET.decWait; NET.decWait = null; if (w) w.res(ch); }

/* ---- free landing spots, so teleports can never create chains or loops ---- */
function plainTile(n) {
  return n > 1 && n < 100 && !LADDERS[n] && !SNAKES[n] && !SPECIAL_TILES[n] && !placedMines[n] && !RPG.tiles[n] && !Object.values(LADDERS).includes(n) && !Object.values(SNAKES).includes(n);
}
function nearestPlain(n, dir) {                    // nearest plain tile to n (preferring `dir` first), never 1 or 100
  n = Math.max(2, Math.min(99, n));
  for (let d = 0; d < 20; d++) {
    for (const t of (dir < 0 ? [n - d, n + d] : [n + d, n - d])) if (plainTile(t)) return t;
  }
  return Math.max(2, Math.min(99, n));
}
function playersOn(n) { return PLAYERS().filter(q => playerPositions[q] === n); }

/* ---- dispatcher called from resolveOnce ---- */
async function rpgResolveTile(p, pos) {
  if (!rpgOn()) return undefined;
  const t = RPG.tiles[pos]; if (!t) return undefined;
  if (RP(p).out) return false;
  if (t.t === 'boss') return rpgBossTile(p, pos, t);
  if (t.t === 'trap') return rpgTrap(p, pos, t);
  if (dormant(pos)) { floatText(pos, 'resting…', '#9ca3af'); return false; }
  const cd = TILE_INFO[t.t].cd;
  if (cd) { RPG.cool[pos] = RPG.round + cd; if (!fastMode) setTimeout(rpgDecorateTiles, 50); }
  hotTile(pos);
  if (t.t === 'chest')  return rpgChest(p, pos);
  if (t.t === 'portal') return rpgPortal(p, pos);
  if (t.t === 'wheel')  return rpgWheel(p, pos);
  if (t.t === 'altar')  return rpgAltar(p, pos);
  if (t.t === 'camp')   return rpgCamp(p, pos);
  return undefined;
}

/* lightweight cinematic for small events (skipped when the player turned meme splashes off) */
function quick(o) {
  if (!memesOn) return Promise.resolve();
  return stage(async c => {
    c.card.innerHTML = stHead(o.kicker, o.title, o.sub) + `<div class="st-art"><div class="st-ring"></div><div class="st-ring"></div><div class="st-emoji">${o.emoji}</div></div>${o.result ? `<div class="st-result">${o.result}</div>` : ''}`;
    if (o.shake) c.boardShake(o.shake === 'big');
    await c.wait(o.ms || 1500);
  }, { tint: o.tint, rain: o.rain, shake: !!o.shake });
}

/* ---------------------------------------------------------------- CHEST ---- */
function chestSVG() {
  return `<svg class="chest-svg" viewBox="0 0 120 100">
    <ellipse cx="60" cy="94" rx="46" ry="6" fill="rgba(0,0,0,.45)"/>
    <rect x="14" y="46" width="92" height="44" rx="6" fill="#92501a" stroke="#2a1505" stroke-width="3"/>
    <rect x="14" y="58" width="92" height="8" fill="#c58b4a" opacity=".85"/><rect x="26" y="46" width="8" height="44" fill="#4b5563"/><rect x="86" y="46" width="8" height="44" fill="#4b5563"/>
    <g class="mimicbits" style="display:none"><path d="M16 46 l7 12 l7 -12 l7 12 l7 -12 l7 12 l7 -12 l7 12 l7 -12 l7 12 l7 -12" fill="#fff" stroke="#450a0a" stroke-width="1.5"/><path d="M20 90 l6 -12 l6 12 l6 -12 l6 12 l6 -12 l6 12 l6 -12 l6 12 l6 -12" fill="#fff" stroke="#450a0a" stroke-width="1.5"/><path d="M60 68 q22 -6 40 -2 l2 10 q-22 8 -42 -2z" fill="#be123c" opacity=".95"/></g>
    <g class="lid"><path d="M12 48 Q12 12 60 12 Q108 12 108 48 Z" fill="#a85f22" stroke="#2a1505" stroke-width="3"/><path d="M12 48 Q12 24 40 16 L40 48 Z M80 16 Q108 24 108 48 L80 48 Z" fill="#4b5563" opacity=".85"/>
    <rect x="52" y="38" width="16" height="16" rx="3" fill="#fbbf24" stroke="#78350f" stroke-width="2"/><circle cx="60" cy="46" r="2.6" fill="#78350f"/>
    <g class="eyes" style="display:none"><circle cx="42" cy="32" r="5" fill="#fde047"/><circle cx="78" cy="32" r="5" fill="#fde047"/><circle cx="42" cy="32" r="2" fill="#000"/><circle cx="78" cy="32" r="2" fill="#000"/></g></g></svg>`;
}
function rollChest(p) {
  const r = RP(p);
  const w = [['gold', 38], ['coupon', r.disc ? 4 : 14], ['shield', playerShields[p] ? 4 : 14], ['cloak', 8], ['extra', 8], ['mimic', isLeader(p) ? 10 : 5]];
  let k = Rweighted(w);
  if ((k === 'coupon' && r.disc) || (k === 'shield' && playerShields[p])) k = 'gold';
  return k;
}
async function rpgChest(p, pos) {
  const r = RP(p), kind = rollChest(p);
  let amt = 0, res = '', loot = '🪙', mimic = false;
  if (kind === 'gold') {
    amt = 60 + Ri(7) * 20 + (isTrailing(p) ? 30 : 0);
    bank(p, amt); rpgShare(p, amt); rpgLucky(p);
    res = `+$${amt} gold!`; rpgLog(p, `🎁 Treasure chest: <b>+$${amt}</b> gold!`);
  } else if (kind === 'coupon') {
    r.disc = Math.max(r.disc, 0.5); rpgLucky(p); loot = '🏷️'; res = 'Black Market coupon: 50% off your next purchase!';
    rpgLog(p, '🎁 Treasure chest: a <b>50% Black Market coupon</b>!');
  } else if (kind === 'shield') {
    playerShields[p] = true; rpgLucky(p); loot = '🛡️'; res = 'A Holy Shield!'; rpgLog(p, '🎁 Treasure chest: a <b>Holy Shield</b>!');
  } else if (kind === 'cloak') {
    r.cloak = Math.max(r.cloak, 2); rpgLucky(p); loot = '👻'; res = 'Phantom Cloak (2 turns)!'; rpgLog(p, '🎁 Treasure chest: a <b>Phantom Cloak</b> for 2 turns!');
  } else if (kind === 'extra') {
    r.bonusRoll = true; rpgLucky(p); loot = '🎲'; res = 'An extra dice roll!'; rpgLog(p, '🎁 Treasure chest: an <b>extra dice roll</b> next turn!');
  } else {
    mimic = true; loot = '🦷';
    if (playerShields[p]) { playerShields[p] = false; res = 'MIMIC! Your shield absorbed the bite.'; rpgLog(p, '👹 A <b>Mimic</b> lunged — your Holy Shield took the bite!'); r.st.block++; }
    else { const l = lose(p, 70); res = `MIMIC! It bit off $${l}!`; rpgLog(p, `👹 A <b>Mimic</b> chomped <b>$${l}</b> out of your purse!`); rpgSetback(p); rpgTriggered(p, 'trap'); }
  }
  refreshAll();
  if (mimic) { sfx('mimic'); shakeBoard(true); } else sfx('chest');
  fxEmit(pos, mimic ? 'blood' : 'gold', 26);
  await stage(async c => {
    c.card.innerHTML = stHead(mimic ? 'IT WAS A TRAP' : 'TREASURE', mimic ? 'Mimic!' : 'Treasure Chest', `${playerName(p)} approaches…`) +
      `<div class="st-art"><div class="chest-rays ${mimic ? 'mimic' : ''}" id="cr"></div>${chestSVG()}<div class="chest-loot" id="cl">${loot}</div></div><div class="st-result" id="st-res" style="opacity:0">.</div>`;
    const svg = c.card.querySelector('.chest-svg');
    await c.wait(350); svg.classList.add('rattle'); await c.wait(900); svg.classList.remove('rattle');
    svg.classList.add('open');
    if (mimic) { svg.querySelector('.mimicbits').style.display = ''; svg.querySelector('.eyes').style.display = ''; c.boardShake(true); }
    $('cr').classList.add('on'); $('cl').classList.add('go');
    await c.wait(500);
    const re = $('st-res'); re.textContent = res; re.style.opacity = 1;
    await c.wait(1300);
  }, { tint: mimic ? '#be123c' : '#f59e0b', rain: mimic ? ['🦷', '💀'] : ['🪙', '✨'], shake: mimic });
  return false;
}

/* --------------------------------------------------------------- PORTAL ---- */
async function rpgPortal(p, pos) {
  if (RPG.teleHops >= 2) { floatText(pos, 'portal fizzles', '#a78bfa'); return false; }
  RPG.teleHops++;
  const lead = isLeader(p);
  const k = Rweighted([['fwd', lead ? 18 : 30], ['back', lead ? 34 : 25], ['swap', 20], ['secret', 15]]);
  const others = alive().filter(q => q !== p && playerPositions[q] !== pos && !isAllied(p, q));
  let dest = pos, res = '', kind = k, swapWith = 0, bonus = 0;
  if (k === 'fwd') { dest = nearestPlain(Math.min(98, pos + 6 + Ri(9)), 1); res = `Warped forward to tile ${dest}!`; }
  else if (k === 'back') { dest = nearestPlain(Math.max(2, pos - (4 + Ri(9))), -1); res = `Hurled back to tile ${dest}!`; rpgSetback(p); }
  else if (k === 'swap' && others.length) {
    swapWith = Rpick(others);
    const g = rpgGuard(swapWith, p, 'portal swap');
    if (g === 'hit') { dest = playerPositions[swapWith]; res = `Swapped places with ${playerName(swapWith)}!`; rpgHit(p, swapWith, 'portal'); }
    else { kind = 'fwd'; swapWith = 0; dest = nearestPlain(Math.min(98, pos + 5), 1); res = `The swap was repelled — shoved to tile ${dest}!`; }
  } else if (k === 'swap') { kind = 'fwd'; dest = nearestPlain(Math.min(98, pos + 5), 1); res = `Warped forward to tile ${dest}!`; }
  else { // secret bonus location: a random quiet corridor in the middle of the map
    const cands = []; for (let n = 30; n <= 80; n++) if (plainTile(n)) cands.push(n);
    dest = cands.length ? Rpick(cands) : pos; bonus = 120 + (isTrailing(p) ? 40 : 0); res = `Secret vault on tile ${dest}! +$${bonus}`; rpgLucky(p);
  }
  if (dest > 99) dest = 99;
  sfx('portal'); fxEmit(pos, 'magic', 30);
  await stage(async c => {
    c.card.innerHTML = stHead('MYSTERY PORTAL', 'The Portal Opens', `${playerName(p)} steps into the swirl…`) +
      `<div class="st-art"><div class="portal-art" id="pa"><div class="ring"></div><div class="ring r2"></div><div class="core"></div><div class="hero">${pieceSVG(playerClasses[p], p)}</div></div></div><div class="st-result" id="st-res" style="opacity:0">.</div>`;
    await c.wait(900); $('pa').classList.add('sucked'); await c.wait(1100);
    const re = $('st-res'); re.textContent = res; re.style.opacity = 1; await c.wait(1300);
  }, { tint: '#7c3aed', rain: ['✨', '🌀', '⭐'] });
  if (swapWith) { const t = playerPositions[p]; playerPositions[p] = playerPositions[swapWith]; playerPositions[swapWith] = t; refreshAll(0.9); }
  else movePlayerTo(p, dest, 0.9);
  rpgLog(p, `🌀 Mystery portal: <b>${res}</b>`);
  if (bonus) { bank(p, bonus); rpgShare(p, bonus); }
  fxEmit(playerPositions[p], 'magic', 22);
  await sleep(900);
  return playerPositions[p] !== pos;
}

/* ---------------------------------------------------------------- WHEEL ---- */
const WHEEL = [
  { k: 'gold200', ico: '💰', lbl: '$200', col: '#f59e0b', w: 0.7 }, { k: 'extra', ico: '🎲', lbl: 'EXTRA ROLL', col: '#16a34a', w: 1 },
  { k: 'shield', ico: '🛡️', lbl: 'SHIELD', col: '#0891b2', w: 1 }, { k: 'free', ico: '🎁', lbl: 'FREE ITEM', col: '#9333ea', w: 1 },
  { k: 'gold75', ico: '🪙', lbl: '$75', col: '#ca8a04', w: 1.3 }, { k: 'curse', ico: '🐍', lbl: 'SNAKE CURSE', col: '#be123c', w: 1 },
  { k: 'lost', ico: '⏳', lbl: 'LOST TURN', col: '#475569', w: 1 }, { k: 'gold120', ico: '💎', lbl: '$120', col: '#2563eb', w: 1 }
];
function wheelSVG() {
  const pt = (a, r) => { const t = (a - 90) * Math.PI / 180; return [100 + r * Math.cos(t), 100 + r * Math.sin(t)]; };
  let seg = '';
  WHEEL.forEach((s, i) => {
    const a0 = i * 45 - 22.5, a1 = i * 45 + 22.5, [x0, y0] = pt(a0, 96), [x1, y1] = pt(a1, 96);
    seg += `<path d="M100 100 L${x0} ${y0} A96 96 0 0 1 ${x1} ${y1} Z" fill="${s.col}" stroke="#1c1917" stroke-width="2"/>` +
      `<g transform="rotate(${i * 45} 100 100)"><text x="100" y="38" text-anchor="middle" font-size="22">${s.ico}</text><text x="100" y="55" text-anchor="middle" font-size="9" font-weight="800" fill="#fff" style="paint-order:stroke" stroke="#000" stroke-width="2">${s.lbl}</text></g>`;
  });
  return `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="99" fill="#fbbf24" stroke="#78350f" stroke-width="2"/><g class="wheel-spin" id="wspin">${seg}</g><circle cx="100" cy="100" r="15" fill="#1c1917" stroke="#fbbf24" stroke-width="3"/><circle cx="100" cy="100" r="5" fill="#fbbf24"/></svg>
  <svg class="wheel-ptr" id="wptr" viewBox="0 0 26 34"><path d="M13 34 L2 8 Q13 -4 24 8 Z" fill="#ef4444" stroke="#fff" stroke-width="2"/></svg>`;
}
async function rpgWheel(p, pos) {
  const r = RP(p);
  const idx = Rweighted(WHEEL.map((s, i) => [i, s.w])), seg = WHEEL[idx];
  let res = '', good = true;
  rpgRisk(p);
  if (seg.k === 'gold200' || seg.k === 'gold75' || seg.k === 'gold120') {
    const amt = seg.k === 'gold200' ? 200 : seg.k === 'gold120' ? 120 : 75; bank(p, amt); rpgShare(p, amt); rpgLucky(p);
    res = `${seg.ico} +$${amt}!`; if (amt >= 200) rpgAch(p, 'gambler');
  } else if (seg.k === 'extra') { r.bonusRoll = true; rpgLucky(p); res = '🎲 An extra dice roll!'; }
  else if (seg.k === 'shield') { if (playerShields[p]) { bank(p, 80); res = '🛡️ Already shielded: +$80 instead!'; } else { playerShields[p] = true; rpgLucky(p); res = '🛡️ A Holy Shield!'; } }
  else if (seg.k === 'free') { r.disc = 1; rpgLucky(p); res = '🎁 Your next Black Market item is FREE!'; }
  else if (seg.k === 'curse') { r.curse = 'snakebait'; rpgSetback(p); good = false; res = '🐍 Snake Curse! Your next bite drops 8 tiles deeper.'; }
  else { r.skip++; r.why = 'lost'; rpgSetback(p); good = false; res = '⏳ Lost turn! You will skip your next turn.'; }
  rpgLog(p, `🎡 Wheel of Fortune: <b>${res}</b>`);
  refreshAll();
  await stage(async c => {
    c.card.innerHTML = stHead('WHEEL OF FORTUNE', 'Spin!', `${playerName(p)} spins the wheel…`) + `<div class="st-art"><div class="wheel-wrap">${wheelSVG()}</div></div><div class="st-result" id="st-res" style="opacity:0">.</div>`;
    await c.wait(500);
    const spin = $('wspin'), ptr = $('wptr');
    const turns = 5, jitter = (R_vis() - .5) * 26, deg = turns * 360 + (360 - idx * 45) + jitter;
    spin.style.transform = `rotate(${deg}deg)`;
    let d = 90; const t0 = Date.now(), total = 4600 * RPG.speed;
    while (Date.now() - t0 < total && !c.skipped()) { sfx('tick'); ptr.classList.remove('tick'); void ptr.offsetWidth; ptr.classList.add('tick'); await c.wait(d); d = Math.min(420, d * 1.1); }
    if (c.skipped()) { spin.style.transition = 'none'; spin.style.transform = `rotate(${deg}deg)`; }
    sfx(good ? 'wheelwin' : 'wheellose'); if (!good) c.boardShake();
    const re = $('st-res'); re.textContent = res; re.style.opacity = 1; await c.wait(1500);
  }, { tint: good ? '#c026d3' : '#475569', rain: good ? ['🎉', '✨', '🪙'] : ['💨'] });
  fxEmit(pos, good ? 'gold' : 'dark', 24);
  return false;
}

/* ---------------------------------------------------------------- ALTAR ---- */
const BLESSINGS = [
  ['aegis', 3, '🛡️ Aegis: Holy Shield + Phantom Cloak (2 turns) + Mirror'], ['fortune', 2, '💰 Fortune: $250 poured onto the altar'],
  ['dash', 3, '🚀 Dash: carried forward ~8 tiles'], ['twin', 2, '🎲 Twin Fates: two extra dice rolls']
];
async function rpgAltar(p, pos) {
  const r = RP(p), can = playerCash[p] >= 100;
  if (!can) { rpgLog(p, '🔮 The Cursed Altar demands $100… you cannot pay, and it ignores you.'); floatText(pos, 'Need $100', '#c4b5fd'); return false; }
  const choice = await promptDecision('altar', 'AD',
    done => stage(async c => {
      c.card.innerHTML = stHead('CURSED ALTAR', 'The Altar Whispers', `Sacrifice <b>$100</b> for a powerful blessing — or refuse and risk a curse (40%).`) +
        `<div class="st-art"><div class="st-ring"></div><div class="st-ring"></div><div class="st-emoji">🔮</div></div>`;
      sfx('altar');
      const k = await stageChoice(c, [{ key: 'A', label: '🩸 Sacrifice $100', cls: 'btn-primary' }, { key: 'D', label: '🚪 Refuse', cls: 'btn-ghost' }]);
      done(k);
    }, { tint: '#7e22ce', rain: ['🔮', '✨'], hold: 0 }),
    () => (playerCash[p] >= 250 ? 'A' : 'D'));
  rpgRisk(p);
  let res, good = true, kicker = 'BLESSED';
  if (choice === 'A') {
    lose(p, 100);
    const b = Rweighted(BLESSINGS.map(x => [x[0], x[1]])), label = BLESSINGS.find(x => x[0] === b)[2];
    if (b === 'aegis') { playerShields[p] = true; r.cloak = Math.max(r.cloak, 2); r.mirror = true; }
    else if (b === 'fortune') { bank(p, 250); rpgShare(p, 250); }
    else if (b === 'dash') { const d = nearestPlain(Math.min(98, pos + 8), 1); movePlayerTo(p, d, 0.8); }
    else { r.bonusRoll = true; RPG.extraTwin = (RPG.extraTwin || 0); r.twin = true; }
    rpgLucky(p); res = label; rpgLog(p, `🔮 Cursed Altar: sacrificed $100 → <b>${label}</b>`);
  } else {
    if (R() < 0.4) {
      const k = Rpick(Object.keys(CURSES)); r.curse = k; res = `${CURSES[k].icon} Cursed: ${CURSES[k].name}! ${CURSES[k].desc}`; good = false; kicker = 'CURSED'; rpgSetback(p);
      rpgLog(p, `🔮 Cursed Altar: refused → <b>${res}</b>`);
    } else { res = '😮‍💨 The altar lets you go… this time.'; rpgLog(p, '🔮 Cursed Altar: refused and <b>escaped unharmed</b>.'); }
  }
  refreshAll();
  sfx(good ? 'wheelwin' : 'wheellose'); if (!good) shakeBoard();
  fxEmit(pos, good ? 'magic' : 'dark', 26);
  await quick({ kicker, title: choice === 'A' ? 'Blessing Granted' : (good ? 'Spared' : 'Cursed'), sub: playerName(p), emoji: good ? '✨' : '🧿', result: res, tint: good ? '#a855f7' : '#7f1d1d', rain: good ? ['✨', '🔮'] : ['🧿', '💀'], ms: 2000, shake: !good });
  await sleep(300);
  return choice === 'A' && playerPositions[p] !== pos;
}

/* ----------------------------------------------------------------- CAMP ---- */
async function rpgCamp(p, pos) {
  const r = RP(p), cured = [];
  if (playerPoisoned[p]) { playerPoisoned[p] = false; cured.push('frozen'); }
  if (r.poison > 0) { r.poison = 0; cured.push('poison'); }
  if (r.curse) { r.curse = null; cured.push('curse'); }
  if (r.slow > 0) { r.slow = 0; cured.push('slow'); }
  let shieldBack = false;
  if (!playerShields[p]) { playerShields[p] = true; shieldBack = true; }
  const gold = 30 + (isTrailing(p) ? 30 : 0); bank(p, gold);
  const parts = [...cured.map(c => `cured ${c}`), shieldBack ? 'shield restored' : '', `+$${gold}`].filter(Boolean);
  rpgLog(p, `🏕️ Rest camp: <b>${parts.join(', ')}</b>.`);
  refreshAll(); sfx('camp'); fxEmit(pos, 'heal', 22, { up: true, g: -20 });
  await quick({ kicker: 'REST CAMP', title: 'A Warm Fire', sub: playerName(p), emoji: '🏕️', result: parts.join(' · '), tint: '#16a34a', rain: ['🔥', '✨'], ms: 1500 });
  return false;
}

/* ---------------------------------------------------------------- TRAPS ---- */
function rpgDetect(p) {                            // Wizards sense hidden traps up to 6 tiles ahead (visible to everyone)
  if (!rpgOn() || playerClasses[p] !== 'wizard') return;
  let found = 0;
  for (let n = playerPositions[p] + 1; n <= Math.min(99, playerPositions[p] + 6); n++) {
    const t = RPG.tiles[n]; if (t && t.t === 'trap' && !t.rev) { t.rev = true; found++; }
  }
  if (found) { rpgLog(p, `🧙 Arcane Sight: sensed <b>${found}</b> hidden trap${found > 1 ? 's' : ''} ahead!`); rpgDecorateTiles(); if (!fastMode) toast(`🧙 ${playerName(p)} revealed ${found} trap${found > 1 ? 's' : ''}!`); }
}
async function rpgTrap(p, pos, t) {
  const r = RP(p), k = TRAP_KINDS[t.k], cls = playerClasses[p];
  const seen = !!t.rev;
  delete RPG.tiles[pos];
  t.rev = true;
  let res = '', hurt = true;
  const disarm = cls === 'human' ? R() < 0.5 : (cls === 'wizard' && seen);
  if (disarm) { const g = bank(p, 25); res = `${cls === 'wizard' ? '🧙 You sensed it and' : '🧑 You'} disarmed the ${k.name}! (+$${g} salvage)`; hurt = false; rpgLucky(p); }
  else if (playerShields[p]) { playerShields[p] = false; res = `🛡️ Your shield absorbed the ${k.name}!`; hurt = false; r.st.block++; }
  else if (r.gear === 'dragon' && r.gearN > 0) { r.gearN--; if (!r.gearN) r.gear = null; res = `🐲 Dragonscale armour shrugged off the ${k.name}!`; hurt = false; r.st.block++; }
  else if (t.k === 'spike') {
    if (cls === 'demon') { res = '😈 The spikes bounce off your hellforged skin!'; hurt = false; }
    else { const l = lose(p, 30); const to = Math.max(1, nearestPlain(pos - 3, -1)); movePlayerTo(p, to, 0.6); res = `🗡️ Spikes! −$${l} and thrown back to tile ${to}.`; }
  } else if (t.k === 'poison') {
    if (cls === 'angel') { res = '😇 Divine Grace purifies the poison cloud!'; hurt = false; }
    else { r.poison = 2; res = '☠️ Poison cloud! You lose $20 at the start of your next 2 turns.'; }
  } else if (t.k === 'steal') { const l = lose(p, Math.min(120, Math.max(40, Math.round(playerCash[p] * 0.15)))); res = `🕳️ A gold-thief pit swallowed <b>$${l}</b>!`; }
  else { if (cls === 'angel') { res = '😇 The cage cannot hold an angel!'; hurt = false; } else { r.skip++; r.why = 'jail'; res = '⛓️ Iron cage! You lose your next turn.'; } }
  rpgLog(p, `❓ Hidden <b>${k.name}</b>: ${res}`);
  rpgDecorateTiles(); refreshAll();
  if (hurt) { rpgTriggered(p, 'trap'); r.st.trapsHit++; }
  sfx(hurt ? 'trap' : 'camp'); if (hurt) { shakeBoard(); fxEmit(pos, t.k === 'poison' ? 'dark' : 'boom', 22); }
  await quick({ kicker: hurt ? 'HIDDEN TRAP' : 'TRAP AVOIDED', title: k.name, sub: playerName(p), emoji: k.icon, result: res, tint: hurt ? '#be123c' : '#16a34a', rain: [k.icon], ms: 1700, shake: hurt });
  return hurt && t.k === 'spike' && playerPositions[p] !== pos;
}
