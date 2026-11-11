
/* ============================================================
   RPG LAYER 6/6 — rounds, world events, Wanted, the Arena (duel / competition / alliance / betrayal), turn bookkeeping
   ============================================================ */
const WORLD_LINES = {};   // filled per event so the cinematic can list who was affected

/* a "round" is one full pass of the table. Everything below runs inside switchTurn(), the same way on every client. */
function rpgRoundTick() {
  if (!rpgOn()) return false;
  RPG.round++;
  const M = RPG.mods; ['snake', 'storm', 'fest', 'sal'].forEach(k => { if (M[k] > 0) M[k]--; });
  // alliances run out
  RPG.allies = RPG.allies.filter(a => {
    if (RPG.round < a.exp || RP(a.a).out || RP(a.b).out) return true;
    rpgLog(a.a, `🤝 The alliance between ${playerName(a.a)} and ${playerName(a.b)} has <b>ended</b>.`);
    RP(a.a).allyCd = RP(a.b).allyCd = RPG.round + 2; return false;
  });
  if (RPG.cfg.rounds && RPG.round > RPG.cfg.rounds) return true;       // Richest Wins is over
  if (RPG.mode === 'survival' || RPG.cfg.danger) rpgDangerTick();
  rpgWantedTick();
  if (RPG.round % 5 === 0) { rpgRespawnTraps(); rpgDecorateTiles(); }
  if (RPG.round >= RPG.nextEv) rpgWorldEvent();
  return false;
}

function rpgDangerTick() {
  RPG.danger++;
  const toll = RPG.danger * 4, hit = [];
  alive().forEach(p => {
    const l = lose(p, toll);
    if (l < toll) { hit.push(p); }
  });
  rpgLog(alive()[0] || 1, `🔥 Survival: the dungeon takes <b>$${toll}</b> from every hero (danger ${RPG.danger}).`);
  hit.forEach(p => { rpgLog(p, `🔥 ${playerName(p)} cannot pay the toll and loses a life!`); rpgLoseLife(p, 'the dungeon'); });
  refreshAll();
}

function rpgEliminate(p, why) {
  const r = RP(p); if (r.out) return;
  r.out = true; r.lives = 0;
  rpgLog(p, `☠️ <b>${playerName(p)}</b> has fallen${why ? ' to ' + why : ''} and is out of the match!`);
  if (!fastMode) { sfx('defeat'); fxEmit(playerPositions[p], 'dark', 30); }
  const a = allyOf(p); if (a) RPG.allies = RPG.allies.filter(x => x.a !== p && x.b !== p);
  if (RPG.wanted === p) RPG.wanted = 0;
  Object.values(RPG.p).forEach(x => { if (x.contract && x.contract.on === p) x.contract = null; });
  refreshAll();
  const A = alive();
  if (A.length === 1 && NP > 1 && !gameOver) showWinModal(A[0], 'the last hero standing');
}
function rpgLoseLife(p, why) {
  const r = RP(p); if (r.out) return;
  if (!RPG.cfg.lives) return;
  r.lives--;
  if (r.lives <= 0) rpgEliminate(p, why);
  else rpgLog(p, `❤️ ${playerName(p)} has <b>${r.lives}</b> ${r.lives === 1 ? 'life' : 'lives'} left.`);
}

/* ---- Wanted: whoever runs far ahead becomes a bounty target ---- */
function rpgWantedTick() {
  const A = alive();
  if (A.length < 2) { RPG.wanted = 0; return; }
  const lead = A.reduce((a, b) => (playerPositions[b] > playerPositions[a] ? b : a));
  const second = Math.max(...A.filter(q => q !== lead).map(q => playerPositions[q]));
  if (RPG.wanted) {
    if (RP(RPG.wanted).out || playerPositions[RPG.wanted] < second + 3 || RPG.round - RPG.wantedAt >= 6) {
      rpgLog(RPG.wanted, `🎯 The bounty on ${playerName(RPG.wanted)} has been <b>lifted</b>.`); RPG.wanted = 0; RPG.wantedCd = RPG.round + 4;
    }
  } else if (RPG.round >= RPG.wantedCd && playerPositions[lead] - second >= 12 && playerPositions[lead] >= 15) {
    RPG.wanted = lead; RPG.wantedAt = RPG.round; RPG.wantedHits = 0;
    rpgLog(lead, `🎯 <b>${playerName(lead)} is WANTED!</b> Sabotage them to collect a bounty.`);
    sfx('bounty');
    quick({ kicker: 'BOUNTY POSTED', title: 'WANTED', sub: `${playerName(lead)} runs too far ahead…`, emoji: '🎯', result: 'Sabotage them for $75 (3 times, 3 rounds apart)', tint: '#dc2626', rain: ['🎯', '💰'], ms: 1700 });
  }
}

