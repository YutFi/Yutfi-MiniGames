
/* ============================================================
   BOSSES — Ice Titan (33), Ancient Dragon (56), Lich King (82)
   A boss blocks the road: you stop on its tile and trade up to 3 exchanges of blows.
   Boss health is SHARED, so every visit chips it down for everyone. Dice come from the shared PRNG.
   ============================================================ */
const BOSS_ATK = { ice: 0, dragon: 1, lich: 1 };
const BOSS_LOOT = { ice: { gold: 150, gear: 'frost' }, dragon: { gold: 220, gear: 'dragon' }, lich: { gold: 300, gear: 'reaver' } };
const HERO_HP = 12;

async function rpgBossTile(p, pos, t) {
  const bs = RPG.boss[t.k], b = BOSSES[t.k];
  if (!bs.alive) return false;
  const r = RP(p), cls = playerClasses[p];
  const firstVisit = !bs.seen; bs.seen = true;
  const hp0 = bs.hp, steps = [];
  let hero = HERO_HP, killed = false, fell = false;
  for (let i = 0; i < 3 && !killed && !fell; i++) {
    const d = Rd6();
    const crit = d === 6 || (cls === 'human' && d === 5);
    const dmg = d + (cls === 'wizard' || cls === 'demon' ? 1 : 0) + (crit ? 3 : 0);
    bs.hp = Math.max(0, bs.hp - dmg);
    bs.dmg[p] = (bs.dmg[p] || 0) + dmg;
    const st = { d, crit, dmg, bossHp: bs.hp, bd: 0, absorbed: false, heroHp: hero };
    if (bs.hp <= 0) { killed = true; steps.push(st); break; }
    let bd = Math.max(1, Rd6() + BOSS_ATK[t.k] - (cls === 'angel' ? 1 : 0));
    if (playerShields[p]) { playerShields[p] = false; st.absorbed = true; r.st.block++; bd = 0; }
    hero -= bd; st.bd = bd; st.heroHp = Math.max(0, hero);
    steps.push(st);
    if (hero <= 0) fell = true;
  }
  const total = hp0 - bs.hp;
  const name = playerName(p);
  let outcome, reward = 0, gear = null, text = '';
  if (killed) {
    outcome = 'win'; bs.alive = false;
    const loot = BOSS_LOOT[t.k];
    reward = bank(p, loot.gold); rpgShare(p, loot.gold);
    r.gear = loot.gear; r.gearN = GEAR[loot.gear].n; gear = loot.gear;
    rpgLucky(p);
    if (t.k === 'dragon') rpgAch(p, 'slayer');
    // everyone who bled the boss shares a little of the spoils (the bank pays, bounded by the boss's health)
    Object.keys(bs.dmg).map(Number).filter(q => q !== p && !RP(q).out).forEach(q => { const g = bank(q, Math.min(60, bs.dmg[q] * 3)); if (g) rpgLog(q, `🏴 ${playerName(q)} shares the spoils of the ${b.name}: <b>+$${g}</b>.`); });
    text = `${name} slew the ${b.name}! +$${reward} and ${GEAR[loot.gear].icon} ${GEAR[loot.gear].name}`;
  } else if (fell) {
    outcome = 'lose';
    const l = lose(p, 60);
    const to = nearestPlain(pos - 6, -1);
    playerPositions[p] = to; rpgSetback(p); r.st.trapsHit++;
    const g = bank(p, Math.min(40, total * 3));
    text = `${name} was defeated by the ${b.name}! −$${l}, thrown back to tile ${to}.`;
  } else {
    outcome = 'push';
    const g = bank(p, Math.min(50, total * 3)); reward = g;
    const to = nearestPlain(pos - 1, -1);
    playerPositions[p] = to; rpgSetback(p);
    text = `${name} wounded the ${b.name} (${bs.hp}/${bs.max} HP left) but is driven back to tile ${to}. +$${g}`;
  }
  rpgLog(p, `${b.icon} <b>Boss fight:</b> ${text}`);
  if (fell && RPG.cfg.lives) rpgLoseLife(p, 'the ' + b.name);
  rpgDecorateTiles(); refreshAll();
  if (fastMode) return outcome !== 'win';
  // ---- the cinematic (purely visual: everything above has already happened) ----
  const gid = gameId;
  sfx('boss'); shakeBoard(true); fxEmit(pos, t.k === 'ice' ? 'ice' : t.k === 'dragon' ? 'fire' : 'dark', 30);
  await stage(async c => {
    c.card.innerHTML = stHead(firstVisit ? b.cry : 'BOSS BATTLE', `${b.icon} ${b.name}`, firstVisit ? `${name} stands against the ${b.name}!` : `${name} returns to the fight`) +
      `<div class="arena" style="--tint:${b.tint}">
         <div class="fighter" id="fH"><div class="fig">${pieceSVG(cls, p)}</div><div class="hpbar"><i id="hpH"></i></div><div class="hp-lbl" id="hpHl">${HERO_HP}/${HERO_HP}</div></div>
         <div class="arena-vs">VS</div>
         <div class="fighter boss" id="fB" style="--tint:${b.tint}"><div class="fig">${b.icon}</div><div class="hpbar boss"><i id="hpB"></i></div><div class="hp-lbl" id="hpBl">${hp0}/${bs.max}</div></div>
       </div><div class="boss-banner" id="bb"></div>`;
    const pct = (v, m) => Math.max(0, v / m * 100) + '%';
    $('hpB').style.width = pct(hp0, bs.max);
    const pop = (side, txt, crit) => { const a = c.card.querySelector('.arena'); const d = document.createElement('div'); d.className = 'float-text dmg' + (crit ? ' crit' : ''); d.style.left = side === 'B' ? '74%' : '24%'; d.style.color = crit ? '#fde047' : '#fb7185'; d.textContent = txt; a.appendChild(d); setTimeout(() => d.remove(), 1200); };
    await c.wait(firstVisit ? 1400 : 700);
    for (const s of steps) {
      if (c.skipped()) break;
      $('fH').classList.remove('lunge-r', 'hit'); $('fB').classList.remove('lunge-l', 'hit'); void $('fH').offsetWidth;
      $('fH').classList.add('lunge-r'); await c.wait(260);
      $('fB').classList.add('hit'); pop('B', '-' + s.dmg + (s.crit ? '!' : ''), s.crit); sfx(s.crit ? 'crit' : 'hit');
      if (s.crit) c.boardShake();
      $('hpB').style.width = pct(s.bossHp, bs.max); $('hpBl').textContent = `${s.bossHp}/${bs.max}`;
      await c.wait(700);
      if (s.bossHp <= 0) break;
      $('fB').classList.add('lunge-l'); await c.wait(260);
      if (s.absorbed) { pop('H', '🛡️ blocked', false); sfx('camp'); }
      else { $('fH').classList.add('hit'); pop('H', '-' + s.bd, false); sfx('hit'); c.boardShake(); }
      $('hpH').style.width = pct(s.heroHp, HERO_HP); $('hpHl').textContent = `${s.heroHp}/${HERO_HP}`;
      if (s.heroHp / HERO_HP < .35) $('hpH').parentNode.classList.add('low');
      await c.wait(650);
    }
    const bb = $('bb');
    if (outcome === 'win') { $('fB').classList.add('dead'); sfx('bossdown'); bb.className = 'boss-banner win'; bb.textContent = 'VICTORY!'; fxEmit(pos, 'gold', 40); }
    else if (outcome === 'lose') { $('fH').classList.add('dead'); sfx('defeat'); bb.className = 'boss-banner lose'; bb.textContent = RPG.cfg.lives && RP(p).out ? 'YOU HAVE FALLEN' : 'DEFEATED'; }
    else { bb.className = 'boss-banner'; bb.style.color = '#fde68a'; bb.textContent = 'DRIVEN BACK'; }
    $('st-sub').innerHTML = text;
    await c.wait(2200);
  }, { tint: b.tint, rain: [b.icon, '✨'], shake: true, hold: 200 });
  return outcome !== 'win';
}

