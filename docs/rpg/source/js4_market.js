
/* ============================================================
   RPG LAYER 5/6 — Black Market additions, roll modifiers, snake/ladder rules
   ============================================================ */
const GEAR = {
  frost:  { icon: '🧊', name: 'Frost Armor',  desc: 'Shatters to block the next freeze.', n: 1 },
  dragon: { icon: '🐲', name: 'Dragonscale',  desc: 'Shrugs off the next 2 hidden traps.', n: 2 },
  reaver: { icon: '🗡️', name: 'Soul Reaver',  desc: 'Your next 2 hits on a rival steal $40.', n: 2 }
};

// the new Black Market items (the six originals above are untouched)
Object.assign(SHOP_ITEMS, {
  rewind:    { icon: '⏪', name: 'Time Rewind',        desc: 'Undo a setback: return to where you stood before your last roll.',                cost: 150, accent: '#22d3ee', rpg: true },
  mirror:    { icon: '🪞', name: 'Mirror Curse',       desc: 'The next hostile action against you is reflected back at the attacker.',         cost: 120, accent: '#c084fc', rpg: true },
  loaded:    { icon: '🎲', name: 'Loaded Dice',        desc: 'Pick your next roll yourself. One use per match.',                                cost: 200, accent: '#fbbf24', rpg: true },
  cloak:     { icon: '👻', name: 'Phantom Cloak',      desc: 'Rivals cannot target you with anything for 2 turns.',                             cost: 160, accent: '#a5b4fc', rpg: true },
  hook:      { icon: '🪝', name: 'Snakeslayer Hook',   desc: 'Slay the next snake you meet: no slide, +$40. Destroys a summoned serpent trap.', cost: 130, accent: '#a3e635', rpg: true },
  bounty:    { icon: '🎯', name: 'Bounty Contract',    desc: 'Pick a rival: earn $70 (twice, 5 rounds) when they hit a snake, mine or trap.',   cost: 100, accent: '#fb923c', rpg: true },
  lightning: { icon: '⚡', name: 'Chain Lightning',    desc: 'Steal $30 from every rival in one strike.',                                       cost: 180, accent: '#facc15', rpg: true }
});
Object.assign(SHOP_CODE, { rewind: 'r', mirror: 'i', loaded: 'l', cloak: 'p', hook: 'k', bounty: 'o', lightning: 'n' });
Object.keys(SHOP_CODE).forEach(k => { SHOP_BY_CODE[SHOP_CODE[k]] = k; });
TARGET_SHOP.add('bounty');

/* ---- prices ---- */
function getCost(p, key) {
  let c = SHOP_ITEMS[key].cost;
  if (playerClasses[p] === 'wizard') c = Math.round(c * 0.75);
  if (rpgOn()) {
    if (RPG.mods.fest > 0) c = Math.round(c * 0.7);
    const d = RP(p).disc; if (d) c = Math.round(c * (1 - Math.min(1, d)));
  }
  return Math.max(0, c);
}
const marketOpen = () => !rpgOn() || RPG.cfg.market;
function itemStatus(p, key) {                  // '' when buyable, otherwise the reason it is not
  if (!rpgOn() || !SHOP_ITEMS[key].rpg) return '';
  const lim = ITEM_LIMITS[key], r = RP(p); if (!lim) return '';
  const n = r.bought[key] || 0;
  if (n >= lim.max) return 'sold out';
  const wait = lim.cd - (RPG.round - (r.boughtAt[key] === undefined ? -99 : r.boughtAt[key]));
  if (lim.cd && n > 0 && wait > 0) return `restocks in ${wait} round${wait > 1 ? 's' : ''}`;
  return '';
}
function itemUsable(p, key, opp) {             // one-line reason an item cannot be used right now ('' = ok)
  const r = RP(p);
  if (key === 'rewind') return (r.lastFrom > playerPositions[p]) ? '' : 'nothing to undo (you have not lost ground)';
  if (key === 'mirror') return r.mirror ? 'a mirror is already up' : '';
  if (key === 'loaded') return r.loaded ? 'already loaded' : '';
  if (key === 'cloak') return r.cloak > 0 ? 'already cloaked' : '';
  if (key === 'hook') return r.hook ? 'already holding a hook' : '';
  if (key === 'bounty') {
    if (r.contract && RPG.round <= r.contract.exp) return 'you already hold a contract';
    if (!opp || opp === p || RP(opp).out) return 'pick a rival';
    if (isAllied(p, opp)) return 'not against your ally';
    return '';
  }
  if (key === 'lightning') return alive().some(q => q !== p) ? '' : 'no rivals left';
  return '';
}