/* ---- world events (rolled by the shared PRNG at the start of a round) ---- */
function rpgWorldEvent() {
  const C = RPG.cfg;
  let pool = Object.keys(WORLD_EVENTS).filter(k => k !== RPG.ev);
  if (C.harmful) pool = pool.filter(k => !WORLD_EVENTS[k].good);
  const key = Rpick(pool), E = WORLD_EVENTS[key], M = RPG.mods, A = alive(), lines = [];
  RPG.ev = key; RPG.evCount++;
  RPG.nextEv = RPG.round + C.evMin + Ri(C.evMax - C.evMin + 1);
  if (key === 'goldrush') { A.forEach(p => { const g = bank(p, 50); lines.push(`${playerName(p)} +$${g}`); }); }
  else if (key === 'awaken') { M.snake = 2; lines.push('Every snake bites 4 tiles deeper (2 rounds)'); }
  else if (key === 'blessing') { A.forEach(p => { playerShields[p] = true; }); lines.push('Holy Shield for every hero'); }
  else if (key === 'storm') { M.storm = 1; lines.push('Rolls above 4 count as 4 this round'); }
  else if (key === 'festival') { M.fest = 2; lines.push('Black Market prices −30% (2 rounds)'); }
  else if (key === 'wrath') {
    const v = Rpick(A);
    if (playerShields[v]) { playerShields[v] = false; RP(v).st.block++; lines.push(`${playerName(v)}'s shield melts, saving their gold`); }
    else { const l = lose(v, 100); rpgSetback(v); lines.push(`${playerName(v)} is scorched for $${l}`); }
  } else if (key === 'lucky') { A.forEach(p => { RP(p).bonusRoll = true; }); lines.push('Everyone earns an extra roll'); }
  else if (key === 'frozenk') {
    A.forEach(p => {
      const hit = R() < 0.4;
      if (hit && playerClasses[p] !== 'angel' && !playerPoisoned[p]) { playerPoisoned[p] = true; rpgSetback(p); lines.push(`${playerName(p)} freezes solid`); }
    });
    if (!lines.length) lines.push('The chill passes… everyone is spared');
  } else if (key === 'salary') { M.sal = 3; lines.push('Salaries ×2 for 3 rounds'); }
  else if (key === 'chaosday') {
    A.forEach(p => {
      const gold = R() < 0.5;
      if (playerShields[p]) { playerShields[p] = false; RP(p).st.block++; lines.push(`${playerName(p)}'s shield absorbs the chaos`); return; }
      if (gold || playerPositions[p] < 8) { const l = lose(p, 40); lines.push(`${playerName(p)} −$${l}`); }
      else { const to = nearestPlain(playerPositions[p] - 3, -1); playerPositions[p] = to; lines.push(`${playerName(p)} thrown back to ${to}`); }
      rpgSetback(p);
    });
  }
  rpgLog(A[0] || 1, `${E.icon} <b>World event: ${E.name}</b> — ${E.sub}${lines.length ? ' (' + lines.join('; ') + ')' : ''}`);
  refreshAll();
  if (!fastMode) {
    sfx(E.good ? 'event' : 'evbad');
    stage(async c => {
      c.card.innerHTML = stHead(E.good ? 'WORLD EVENT' : 'WORLD EVENT · DANGER', E.name, E.sub) +
        `<div class="st-art"><div class="st-ring"></div><div class="st-ring"></div><div class="st-ring"></div><div class="st-emoji">${E.icon}</div></div>` +
        `<div class="st-result" style="font-size:clamp(12px,3.4vw,16px);line-height:1.5">${lines.slice(0, 5).join('<br>')}</div>`;
      if (!E.good) c.boardShake(true);
      await c.wait(2300);
    }, { tint: E.tint, rain: [E.icon, '✨'], shake: !E.good });
  }
}