/* ---- power-ups (roll a 6) and the bot's shopping list also pass through the Cloak / Mirror / ally guard ---- */
const applyPowerUpOriginal = applyPowerUp;
applyPowerUp = function (player, type, target) {
  if (rpgOn() && (type === 'swap' || type === 'freeze')) {
    const opp = target || defaultTarget(player);
    if (opp && opp !== player && !RP(opp).out) {
      const g = rpgGuard(opp, player, type);
      if (g !== 'hit') { if (g === 'reflect') rpgBacklash(player, opp, type); refreshAll(); return Promise.resolve(); }
      const done = applyPowerUpOriginal(player, type, target);
      if (!(type === 'freeze' && playerClasses[opp] === 'angel')) rpgHit(player, opp, type);
      return done;
    }
  }
  return applyPowerUpOriginal(player, type, target);
};

const aiChooseItemOriginal = aiChooseItem;
aiChooseItem = function () {
  if (rpgOn()) { const k = rpgAiItem(); if (k) return k; }
  return aiChooseItemOriginal();
};
function rpgAiItem() {
  const me = 2, op = 1, r = RP(me), pos = playerPositions[me], cash = playerCash[me];
  if (!marketOpen() || r.out || RP(op).out) return null;
  const ok = k => !itemStatus(me, k) && cash >= getCost(me, k) && !itemUsable(me, k, op);
  if (ok('rewind') && r.lastFrom - pos >= 8) return 'rewind';
  const snakeAhead = Object.keys(SNAKES).some(s => { s = +s; return s > pos && s <= pos + 6 && customSnakeOwner[s] !== me; });
  if (ok('hook') && snakeAhead && !playerBribes[me] && !playerShields[me]) return 'hook';
  if (ok('loaded') && 100 - pos <= 6) return 'loaded';
  if (ok('lightning') && playerCash[op] >= 120 && cash >= 300) return 'lightning';
  if (ok('cloak') && pos > playerPositions[op] + 8 && cash >= 350 && Math.random() < 0.3) return 'cloak';
  if (ok('mirror') && cash >= 300 && playerCash[op] >= 200 && Math.random() < 0.15) return 'mirror';
  if (ok('bounty') && cash >= 350 && Math.random() < 0.2) return 'bounty';
  return null;
}

/* ---- win screen extras: titles and achievements earned this match (cosmetic) ---- */
function rpgWinExtras() {
  let box = $('win-extra');
  if (!box) { box = document.createElement('div'); box.id = 'win-extra'; box.className = 'text-xs text-slate-300 mt-2'; $('win-subtitle').after(box); }
  if (!rpgOn()) { box.innerHTML = ''; return; }
  box.innerHTML = PLAYERS().map(p => {
    const t = titleOf(p), a = Object.keys(RP(p).ach).map(k => ACH[k].icon + ' ' + ACH[k].name).join(' · ');
    return `<div style="margin-top:4px"><b>${playerName(p)}</b>${t ? ' — ' + t : ''}${a ? '<br><span style="opacity:.85">' + a + '</span>' : ''}</div>`;
  }).join('');
}