function renderShop() {
  const p = currentPlayer;
  $('shop-purse').textContent = playerCash[p];
  const open = marketOpen();
  $('shop-note').textContent = !open ? 'The market is closed in this mode' : shopPurchasedThisTurn ? 'already traded this turn'
    : ((playerClasses[p] === 'wizard' ? 'Wizard −25% · ' : '') + (rpgOn() && RPG.mods.fest > 0 ? '🎪 Festival −30% · ' : '') + '1 purchase per turn');
  const list = $('shop-items');
  list.innerHTML = '';
  Object.entries(SHOP_ITEMS).forEach(([key, item]) => {
    if (item.rpg && !rpgOn()) return;
    const price = getCost(p, key), full = SHOP_ITEMS[key].cost;
    const poor = playerCash[p] < price, why = itemStatus(p, key);
    const lim = rpgOn() && item.rpg ? ITEM_LIMITS[key] : null, left = lim ? Math.max(0, lim.max - (RP(p).bought[key] || 0)) : 0;
    const btn = document.createElement('button');
    btn.className = 'shop-item' + ((poor || shopPurchasedThisTurn || why || !open) ? ' disabled' : '');
    btn.style.setProperty('--accent', item.accent);
    btn.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <div class="shop-ico">${item.icon}</div>
        <div class="min-w-0"><div class="text-xs font-extrabold text-white">${item.name}${item.rpg ? ' <span class="item-new">NEW</span>' : ''}</div><div class="text-[11px] text-slate-400 leading-snug">${item.desc}</div>
        ${lim ? `<div class="text-[10px] text-amber-200/80">${why || `${left}/${lim.max} left this match`}</div>` : ''}</div>
      </div>
      <span class="price${poor ? ' poor' : ''}">${price === 0 ? 'FREE' : '$' + price}${price < full ? `<s style="display:block;font-size:9px;opacity:.6">$${full}</s>` : ''}</span>`;
    btn.onclick = () => uiBuy(key);
    list.appendChild(btn);
  });
}
function openShopModal() {
  if (isRolling || gameOver || isBot(currentPlayer) || !canAct()) return;
  if (!marketOpen()) { toast('🚫 The Black Market is closed in this mode.', 'warn'); return; }
  renderShop();
  openModal('shop-modal');
}

/* ---- purchase flow: wraps the original buyShopItem so the six original items behave exactly as before ---- */
const buyShopItemOriginal = buyShopItem;
buyShopItem = function (key, target) {
  const me = currentPlayer, bot = isBot(me), warn = m => { if (!bot) toast(m, 'warn'); };
  if (rpgOn()) {
    if (!marketOpen()) { warn('The Black Market is closed in this mode.'); return false; }
    if (shopPurchasedThisTurn) { warn('The merchant only trades once per turn.'); return false; }
    const opp0 = target || rpgTarget(me);
    if (TARGET_SHOP.has(key) && opp0 && RP(opp0).out) { warn('That hero has fallen.'); return false; }
    if (SHOP_ITEMS[key].rpg) return rpgBuyNew(key, target, warn);
    // the originals: still 1 per turn, now with the Cloak/Mirror/ally guard, a coupon, stats
    if (TARGET_SHOP.has(key) && !target) target = rpgTarget(me) || undefined;
    return rpgBuyOriginal(key, target, warn);
  }
  return buyShopItemOriginal(key, target);
};
function rpgNoteBuy(me, key, price) {
  const r = RP(me);
  r.st.spent += price; r.st.kinds[key] = true;
  r.bought[key] = (r.bought[key] || 0) + 1; r.boughtAt[key] = RPG.round;
  if (Object.keys(r.st.kinds).length >= 5) rpgAch(me, 'trader');
  if (r.disc) r.disc = 0;
  shopPurchasedThisTurn = true;
}
function rpgBuyOriginal(key, target, warn) {
  const me = currentPlayer, r = RP(me);
  const price = getCost(me, key), opp = target || defaultTarget(me);
  if (shopPurchasedThisTurn) return false;
  if (playerCash[me] < price) { warn(`Not enough gold — you need $${price}.`); return false; }
  const hostile = key === 'swap' || key === 'freeze' || key === 'mine';
  if (!hostile) {
    const had = r.disc; const ok = buyShopItemOriginal(key, target);
    if (ok) { r.st.spent += price; r.st.kinds[key] = true; r.bought[key] = (r.bought[key] || 0) + 1; r.boughtAt[key] = RPG.round; if (had) r.disc = 0; if (Object.keys(r.st.kinds).length >= 5) rpgAch(me, 'trader'); }
    return ok;
  }
  // hostile: validate like the original, then run the guard before the effect lands
  if (!opp || opp === me) { warn('Pick a rival first.'); return false; }
  if (isAllied(me, opp)) { warn('You cannot target your ally. Betray them first!'); return false; }
  if (key === 'swap' && playerPositions[me] === playerPositions[opp]) { warn('You already share a tile with your rival.'); return false; }
  if (key === 'freeze') {
    if (playerClasses[opp] === 'angel') { warn('Angels are immune to freeze — purchase cancelled.'); return false; }
    if (playerPoisoned[opp]) { warn('Your rival is already frozen.'); return false; }
  }
  if (key === 'mine' && findFreeTile(playerPositions[opp], [3, 2, 4, 1, 5, 6]) == null) { warn('No free tile ahead of your rival for a mine.'); return false; }
  const g = rpgGuard(opp, me, key === 'swap' ? 'swap' : key === 'freeze' ? 'freeze' : 'mine');
  if (g === 'hit') {
    const had = r.disc; const ok = buyShopItemOriginal(key, target);
    if (ok) { r.st.spent += price; r.st.kinds[key] = true; r.bought[key] = (r.bought[key] || 0) + 1; r.boughtAt[key] = RPG.round; if (had) r.disc = 0; if (Object.keys(r.st.kinds).length >= 5) rpgAch(me, 'trader'); if (key !== 'mine') rpgHit(me, opp, key); }
    return ok;
  }
  // blocked / reflected: the gold is spent, the effect is not
  playerCash[me] -= price; r.st.spent += price; r.st.kinds[key] = true; r.bought[key] = (r.bought[key] || 0) + 1; r.boughtAt[key] = RPG.round; if (r.disc) r.disc = 0;
  shopPurchasedThisTurn = true;
  floatAtPlayer(me, `-$${price}`, '#fb7185');
  if (g === 'reflect') rpgBacklash(me, opp, key);
  refreshAll(); updateControls(); closeModal('shop-modal');
  return true;
}
function rpgBacklash(src, victim, kind) {         // a Mirror Curse threw the action back at `src`
  if (kind === 'freeze') {
    if (playerClasses[src] === 'angel') { rpgLog(src, '😇 Divine Grace: the reflected freeze fizzles.'); return; }
    playerPoisoned[src] = true; rpgLog(src, `❄️ The reflected frost <b>freezes ${playerName(src)}</b> instead!`); rpgSetback(src);
  } else if (kind === 'swap') {
    const l = lose(src, 60); bank(victim, l); rpgLog(src, `🪞 The reflected swap backfires: ${playerName(src)} pays <b>$${l}</b> to ${playerName(victim)}.`);
  } else if (kind === 'mine' || kind === 'serpent trap') {
    const to = nearestPlain(Math.max(2, playerPositions[src] - 4), -1); movePlayerTo(src, to, 0.6); rpgLog(src, `💥 The reflected blast hurls ${playerName(src)} back to tile ${to}!`); rpgSetback(src);
  } else if (kind === 'lightning') {
    const l = lose(src, 30); bank(victim, l); rpgLog(src, `🪞 The lightning arcs back: ${playerName(victim)} drains <b>$${l}</b> from ${playerName(src)}!`);
  } else if (kind === 'duel') {
    const l = lose(src, 50); bank(victim, l); rpgLog(src, `🪞 The duel challenge rebounds: ${playerName(src)} forfeits <b>$${l}</b>.`);
  } else { const l = lose(src, 30); bank(victim, l); rpgLog(src, `🪞 Reflected: ${playerName(src)} loses <b>$${l}</b>.`); }
  refreshAll();
}

function rpgBuyNew(key, target, warn) {
  const me = currentPlayer, r = RP(me), item = SHOP_ITEMS[key];
  const price = getCost(me, key), opp = target || rpgTarget(me);
  const st = itemStatus(me, key);
  if (st) { warn(`${item.name}: ${st}.`); return false; }
  if (playerCash[me] < price) { warn(`Not enough gold — you need $${price}.`); return false; }
  const why = itemUsable(me, key, opp);
  if (why) { warn(`${item.name}: ${why}.`); return false; }
  playerCash[me] -= price;
  floatAtPlayer(me, price ? `-$${price}` : 'FREE!', '#fb7185');
  rpgNoteBuy(me, key, price);
  const who = playerName(me);
  let sub = '', result = '', emoji = item.icon, tint = item.accent;
  if (key === 'rewind') {
    const to = r.lastFrom;
    movePlayerTo(me, to, 0.9); r.hurt = false;
    result = `Back to tile ${to}!`; rpgLog(me, `💸 Paid $${price}: ⏪ <b>Time Rewind</b> — returned to tile ${to}.`);
    fxEmit(to, 'magic', 26);
  } else if (key === 'mirror') { r.mirror = true; result = 'The next hostile action bounces back!'; rpgLog(me, `💸 Paid $${price}: 🪞 <b>Mirror Curse</b> raised.`); }
  else if (key === 'loaded') { r.loaded = true; result = 'You choose your next roll.'; rpgLog(me, `💸 Paid $${price}: 🎲 <b>Loaded Dice</b> — your next roll is yours to choose.`); }
  else if (key === 'cloak') { r.cloak = 2; result = 'Untargetable for 2 turns.'; rpgLog(me, `💸 Paid $${price}: 👻 <b>Phantom Cloak</b> for 2 turns.`); }
  else if (key === 'hook') { r.hook = true; result = 'The next snake will be slain!'; rpgLog(me, `💸 Paid $${price}: 🪝 <b>Snakeslayer Hook</b> ready.`); }
  else if (key === 'bounty') {
    r.contract = { on: opp, exp: RPG.round + 5, paid: 0 };
    sub = `on ${playerName(opp)}`; result = `$70 each time they hit a snake, mine or trap (x2).`;
    rpgLog(me, `💸 Paid $${price}: 🎯 <b>Bounty Contract</b> on ${playerName(opp)} (5 rounds).`);
  } else if (key === 'lightning') {
    const hits = [];
    alive().filter(q => q !== me).forEach(q => {
      const g = rpgGuard(q, me, 'lightning');
      if (g === 'hit') {
        if (playerShields[q]) { playerShields[q] = false; RP(q).st.block++; rpgLog(q, `🛡️ Holy Shield <b>absorbed</b> the lightning from ${who}!`); return; }
        const l = lose(q, 30); if (l) { bank(me, l, '', '#fde047'); hits.push(`${playerName(q)} −$${l}`); rpgHit(me, q, 'lightning'); }
      } else if (g === 'reflect') rpgBacklash(me, q, 'lightning');
    });
    result = hits.length ? hits.join(' · ') : 'The storm found no purchase…';
    rpgLog(me, `💸 Paid $${price}: ⚡ <b>Chain Lightning</b>${hits.length ? ' — ' + hits.join(', ') : ' fizzled'}.`);
    fxEmit(playerPositions[me], 'magic', 30);
  }
  playSound('powerup'); sfx(key);
  refreshAll(); updateControls(); closeModal('shop-modal');
  if (!fastMode) quick({ kicker: 'BLACK MARKET', title: item.name, sub: `${who} ${sub}`, emoji, result, tint, rain: [item.icon, '✨'], ms: 1300, shake: key === 'lightning' ? 'big' : 0 });
  return true;
}

/* ---- Loaded Dice: only which digit gets logged changes; everyone replays that digit ---- */
function handleRollClick() {
  if (isRolling || gameOver || isBot(currentPlayer)) return;
  if (anyModalOpen() || splashActive()) return;
  if (NET.on && !canAct()) return;
  const me = currentPlayer;
  const go = v => { if (NET.on) { netPush(String(v)); executeTurn(v, false); } else executeTurn(v); };
  if (rpgOn() && RP(me).loaded) {
    const box = $('loaded-pick'); box.innerHTML = '';
    const left = 100 - playerPositions[me];
    for (let v = 1; v <= 6; v++) {
      const b = document.createElement('button'); b.textContent = v;
      if (v > left) { b.style.opacity = '.4'; b.title = 'overshoots tile 100'; }
      b.onclick = () => { closeModal('loaded-modal'); go(v); };
      box.appendChild(b);
    }
    openModal('loaded-modal');
    return;
  }
  if (NET.on) go(1 + Math.floor(Math.random() * 6)); else executeTurn();
}
function aiLoadedPick(p) {
  const pos = playerPositions[p], left = 100 - pos;
  if (left <= 6) return left;
  let best = 6, score = -9;
  for (let v = 6; v >= 1; v--) {
    const t = pos + v; let s = v;
    if (LADDERS[t]) s += 40; if (SNAKES[t]) s -= 40; if (placedMines[t] && placedMines[t] !== p) s -= 25;
    if (RPG.tiles[t] && RPG.tiles[t].t === 'trap') s -= 8; if (RPG.tiles[t] && RPG.tiles[t].t === 'boss' && RPG.boss[RPG.tiles[t].k].alive) s -= 6;
    if (s > score) { score = s; best = v; }
  }
  return best;
}

/* ---- the digit that was rolled becomes the move that is made ---- */
function rpgAdjustRoll(p, raw) {
  if (!rpgOn()) return raw;
  const r = RP(p); let roll = raw;
  if (r.loaded) { r.loaded = false; rpgLog(p, `🎲 Loaded Dice: ${playerName(p)} chose <b>${raw}</b>.`); }
  if (RPG.mods.storm > 0 && roll > 4) { rpgLog(p, `⛈️ Dark Storm caps the roll at 4 (rolled ${roll}).`); roll = 4; }
  if (r.curse === 'leaden' && roll > 1) { r.curse = null; const n = Math.max(1, roll - 2); rpgLog(p, `🪨 Leaden Boots drag the roll from ${roll} down to ${n}.`); roll = n; rpgSetback(p); }
  if (r.slow > 0) { r.slow = 0; const n = Math.max(1, Math.ceil(roll / 2)); rpgLog(p, `🥶 Slowed: the roll is halved (${roll} → ${n}).`); roll = n; }
  return roll;
}
function rpgSalary(p) {
  let s = playerClasses[p] === 'human' ? 100 : 50;
  if (!rpgOn()) return s;
  const r = RP(p);
  s = Math.round(s * RPG.cfg.salaryMul);
  if (RPG.mods.sal > 0) s *= 2;
  if (r.curse === 'hexed') { r.curse = null; s = Math.round(s / 2); rpgLog(p, '🧿 Pauper Hex halves your salary.'); }
  if (isTrailing(p)) { s += 30; }
  return s;
}

/* ---- snakes and ladders: Double Trouble, Snake Awakening, Snake Curse, Hook (original rules when none apply) ---- */
function ladderDest(pos, p) {
  let dest = LADDERS[pos];
  if (rpgOn() && RPG.cfg.dbl) dest = Math.min(98, pos + (dest - pos) * 2);
  return dest;
}
function snakeDest(pos, p) {
  let dest = SNAKES[pos];
  if (!rpgOn()) return dest;
  if (RPG.cfg.dbl) dest = Math.max(1, pos - (pos - dest) * 2);
  if (RPG.mods.snake > 0) dest = Math.max(1, dest - 4);
  return dest;
}
const bossBlocks = pos => { const t = RPG.tiles[pos]; return !!(t && t.t === 'boss' && RPG.boss[t.k] && RPG.boss[t.k].alive); };