/* ---- per-turn bookkeeping ---- */
function rpgTurnEnd(me) {
  if (!rpgOn()) return;
  const r = RP(me);
  if (r.hurt) { r.st.streak = 0; r.hurt = false; } else { r.st.streak++; if (r.st.streak >= 6) rpgAch(me, 'unstoppable'); }
  const lead = leaderPos();
  alive().forEach(q => { RP(q).behind = Math.max(RP(q).behind, lead - playerPositions[q]); });
}
function rpgOnWin(p) {
  if (!rpgOn()) return;
  const r = RP(p); r.st.won = true;
  if (r.behind >= 25) rpgAch(p, 'comeback');
}
function rpgLap(p) {                                  // Richest Wins: reaching 100 pays out and starts a new lap
  const g = bank(p, 400);
  RP(p).laps = (RP(p).laps || 0) + 1;
  rpgLog(p, `💎 ${playerName(p)} completes a lap: <b>+$${g}</b> — back to tile 1 for another run!`);
  movePlayerTo(p, 1, 0.9);
  fxEmit(100, 'gold', 40); sfx('chest');
  return quick({ kicker: 'RICHEST WINS', title: 'Lap Complete', sub: playerName(p), emoji: '💎', result: `+$${g} · running again`, tint: '#0ea5e9', rain: ['💎', '🪙'], ms: 1600 });
}
function rpgEndByRounds() {
  const A = alive().slice().sort((a, b) => playerCash[b] - playerCash[a] || playerPositions[b] - playerPositions[a]);
  showWinModal(A[0], `the richest hero after ${RPG.cfg.rounds} rounds`);
}

/* ============================================================
   ARENA — one action per turn, before you roll
   Tokens: d+target = duel, e = treasure competition, a+target = alliance offer, v = betray your ally.
   Dice come from the shared PRNG, so every client sees the same result.
   ============================================================ */
const ARENA_CODE = { duel: 'd', comp: 'e', offer: 'a', betray: 'v' };
const ARENA_BY_CODE = { d: 'duel', e: 'comp', a: 'offer', v: 'betray' };
const ARENA_TARGETED = { duel: true, comp: false, offer: true, betray: false };

function arenaWhy(kind, me, t) {              // reason an arena action is unavailable ('' = fine)
  if (!rpgOn()) return 'only in RPG modes';
  const r = RP(me);
  if (r.out) return 'you have fallen';
  if (RPG.actionUsed) return 'one arena action per turn';
  if (kind === 'duel') {
    if (!t || t === me || RP(t).out) return 'pick a rival';
    if (isAllied(me, t)) return 'not against your ally';
    if (playerCash[me] < 50) return 'you need $50';
    if (playerCash[t] < 50) return `${playerName(t)} cannot match the $50 stake`;
    if (RPG.round - r.duelAt < 3) return `wait ${3 - (RPG.round - r.duelAt)} round(s)`;
    return '';
  }
  if (kind === 'comp') {
    if (RPG.round - RPG.compAt < 6) return `held recently — again in ${6 - (RPG.round - RPG.compAt)} round(s)`;
    const n = alive().filter(q => playerCash[q] >= 30).length;
    if (n < 2) return 'needs two heroes with $30';
    if (playerCash[me] < 30) return 'you need $30';
    return '';
  }
  if (kind === 'offer') {
    if (!t || t === me || RP(t).out) return 'pick a rival';
    if (allyOf(me)) return 'you already have an ally';
    if (allyOf(t)) return `${playerName(t)} is already allied`;
    if (RPG.round < r.allyCd) return 'recently betrayed or dissolved — wait';
    if (RPG.round < RP(t).allyCd) return `${playerName(t)} is not ready for a pact`;
    return '';
  }
  if (kind === 'betray') {
    const a = RPG.allies.find(x => x.a === me || x.b === me);
    if (!a) return 'you have no ally';
    if (RPG.round <= a.since) return 'the pact is too fresh';
    return '';
  }
  return 'unknown';
}

function openArena() {
  if (!rpgOn() || isRolling || gameOver || isBot(currentPlayer) || !canAct()) return;
  const me = currentPlayer, list = $('arena-list'); list.innerHTML = '';
  const row = (kind, icon, name, desc, t) => {
    const why = arenaWhy(kind, me, t), b = document.createElement('button');
    b.className = 'arena-opt'; b.disabled = !!why;
    b.innerHTML = `<span class="ai">${icon}</span><span><b>${name}${t ? ' — ' + playerName(t) : ''}</b><small>${why ? '🔒 ' + why : desc}</small></span>`;
    b.onclick = () => { closeModal('arena-modal'); commitArena(kind, t || 0); };
    list.appendChild(b);
  };
  const rs = rivals(me);
  (rs.length ? rs : [0]).forEach(t => row('duel', '⚔️', 'Magical Duel', 'Stake $50 each. Higher die wins the pot (wizards roll +1).', t));
  row('comp', '🏆', 'Treasure Competition', 'Everyone with $30 antes in; the highest die takes the pot plus a $60 bonus.', 0);
  (rs.length ? rs : [0]).forEach(t => row('offer', '🤝', 'Propose Alliance', '3 rounds: shared rewards, you cover each other, no friendly fire…', t));
  if (allyOf(me)) row('betray', '🗡️', 'Betray your ally', `Steal up to $80 from ${playerName(allyOf(me))}. The pact breaks and you become a Villain.`, 0);
  openModal('arena-modal');
}
function commitArena(kind, t) {
  if (NET.on && !canAct()) return;
  if (arenaWhy(kind, currentPlayer, t)) return;
  if (NET.on) netPush(ARENA_CODE[kind] + (ARENA_TARGETED[kind] ? tchar(t) : ''));
  rpgArena(kind, t, false);
}

async function rpgArena(kind, t, fromLog) {
  const me = currentPlayer, gid = gameId;
  if (arenaWhy(kind, me, t)) return;               // identical check on every client: a refused action is skipped everywhere
  RPG.fromLog = !!fromLog; RPG.actionUsed = true;
  const wasRolling = isRolling;
  isRolling = true; updateControls();
  try {
    if (kind === 'duel') await arenaDuel(me, t);
    else if (kind === 'comp') await arenaComp(me);
    else if (kind === 'offer') await arenaOffer(me, t);
    else if (kind === 'betray') await arenaBetray(me);
  } finally {
    if (gid === gameId) { isRolling = wasRolling; updateControls(); refreshAll(); }
  }
}

const dieBonus = p => (playerClasses[p] === 'wizard' ? 1 : 0);
async function arenaDuel(me, t) {
  const g = rpgGuard(t, me, 'duel');
  if (g !== 'hit') {
    if (g === 'reflect') rpgBacklash(me, t, 'duel');
    await quick({ kicker: 'DUEL REFUSED', title: g === 'reflect' ? 'Reflected!' : 'Blocked', sub: `${playerName(me)} → ${playerName(t)}`, emoji: g === 'reflect' ? '🪞' : '👻', tint: '#6366f1', ms: 1300 });
    return;
  }
  RP(me).duelAt = RPG.round;
  let a, b, tries = 0;
  do { a = Rd6() + dieBonus(me); b = Rd6() + dieBonus(t); tries++; } while (a === b && tries < 4);
  const win = a > b ? me : (b > a ? t : 0), lose_ = win === me ? t : me;
  let text;
  if (win) {
    const amt = Math.min(50, playerCash[lose_]); lose(lose_, amt); bank(win, amt);
    text = `${playerName(win)} wins <b>$${amt}</b>!`; rpgHit(win, lose_, 'duel'); rpgLucky(win);
  } else text = 'A draw — both keep their gold.';
  rpgLog(me, `⚔️ Magical Duel: ${playerName(me)} <b>${a}</b> vs ${playerName(t)} <b>${b}</b> — ${text}`);
  refreshAll();
  if (fastMode) return;
  sfx('duel');
  await stage(async c => {
    c.card.innerHTML = stHead('MAGICAL DUEL', 'Duel!', `${playerName(me)} challenges ${playerName(t)} · $50 stake`) +
      `<div class="duel-row"><div class="duel-side" id="dA"><div style="width:60px;margin:auto">${pieceSVG(playerClasses[me], me)}</div>${playerName(me)}<div class="arena-die" id="dieA">?</div></div>
       <div class="arena-vs">VS</div>
       <div class="duel-side" id="dB"><div style="width:60px;margin:auto">${pieceSVG(playerClasses[t], t)}</div>${playerName(t)}<div class="arena-die" id="dieB">?</div></div></div>
       <div class="st-result" id="st-res" style="opacity:0">.</div>`;
    await c.wait(900); $('dieA').textContent = a; sfx('hit'); await c.wait(750); $('dieB').textContent = b; sfx('hit'); await c.wait(500);
    if (win) { $(win === me ? 'dA' : 'dB').classList.add('win'); $(win === me ? 'dB' : 'dA').classList.add('lose'); sfx('crit'); }
    const re = $('st-res'); re.innerHTML = text; re.style.opacity = 1; await c.wait(1400);
  }, { tint: '#e11d48', rain: ['⚔️', '✨'] });
  if (win) fxEmit(playerPositions[win], 'gold', 20);
}

async function arenaComp(me) {
  RPG.compAt = RPG.round;
  const P = alive().filter(q => playerCash[q] >= 30);
  P.forEach(q => lose(q, 30));
  const pot = P.length * 30 + 60;
  let cands = P.slice(), rolls = {}, tries = 0;
  P.forEach(q => { rolls[q] = Rd6() + dieBonus(q); });
  while (tries < 3) {
    const top = Math.max(...cands.map(q => rolls[q]));
    cands = cands.filter(q => rolls[q] === top);
    if (cands.length === 1) break;
    cands.forEach(q => { rolls[q] = Rd6() + dieBonus(q); }); tries++;
  }
  const share = Math.floor(pot / cands.length);
  cands.forEach(q => { bank(q, share); rpgLucky(q); rpgShare(q, share); });
  const names = cands.map(playerName).join(' & ');
  rpgLog(me, `🏆 Treasure Competition (${P.map(q => playerName(q) + ' ' + rolls[q]).join(', ')}) — <b>${names}</b> take${cands.length === 1 ? 's' : ''} <b>$${share}</b>${cands.length > 1 ? ' each' : ''}!`);
  refreshAll();
  if (fastMode) return;
  sfx('chest');
  await stage(async c => {
    c.card.innerHTML = stHead('TREASURE COMPETITION', 'High Roll Wins', `Pot: $${pot}`) +
      `<div class="duel-row" style="flex-wrap:wrap">${P.map(q => `<div class="duel-side" id="cp${q}"><div style="width:48px;margin:auto">${pieceSVG(playerClasses[q], q)}</div>${playerName(q)}<div class="arena-die" id="cd${q}" style="width:44px;height:44px;font-size:24px">?</div></div>`).join('')}</div>
       <div class="st-result" id="st-res" style="opacity:0">.</div>`;
    await c.wait(700);
    for (const q of P) { $('cd' + q).textContent = rolls[q]; sfx('hit'); await c.wait(450); }
    cands.forEach(q => $('cp' + q).classList.add('win')); P.filter(q => !cands.includes(q)).forEach(q => $('cp' + q).classList.add('lose'));
    sfx('wheelwin'); const re = $('st-res'); re.innerHTML = `${names} · $${share}`; re.style.opacity = 1; await c.wait(1500);
  }, { tint: '#f59e0b', rain: ['🏆', '🪙'] });
}

async function arenaOffer(me, t) {
  if (RP(t).cloak > 0) { await quick({ kicker: 'ALLIANCE', title: 'Unreachable', sub: `${playerName(t)} is cloaked`, emoji: '👻', tint: '#6366f1', ms: 1200 }); return; }
  rpgLog(me, `🤝 ${playerName(me)} offers <b>${playerName(t)}</b> an alliance.`);
  const ans = await promptDecision('ally', 'gx',
    done => stage(async c => {
      c.card.innerHTML = stHead('ALLIANCE OFFER', 'A Pact?', `${playerName(me)} proposes a 3-round alliance with you, ${playerName(t)}.`) +
        `<div class="st-art"><div class="st-ring"></div><div class="st-emoji">🤝</div></div><div class="st-hint" style="position:static;margin-top:6px">Allies share rewards and cover each other — but a pact can be broken.</div>`;
      sfx('ally');
      const k = await stageChoice(c, [{ key: 'g', label: '🤝 Accept', cls: 'btn-primary' }, { key: 'x', label: '✋ Decline', cls: 'btn-ghost' }]);
      done(k);
    }, { tint: '#16a34a', rain: ['🤝', '✨'], hold: 0 }),
    () => (playerPositions[t] + 8 < playerPositions[me] || Math.random() < 0.4 ? 'g' : 'x'), t);
  if (ans === 'g') {
    RPG.allies.push({ a: me, b: t, since: RPG.round, exp: RPG.round + 3 });
    RP(me).allyGuard = 1; RP(t).allyGuard = 1;
    rpgLog(me, `🤝 <b>${playerName(me)} and ${playerName(t)} are now allies</b> for 3 rounds!`);
    refreshAll(); sfx('ally');
    await quick({ kicker: 'ALLIANCE FORMED', title: 'Allies', sub: `${playerName(me)} 🤝 ${playerName(t)}`, emoji: '🤝', result: '3 rounds · share rewards · cover each other', tint: '#16a34a', rain: ['🤝', '✨'], ms: 1700 });
  } else {
    rpgLog(t, `✋ ${playerName(t)} <b>declined</b> the alliance.`);
    await quick({ kicker: 'ALLIANCE', title: 'Declined', sub: `${playerName(t)} refuses ${playerName(me)}`, emoji: '✋', tint: '#64748b', ms: 1100 });
  }
}

async function arenaBetray(me) {
  const ally = allyOf(me);
  RPG.allies = RPG.allies.filter(x => x.a !== me && x.b !== me);
  const amt = Math.min(80, playerCash[ally]); lose(ally, amt); bank(me, amt);
  const r = RP(me); r.st.sab += 2; r.allyCd = RPG.round + 4; RP(ally).allyCd = RPG.round + 2;
  rpgHit(me, ally, 'betrayal');
  rpgLog(me, `🗡️ <b>${playerName(me)} BETRAYED ${playerName(ally)}</b> and stole <b>$${amt}</b>!`);
  refreshAll();
  if (fastMode) return;
  sfx('betray'); shakeBoard(true); fxEmit(playerPositions[ally], 'blood', 28);
  await quick({ kicker: 'BETRAYAL', title: 'Backstab!', sub: `${playerName(me)} turns on ${playerName(ally)}`, emoji: '🗡️', result: `−$${amt} · the pact is broken`, tint: '#7f1d1d', rain: ['🗡️', '💀'], ms: 1800, shake: 'big' });
}

/* the bot's occasional arena move (single-device play only) */
async function aiArena() {
  const me = currentPlayer;
  if (!rpgOn() || RPG.actionUsed || NET.on) return;
  const t = rpgTarget(me) || rivals(me)[0];
  if (allyOf(me) && !arenaWhy('betray', me) && playerCash[allyOf(me)] >= 250 && Math.random() < 0.4) { await rpgArena('betray', 0, false); return; }
  if (!arenaWhy('duel', me, t) && playerCash[me] >= 160 && Math.random() < 0.25) { await rpgArena('duel', t, false); return; }
  if (!arenaWhy('comp', me) && Math.random() < 0.2) { await rpgArena('comp', 0, false); }
}
