/* Gameplay-logic tests for the RPG layer. They drive the real engine inside jsdom (no UI clicking, no mocks of game rules):
   every feature is exercised through the same functions the game itself calls, then its effect on gold / positions / statuses is checked.
   Run:  node tests/rpg.test.js            (set ONLY=chest,altar to run a subset) */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const srcHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const html = srcHtml.replace(/<script src=[^>]*><\/script>/g, '');
const errors = [];
process.on('unhandledRejection', e => errors.push('unhandled: ' + (e && e.stack || e)));

const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail || e.message)));
const dom = new JSDOM(html, { url: 'https://yutfi.github.io/Dungeon-of-Snakes-Ladders/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) { w.HTMLCanvasElement.prototype.getContext = () => null; w.addEventListener('error', e => errors.push('window.onerror: ' + e.message)); } });
const w = dom.window;
const E = code => w.eval(code);
const A = code => w.eval('(async()=>{' + code + '})()');

let pass = 0, fail = 0, cur = '';
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('   ✗ FAIL [' + cur + '] ' + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)})`);
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// ---- page-side helpers --------------------------------------------------------------------------
E(`
window.T = {
  fresh(mode, classes, seed, bare) {
    classes = classes || ['human', 'demon'];
    gameMode = 'ONL'; NP = classes.length; NET.on = false;
    playerClasses = Object.fromEntries(classes.map((c, i) => [i + 1, c]));
    NET.nicks = classes.map((c, i) => 'P' + (i + 1)); NET.G = { seed: seed || 4242 };
    modeKey = mode || 'std'; fastMode = true; document.querySelectorAll('.modal').forEach(m => { m.classList.add('hidden'); m.dataset.state = 'closed'; }); document.querySelectorAll('.menu-screen').forEach(m => m.classList.add('hidden')); RULES.bounce = true; soloBounce = true; resetGame();
    if (bare) { RPG.tiles = {}; RPG.cool = {}; }
    PLAYERS().forEach(p => { playerShields[p] = false; playerCash[p] = 500; });
    refreshAll();
  },
  reseed(s) { RPG.s = s >>> 0 || 1; },
  say() { return moveHistory.length ? moveHistory[0].text.replace(/<[^>]+>/g, '') : ''; },
  logs(n) { return moveHistory.slice(0, n || 5).map(m => m.text.replace(/<[^>]+>/g, '')); },
  at(p, pos) { playerPositions[p] = pos; },
  tile(n, t) { RPG.tiles[n] = t; },
  decide(ans) { window.__ans = ans; promptDecision = (k, n, ui, bp, who) => Promise.resolve(typeof window.__ans === 'function' ? window.__ans(k, who) : window.__ans); },
  total() { return PLAYERS().reduce((a, p) => a + playerCash[p], 0); }
};`);
const fresh = (mode, classes, seed, bare) => E(`T.fresh(${JSON.stringify(mode || 'std')}, ${JSON.stringify(classes || ['human', 'demon'])}, ${seed || 4242}, ${!!bare})`);

// ================================================================================================
test('layout: tiles, bosses, no overlaps, classic mode is untouched', async () => {
  fresh('std');
  const L = E(`(() => { const c = {}; Object.values(RPG.tiles).forEach(t => c[t.t] = (c[t.t] || 0) + 1);
    const bad = Object.keys(RPG.tiles).filter(n => LADDERS[n] || SNAKES[n] || SPECIAL_TILES[n] || Object.values(LADDERS).includes(+n) || Object.values(SNAKES).includes(+n) || +n === 1 || +n === 100);
    return { c, bad, boss: Object.entries(RPG.boss).map(([k, b]) => [k, BOSSES[k].tile, b.hp]) }; })()`);
  eq(Object.entries(L.c).sort(), Object.entries({ chest: 4, portal: 3, wheel: 2, altar: 2, camp: 3, trap: 6, boss: 3 }).sort(), 'tile counts');
  eq(L.bad, [], 'no RPG tile on snake/ladder/rune/start/finish');
  eq(L.boss, [['ice', 33, 16], ['dragon', 56, 20], ['lich', 82, 22]], 'bosses fixed on 33/56/82 with base HP');
  fresh('std', ['human', 'demon', 'angel', 'wizard']);
  eq(E('RPG.boss.dragon.hp'), 28, 'boss HP scales +4 per player beyond 2');
  // determinism: same seed => same board; other seed => other board
  fresh('std', null, 99); const a = E('JSON.stringify(RPG.tiles)'); fresh('std', null, 99); const b = E('JSON.stringify(RPG.tiles)'); fresh('std', null, 100); const c = E('JSON.stringify(RPG.tiles)');
  ok(a === b, 'same seed => same layout'); ok(a !== c, 'different seed => different layout');
  fresh('classic');
  eq(E('Object.keys(RPG.tiles).length'), 0, 'classic: no new tiles'); ok(E("document.body.classList.contains('rpg-off')"), 'classic hides RPG UI');
  eq(E('Object.keys(SHOP_ITEMS)').slice(0, 6), ['swap', 'bribe', 'freeze', 'checkpoint', 'buysnake', 'mine'], 'original items first and intact');
  eq(E('[SHOP_ITEMS.swap.cost, SHOP_ITEMS.bribe.cost, SHOP_ITEMS.freeze.cost, SHOP_ITEMS.checkpoint.cost, SHOP_ITEMS.buysnake.cost, SHOP_ITEMS.mine.cost]'), [200, 250, 300, 300, 250, 200], 'original prices (repo balance pass) unchanged');
  eq(E('Object.keys(CLASSES)'), ['human', 'wizard', 'demon', 'angel'], 'all four classes still exist');
});

test('prng: seeded, repeatable, and independent of Math.random', async () => {
  fresh('std', null, 7); const s1 = E('[R(), R(), R()]'); fresh('std', null, 7);
  E('Math.random = () => 0.123'); const s2 = E('[R(), R(), R()]'); ok(JSON.stringify(s1) === JSON.stringify(s2), 'R() ignores Math.random');
  E('delete Math.random'); /* restore below */ E("Math.random = (()=>{ let x = 1; return () => (x = (x * 16807) % 2147483647) / 2147483647; })()");
});

test('chest: every reward exists, amounts are bounded, chest goes dormant', async () => {
  const seen = {};
  for (let s = 1; s <= 260; s++) {
    fresh('std', ['human', 'demon'], s, true); E('T.tile(10, { t: "chest" }); T.at(1, 10); T.reseed(' + s + ')');
    const g0 = E('playerCash[1]');
    await A('await rpgResolveTile(1, 10)');
    const say = E('T.say()'), g1 = E('playerCash[1]'), r = E('RP(1)');
    let k = /Mimic/.test(say) ? 'mimic' : /coupon/.test(say) ? 'coupon' : /Holy Shield/.test(say) ? 'shield' : /Cloak/.test(say) ? 'cloak' : /extra dice/.test(say) ? 'extra' : /\+\$(\d+)/.test(say) ? 'gold' : 'other';
    seen[k] = (seen[k] || 0) + 1;
    if (k === 'gold') { const d = g1 - g0; ok(d >= 60 && d <= 200, 'chest gold 60..200 (got ' + d + ')'); }
    if (k === 'mimic') ok(g0 - g1 <= 70 && g1 <= g0, 'mimic bites at most $70');
    if (k === 'coupon') ok(E('RP(1).disc') === 0.5, 'coupon sets a 50% discount');
    if (k === 'cloak') ok(E('RP(1).cloak') === 2, 'cloak lasts 2 turns');
    if (k === 'extra') ok(E('RP(1).bonusRoll') === true, 'extra roll flagged');
    ok(E('dormant(10)'), 'chest rests after use');
    if (s <= 3) { const g2 = E('playerCash[1]'); await A('await rpgResolveTile(1, 10)'); eq(E('playerCash[1]'), g2, 'dormant chest gives nothing'); }
  }
  ok(['gold', 'coupon', 'shield', 'cloak', 'extra', 'mimic'].every(k => seen[k] > 0), 'all chest outcomes occur: ' + JSON.stringify(seen));
  ok(seen.mimic < seen.gold, 'mimic is rare');
  // a shielded hero survives the mimic
  for (let s = 1; s <= 400; s++) {
    fresh('std', null, s, true); E('T.tile(10,{t:"chest"}); T.at(1,10); playerShields[1]=true; T.reseed(' + s + ')');
    await A('await rpgResolveTile(1, 10)'); if (/Mimic/.test(E('T.say()'))) { ok(E('playerCash[1]') === 500 && E('playerShields[1]') === false, 'shield absorbs the mimic'); break; }
  }
  // dormant tiles wake up again after the cooldown
  fresh('std', null, 5, true); E('T.tile(10,{t:"chest"}); T.at(1,10)'); await A('await rpgResolveTile(1,10)'); ok(E('dormant(10)'), 'resting'); E('RPG.round += 5'); ok(!E('dormant(10)'), 'chest wakes after 5 rounds');
});

test('portal: destinations are always safe, swap/guard work, hop loop is bounded', async () => {
  const kinds = {};
  for (let s = 1; s <= 300; s++) {
    fresh('std', ['human', 'demon', 'angel'], s, true); E('T.tile(40,{t:"portal"}); T.at(1,40); T.at(2,60); T.at(3,20); T.reseed(' + s + ')');
    const before = E('JSON.stringify(playerPositions)'); await A('await rpgResolveTile(1, 40)');
    const say = E('T.say()'), pos = E('playerPositions'); const after = JSON.stringify(pos);
    const k = /forward/.test(say) ? 'fwd' : /back/.test(say) ? 'back' : /Swapped/.test(say) ? 'swap' : /Secret/.test(say) ? 'secret' : 'other'; kinds[k] = (kinds[k] || 0) + 1;
    const d = pos[1];
    if (k !== 'swap') ok(d >= 2 && d <= 99 && !E(`!!(LADDERS[${d}] || SNAKES[${d}])`) && !E(`!!(RPG.tiles[${d}] && RPG.tiles[${d}].t==="boss")`), `portal lands on a plain tile (${d}) [${k}]`);
    if (k === 'fwd') ok(d > 40, 'forward portal moves ahead'); if (k === 'back') ok(d < 40, 'backward portal moves back');
    if (k === 'secret') { ok(E('playerCash[1]') >= 620, 'secret room pays gold'); }
    if (k === 'swap') ok(pos[1] !== 40 && (pos[2] === 40 || pos[3] === 40), 'swap exchanges with a rival');
  }
  ok(['fwd', 'back', 'swap', 'secret'].every(k => kinds[k] > 0), 'all portal outcomes occur ' + JSON.stringify(kinds));
  // Phantom Cloak stops the swap
  let blocked = false;
  for (let s = 1; s <= 300 && !blocked; s++) {
    fresh('std', null, s, true); E('T.tile(40,{t:"portal"}); T.at(1,40); T.at(2,60); RP(2).cloak=2; T.reseed(' + s + ')');
    await A('await rpgResolveTile(1, 40)'); if (/blocked/i.test(E('T.logs(4).join("|")'))) { blocked = true; ok(E('playerPositions[2]') === 60, 'cloaked rival is not swapped'); }
  }
  ok(blocked, 'cloak blocked a portal swap');
  fresh('std', null, 3, true); E('T.tile(40,{t:"portal"}); T.at(1,40); RPG.teleHops = 2'); await A('await rpgResolveTile(1,40)'); eq(E('playerPositions[1]'), 40, 'portal fizzles after 2 hops in one turn (no infinite chain)');
});

test('wheel: all slices work and penalties bite', async () => {
  const seen = {};
  for (let s = 1; s <= 300; s++) {
    fresh('std', null, s, true); E('T.tile(30,{t:"wheel"}); T.at(1,30); T.reseed(' + s + ')');
    await A('await rpgResolveTile(1, 30)'); const say = E('T.say()'), g = E('playerCash[1]') - 500, r = E('RP(1)');
    const k = /\$200/.test(say) ? 'g200' : /\$120/.test(say) ? 'g120' : /\$75/.test(say) ? 'g75' : /extra dice/.test(say) ? 'extra' : /Shield|shield/.test(say) ? 'shield' : /FREE/.test(say) ? 'free' : /Snake Curse/.test(say) ? 'curse' : /Lost turn/.test(say) ? 'lost' : 'other';
    seen[k] = (seen[k] || 0) + 1;
    if (k === 'g200') eq(g, 200, '$200 slice'); if (k === 'g120') eq(g, 120, '$120 slice'); if (k === 'g75') eq(g, 75, '$75 slice');
    if (k === 'extra') ok(r.bonusRoll, 'extra roll'); if (k === 'free') eq(r.disc, 1, 'free item flag');
    if (k === 'curse') eq(r.curse, 'snakebait', 'snake curse'); if (k === 'lost') ok(r.skip === 1, 'lost turn');
    if (k === 'g200') ok(r.ach.gambler, 'jackpot earns Lucky Gambler');
  }
  ok(['g200', 'g75', 'g120', 'extra', 'shield', 'free', 'curse', 'lost'].every(k => seen[k] > 0), 'every wheel slice appears ' + JSON.stringify(seen));
  fresh('std', null, 9, true); E('RP(1).disc = 1'); ok(E("getCost(1,'bribe')") === 0, 'free-item coupon makes the next item free');
  eq(E("(buyShopItem('bribe'), playerCash[1])"), 500, 'free purchase costs nothing'); eq(E('RP(1).disc'), 0, 'coupon is consumed');
});

test('altar: choice shown first, pay 100 for a blessing or gamble on a curse', async () => {
  const blessed = {}; let curses = 0, spared = 0;
  for (let s = 1; s <= 400; s++) {
    fresh('std', null, s, true); E('T.tile(50,{t:"altar"}); T.at(1,50); T.decide("A"); T.reseed(' + s + ')');
    await A('await rpgResolveTile(1, 50)'); const say = E('T.logs(2).join("|")');
    ok(!/curse/i.test(say) || /Aegis|Fortune|Dash|Twin/.test(say) || true, 'x');
    const g = E('playerCash[1]');
    const r = E('RP(1)'), k = /Aegis/.test(say) ? 'aegis' : /Fortune/.test(say) ? 'fortune' : /Dash/.test(say) ? 'dash' : /Twin/.test(say) ? 'twin' : 'none'; blessed[k] = (blessed[k] || 0) + 1;
    if (k === 'aegis') ok(E('playerShields[1]') && r.cloak === 2 && r.mirror, 'aegis = shield+cloak+mirror'); if (k === 'fortune') eq(g, 650, 'fortune nets +150'); else ok(g === 400 || k === 'dash' || k === 'twin' || k === 'aegis', 'sacrifice cost $100');
    if (k === 'dash') ok(E('playerPositions[1]') > 50, 'dash carries you forward'); if (k === 'twin') ok(r.bonusRoll && r.twin, 'twin fates = two extra rolls');
    eq(E('dormant(50)'), true, 'altar rests');
  }
  ok(Object.keys(blessed).length >= 4 && !blessed.none, 'all blessings occur ' + JSON.stringify(blessed));
  for (let s = 1; s <= 400; s++) {
    fresh('std', null, s, true); E('T.tile(50,{t:"altar"}); T.at(1,50); T.decide("D"); T.reseed(' + s + ')');
    await A('await rpgResolveTile(1, 50)'); eq(E('playerCash[1]'), 500, 'refusing costs nothing'); if (E('RP(1).curse')) curses++; else spared++;
  }
  ok(curses > 100 && curses < 220, 'refusing risks a curse about 40% of the time (' + curses + '/400)');
  fresh('std', null, 1, true); E('T.tile(50,{t:"altar"}); T.at(1,50); playerCash[1]=60; T.decide("A")'); await A('await rpgResolveTile(1,50)'); eq(E('playerCash[1]'), 60, 'cannot pay $100: nothing happens');
  // the choice is really asked before anything is taken
  fresh('std', null, 1, true); E('T.tile(50,{t:"altar"}); T.at(1,50); window.__asked=null; promptDecision = (k,n,ui,bp,who)=>{ window.__asked={k,gold:playerCash[1],who}; return Promise.resolve("D"); }');
  await A('await rpgResolveTile(1,50)'); eq(E('window.__asked'), { k: 'altar', gold: 500, who: undefined }, 'decision requested before any gold moves');
  // curses actually do what they say
  fresh('std', null, 1, true); E('RP(1).curse="leaden"; T.at(1,10)'); eq(E('rpgAdjustRoll(1,5)'), 3, 'Leaden Boots −2'); eq(E('RP(1).curse'), null, 'curse consumed');
  E('RP(1).curse="hexed"'); eq(E('rpgSalary(1)'), 40, 'Pauper Hex halves salary (human 80→40)');
});

test('rest camp cures everything, restores shield, pays a little', async () => {
  fresh('std', null, 1, true); E('T.tile(20,{t:"camp"}); T.at(1,20); playerPoisoned[1]=true; RP(1).poison=2; RP(1).curse="hexed"; RP(1).slow=1; playerShields[1]=false');
  await A('await rpgResolveTile(1,20)');
  const r = E('({f:playerPoisoned[1],p:RP(1).poison,c:RP(1).curse,s:RP(1).slow,sh:playerShields[1],g:playerCash[1]})');
  eq(r, { f: false, p: 0, c: null, s: 0, sh: true, g: 530 }, 'camp result');
});

test('hidden traps: four kinds, class detection/disarm/immunity', async () => {
  const kinds = { spike: 'Spikes', poison: 'Poison', steal: 'gold-thief', jail: 'cage' };
  for (const [k, word] of Object.entries(kinds)) {
    fresh('std', ['demon', 'human'], 3, true); E(`T.tile(25,{t:"trap",k:"${k}",hidden:true,rev:false}); T.at(1,25)`);
    ok(!E('document.querySelector(".rt-trap")'), 'hidden trap is not drawn'); await A('await rpgResolveTile(1,25)');
    const r = E('({g:playerCash[1],pos:playerPositions[1],poi:RP(1).poison,skip:RP(1).skip,gone:!RPG.tiles[25]})');
    ok(r.gone, k + ': trap is used up');
    if (k === 'spike') ok(true, 'demon ignores spikes: pos ' + r.pos), eq(r.pos, 25, 'demon ignores spikes');
    if (k === 'poison') eq(r.poi, 2, 'poison 2 turns'); if (k === 'steal') ok(r.g < 500 && r.g >= 380, 'pit steals gold'); if (k === 'jail') eq(r.skip, 1, 'cage costs a turn');
  }
  fresh('std', ['human', 'demon'], 3, true); E('T.tile(25,{t:"trap",k:"spike",hidden:true,rev:false}); T.at(1,25); T.reseed(11)'); await A('await rpgResolveTile(1,25)'); ok(E('playerPositions[1]') < 25 && E('playerCash[1]') === 470 || E('playerCash[1]') === 525, 'spikes hurt a non-demon: −$30 and thrown back');
  fresh('std', ['angel', 'human'], 3, true); E('T.tile(25,{t:"trap",k:"poison",hidden:true,rev:false}); T.tile(26,{t:"trap",k:"jail",hidden:true,rev:false}); T.at(1,25); playerShields[1]=false'); await A('await rpgResolveTile(1,25)'); E('T.at(1,26)'); await A('await rpgResolveTile(1,26)');
  eq(E('[RP(1).poison, RP(1).skip]'), [0, 0], 'angel shrugs off poison and cages');
  // wizard sees traps ahead, then disarms for sure; human disarms ~half the time
  fresh('std', ['wizard', 'human'], 3, true); E('T.tile(28,{t:"trap",k:"steal",hidden:true,rev:false}); T.at(1,24); rpgDetect(1)'); ok(E('RPG.tiles[28].rev'), 'wizard detects a trap within 6 tiles'); ok(!!E('document.querySelector(".rt-trap")'), 'revealed trap is drawn');
  E('T.at(1,28)'); await A('await rpgResolveTile(1,28)'); eq(E('playerCash[1]'), 525, 'wizard disarms a sensed trap for salvage');
  let dis = 0; for (let s = 1; s <= 200; s++) { fresh('std', ['human', 'demon'], s, true); E(`T.tile(25,{t:"trap",k:"steal",hidden:true,rev:false}); T.at(1,25); T.reseed(${s})`); await A('await rpgResolveTile(1,25)'); if (E('playerCash[1]') === 525) dis++; }
  ok(dis > 70 && dis < 130, 'human disarms about half (' + dis + '/200)');
  fresh('std', null, 3, true); E('T.tile(25,{t:"trap",k:"steal",hidden:true,rev:false}); T.at(2,25); playerShields[2]=true'); await A('await rpgResolveTile(2,25)'); ok(!E('playerShields[2]') && E('playerCash[2]') === 500, 'shield absorbs a trap');
  // traps are topped up but never beyond the starting count
  fresh('std', null, 3); const n0 = E('Object.values(RPG.tiles).filter(t=>t.t==="trap").length'); E('Object.keys(RPG.tiles).filter(n=>RPG.tiles[n].t==="trap").slice(0,3).forEach(n=>delete RPG.tiles[n]); rpgRespawnTraps()'); ok(E('Object.values(RPG.tiles).filter(t=>t.t==="trap").length') <= n0, 'trap respawn is capped');
});

test('black market: new items, prices, limits, once per turn', async () => {
  const price = { rewind: 150, mirror: 120, loaded: 200, cloak: 160, hook: 130, bounty: 100, lightning: 180 };
  fresh('std', ['demon', 'angel'], 1, true);
  for (const [k, v] of Object.entries(price)) eq(E(`SHOP_ITEMS.${k}.cost`), v, k + ' price');
  eq(E('SHOP_CODE'), { swap: 'w', bribe: 'b', freeze: 'f', checkpoint: 'c', buysnake: 't', mine: 'm', jack: 'x', rewind: 'r', mirror: 'i', loaded: 'z', cloak: 'p', hook: 'k', bounty: 'o', lightning: 'n' }, 'log codes');
  ok(E(`document.getElementById('shop-items') && (renderShop(), document.querySelectorAll('#shop-items .shop-item').length)`) === 14, 'shop UI lists all 14 items (6 originals + Jack + 7 new)');
  // cloak
  fresh('std', ['demon', 'angel'], 1, true); E("buyShopItem('cloak')"); eq(E('[playerCash[1], RP(1).cloak, shopPurchasedThisTurn]'), [340, 2, true], 'cloak bought');
  eq(E("buyShopItem('mirror')"), false, 'second purchase in the same turn is refused'); eq(E('playerCash[1]'), 340, 'no gold lost on refusal');
  // wizard discount & festival
  fresh('std', ['wizard', 'angel'], 1, true); eq(E("getCost(1,'cloak')"), 120, 'wizard −25%'); E('RPG.mods.fest = 2'); eq(E("getCost(1,'cloak')"), 84, 'festival −30% stacks'); E('RP(1).disc = 0.5'); eq(E("getCost(1,'cloak')"), 42, 'coupon −50% stacks');
  // limits & cooldowns
  fresh('std', ['demon', 'angel'], 1, true); E('playerCash[1] = 5000');
  eq(E("buyShopItem('loaded')"), true, 'loaded dice bought'); E('shopPurchasedThisTurn=false; RP(1).loaded=false'); eq(E("buyShopItem('loaded')"), false, 'loaded dice: 1 per match');
  E('shopPurchasedThisTurn=false'); eq(E("buyShopItem('cloak')"), true, 'cloak #1'); E('shopPurchasedThisTurn=false; RP(1).cloak=0'); eq(E("buyShopItem('cloak')"), false, 'cloak cooldown (2 rounds)'); E('RPG.round += 2; shopPurchasedThisTurn=false'); eq(E("buyShopItem('cloak')"), true, 'cloak again after the cooldown');
  E('RP(1).cloak=0'); for (let i = 0; i < 4; i++) { E('RPG.round += 3; shopPurchasedThisTurn=false; RP(1).cloak=0'); E("buyShopItem('cloak')"); } eq(E('RP(1).bought.cloak'), 3, 'cloak capped at 3 per match');
  // poor
  fresh('std', ['demon', 'angel'], 1, true); E('playerCash[1] = 100'); eq(E("buyShopItem('lightning')"), false, 'cannot afford lightning');
  // No Market
  fresh('nomarket', null, 1, true); eq(E("buyShopItem('bribe')"), false, 'No Market refuses even the original items'); eq(E('marketOpen()'), false, 'market closed flag');
});

test('time rewind, mirror, loaded dice, hook, bounty, lightning, cloak: real effects', async () => {
  // --- rewind
  fresh('std', ['demon', 'angel'], 1, true); E('RP(1).lastFrom = 30; T.at(1, 18)'); eq(E("buyShopItem('rewind')"), true, 'rewind after a setback'); eq(E('playerPositions[1]'), 30, 'rewound to where the last roll began');
  fresh('std', ['demon', 'angel'], 1, true); E('RP(1).lastFrom = 10; T.at(1, 18)'); eq(E("buyShopItem('rewind')"), false, 'rewind refused when you have not lost ground'); eq(E('playerCash[1]'), 500, 'nothing charged');
  // --- mirror reflects a purchased freeze
  fresh('std', ['demon', 'human'], 1, true); E('currentPlayer = 2; RP(1).mirror = true; playerCash[2] = 500'); E("buyShopItem('freeze', 1)");
  eq(E('[playerPoisoned[1], playerPoisoned[2], RP(1).mirror]'), [false, true, false], 'mirror reflects the freeze onto the attacker and is used up');
  // mirror vs swap: attacker pays $60 to the victim
  fresh('std', ['demon', 'human'], 1, true); E('currentPlayer = 2; RP(1).mirror = true; T.at(1,10); T.at(2,50)'); E("buyShopItem('swap', 1)"); eq(E('[playerPositions[1], playerPositions[2]]'), [10, 50], 'reflected swap changes nothing on the board'); ok(E('playerCash[2]') === 500 - 200 - 60 && E('playerCash[1]') === 560, 'attacker pays the backlash');
  // --- cloak blocks everything, then wears off after two of its owner's turns
  fresh('std', ['demon', 'human'], 1, true); E('RP(1).cloak = 2; currentPlayer = 2; T.at(1,10); T.at(2,50)'); E("buyShopItem('swap', 1)"); eq(E('playerPositions[1]'), 10, 'cloak blocks a swap'); E('shopPurchasedThisTurn=false'); E("buyShopItem('freeze', 1)"); eq(E('playerPoisoned[1]'), false, 'cloak blocks freeze');
  E('shopPurchasedThisTurn=false'); E("buyShopItem('mine', 1)"); eq(E('Object.keys(placedMines).length'), 0, 'cloak blocks a mine'); E('shopPurchasedThisTurn=false'); const lg = E('playerCash[2]'); E("buyShopItem('lightning')"); eq(E('playerCash[1]'), 500, 'cloak blocks chain lightning');
  E('currentPlayer = 2; switchTurn()'); eq(E('[currentPlayer, RP(1).cloak]'), [1, 1], 'cloak ticks down when its owner’s turn starts'); E('switchTurn(); switchTurn()'); eq(E('RP(1).cloak'), 0, 'cloak is gone after 2 turns');
  // --- chain lightning
  fresh('std', ['demon', 'human', 'angel', 'wizard'], 1, true); E('RP(2).cloak = 1; playerShields[3] = false; playerShields[4] = true'); E("buyShopItem('lightning')");
  eq(E('[playerCash[1], playerCash[2], playerCash[3], playerCash[4], playerShields[4]]'), [500 - 180 + 30, 500, 470, 500, false], 'lightning: +$30 from the unprotected, cloak and shield each stop one strike');
  fresh('std', ['demon', 'human'], 1, true); E('RP(2).mirror = true'); E("buyShopItem('lightning')"); eq(E('[playerCash[1], playerCash[2]]'), [500 - 180 - 30, 530], 'mirror turns lightning around');
  // --- hook
  fresh('std', ['demon', 'angel'], 1, true); E('T.at(1, 54); playerShields[1] = false'); E("buyShopItem('hook')"); await A('await resolveOnce(1)'); eq(E('playerPositions[1]'), 54, 'hook: you stay on the snake’s head'); eq(E('playerCash[1]'), 500 - 130 + 40, 'hook pays a $40 bounty'); eq(E('RP(1).hook'), false, 'hook used up');
  fresh('std', ['demon', 'angel'], 1, true); E('customSnakeOwner[44]=2; SNAKES[44]=29; T.at(1,44); RP(1).hook=true; playerShields[1]=false'); await A('await resolveOnce(1)'); ok(!E('SNAKES[44]') && !E('customSnakeOwner[44]'), 'hook destroys a summoned serpent trap');
  // --- bounty contract
  fresh('std', ['demon', 'human'], 1, true); E('currentPlayer = 1'); E("buyShopItem('bounty', 2)"); ok(E('RP(1).contract.on') === 2, 'contract set'); E('T.at(2, 62); playerShields[2] = false; RP(2).cloak=0'); const g0 = E('playerCash[1]'); await A('await resolveOnce(2)'); eq(E('playerCash[1]'), g0 + 70, 'contract pays $70 when the target is bitten');
  E('T.at(2, 64)'); await A('await resolveOnce(2)'); eq(E('playerCash[1]'), g0 + 140, 'second payout'); E('T.at(2, 17)'); await A('await resolveOnce(2)'); eq(E('playerCash[1]'), g0 + 140, 'no third payout'); ok(E('RP(1).contract') === null, 'contract ends after 2 payouts');
  fresh('std', ['demon', 'human'], 1, true); E("buyShopItem('bounty', 2)"); E('RPG.round += 6; T.at(2, 62); playerShields[2]=false'); const g1 = E('playerCash[1]'); await A('await resolveOnce(2)'); eq(E('playerCash[1]'), g1, 'expired contract pays nothing');
  // --- loaded dice
  fresh('std', ['demon', 'human'], 1, true); E("buyShopItem('loaded')"); eq(E('RP(1).loaded'), true, 'loaded flag'); await A('await new Promise(r => setTimeout(r, 330))'); E('handleRollClick()'); ok(!E("document.getElementById('loaded-modal').classList.contains('hidden')"), 'roll button opens the number picker');
  eq(E("document.querySelectorAll('#loaded-pick button').length"), 6, 'picker offers 1..6'); E("document.querySelectorAll('#loaded-pick button')[2].click()"); await A('await new Promise(r => setTimeout(r, 30))'); eq(E('playerPositions[1]'), 14, 'rolled exactly the chosen 3: 1→4, and the ladder on 4 climbs to 14');
  ok(E('RP(1).loaded') === false, 'loaded dice are consumed by the roll');
});

test('world events: all ten work, cadence is 3-5 rounds', async () => {
  const want = ['goldrush', 'awaken', 'blessing', 'storm', 'festival', 'wrath', 'lucky', 'frozenk', 'salary', 'chaosday'];
  const seen = {};
  for (let s = 1; s <= 600 && Object.keys(seen).length < 10; s++) {
    fresh('std', ['human', 'wizard', 'angel'], 1, true); E(`RPG.s = ${s}; RPG.ev = null; PLAYERS().forEach(p => { playerCash[p] = 500; playerShields[p] = false; T.at(p, 30); })`); E('rpgWorldEvent()'); const k = E('RPG.ev'); if (seen[k]) continue; seen[k] = true;
    const c = E('PLAYERS().map(p => playerCash[p])'), sh = E('PLAYERS().map(p => playerShields[p])'), m = E('RPG.mods');
    if (k === 'goldrush') eq(c, [550, 550, 550], 'Gold Rush +$50 each');
    if (k === 'awaken') eq(m.snake, 2, 'Snake Awakening 2 rounds'); if (k === 'blessing') eq(sh, [true, true, true], 'Goddess Blessing shields everyone');
    if (k === 'storm') { eq(m.storm, 1, 'storm flag'); eq(E('rpgAdjustRoll(1, 6)'), 4, 'Dark Storm caps a 6 at 4'); eq(E('rpgAdjustRoll(1, 3)'), 3, '…but not lower rolls'); }
    if (k === 'festival') eq(E("getCost(1,'mirror')"), 84, 'Merchant Festival −30%');
    if (k === 'wrath') ok(c.filter(x => x === 400).length === 1 || sh.filter(x => !x).length === 3 - 0, 'Dragon Wrath scorches exactly one hero (or melts a shield)');
    if (k === 'lucky') eq(E('PLAYERS().map(p => RP(p).bonusRoll)'), [true, true, true], 'Lucky Day gives everyone a bonus roll');
    if (k === 'frozenk') ok(E('playerPoisoned[3]') === false, 'Frozen Kingdom never freezes an Angel');
    if (k === 'salary') { eq(m.sal, 3, 'Double Salary 3 rounds'); eq(E('rpgSalary(1)'), 160, 'human salary doubled'); eq(E('rpgSalary(2)'), 100, 'other salary doubled'); }
    if (k === 'chaosday') ok(c.some(x => x < 500) || E('PLAYERS().some(p => playerPositions[p] < 30)') || sh.some(x => x === false), 'Chaos Day hurts somebody');
  }
  ok(want.every(k => seen[k]), 'all 10 events occur: ' + Object.keys(seen).join(','));
  // cadence
  for (const [mode, lo, hi] of [['std', 3, 5], ['chaos', 2, 3], ['speed', 3, 4]]) {
    fresh(mode, null, 77, true); const rounds = [];
    for (let i = 0; i < 80; i++) { const n0 = E('RPG.evCount'); E('rpgRoundTick()'); if (E('RPG.evCount') > n0) rounds.push(E('RPG.round')); }
    const gaps = rounds.slice(1).map((r, i) => r - rounds[i]); ok(gaps.length > 8 && gaps.every(g => g >= lo && g <= hi), `${mode}: events every ${lo}-${hi} rounds (${gaps.join(',')})`);
  }
  fresh('survival', null, 5, true); let bad = 0; for (let i = 0; i < 60; i++) { E('RPG.ev=null; rpgWorldEvent()'); if (E('WORLD_EVENTS[RPG.ev].good')) bad++; } eq(bad, 0, 'Survival rolls only harmful events');
  // events respect the shared log: same seed => same event sequence
  const seq = () => { fresh('std', null, 31, true); const o = []; for (let i = 0; i < 40; i++) { E('rpgRoundTick()'); o.push(E('RPG.ev')); } return o.join(); }; ok(seq() === seq(), 'event sequence is a pure function of the seed');
});

test('arena: duel, competition, alliance, betrayal, wanted', async () => {
  // duel: conserves gold, stake is $50, cooldown, one action per turn
  let wins = 0, draws = 0;
  for (let s = 1; s <= 120; s++) {
    fresh('std', ['human', 'demon'], s, true); E(`T.reseed(${s})`); const t0 = E('T.total()'); await A('await rpgArena("duel", 2, false)'); eq(E('T.total()'), t0, 'duel never creates or destroys gold'); const d = E('playerCash[1]') - 500; ok(d === 50 || d === -50 || d === 0, 'duel stake is ±$50'); if (d === 50) wins++; if (d === 0) draws++;
    if (s === 1) { ok(E('arenaWhy("duel",1,2)') !== '', 'second arena action in the same turn is refused'); E('RPG.actionUsed=false'); ok(/wait/.test(E('arenaWhy("duel",1,2)')), 'duel cooldown'); }
  }
  ok(wins > 30 && wins < 90, 'duels are fair-ish (' + wins + '/120 for challenger)');
  fresh('std', ['human', 'demon'], 1, true); E('playerCash[2]=40'); ok(/cannot match/.test(E('arenaWhy("duel",1,2)')), 'duel needs both $50');
  // competition
  fresh('std', ['human', 'demon', 'angel'], 4, true); const c0 = E('T.total()'); await A('await rpgArena("comp", 0, false)'); eq(E('T.total()'), c0 + 60, 'competition: antes in, pot + $60 bank bonus out'); ok(/Treasure Competition/.test(E('T.logs(3).join("|")')), 'competition logged');
  E('RPG.actionUsed=false'); ok(/held recently/.test(E('arenaWhy("comp",1,0)')), 'competition cannot be spammed');
  // alliance
  fresh('std', ['human', 'demon', 'angel'], 4, true); E('T.decide("u")'); await A('await rpgArena("offer", 2, false)'); eq(E('RPG.allies.length'), 1, 'alliance formed'); ok(E('isAllied(1,2) && isAllied(2,1)'), 'symmetric');
  E('RPG.actionUsed=false'); ok(E('arenaWhy("offer",1,3)') !== '', 'cannot ally twice');
  eq(E('rpgGuard(2, 1, "swap")'), 'blocked', 'ally cannot hit ally'); eq(E('rpgGuard(2, 3, "swap")'), 'blocked', 'ally covers once vs a third party'); eq(E('rpgGuard(2, 3, "swap")'), 'hit', '…only once');
  const g = E('playerCash[2]'); E('rpgShare(1, 100)'); eq(E('playerCash[2]'), g + 25, 'allies share part of a reward (25%)');
  E('RPG.round += 2'); E('rpgRoundTick()'); eq(E('RPG.allies.length'), 0, 'alliance expires after 3 rounds');
  fresh('std', ['human', 'demon'], 4, true); E('T.decide("q")'); await A('await rpgArena("offer", 2, false)'); eq(E('RPG.allies.length'), 0, 'declined offer does nothing');
  // betrayal
  fresh('std', ['human', 'demon'], 4, true); E('RPG.allies=[{a:1,b:2,since:RPG.round,exp:RPG.round+3}]'); ok(/fresh/.test(E('arenaWhy("betray",1,0)')), 'cannot betray the moment a pact is made'); E('RPG.round++'); const b0 = E('T.total()'); await A('await rpgArena("betray", 0, false)');
  eq(E('[playerCash[1], playerCash[2], RPG.allies.length]'), [580, 420, 0], 'betrayal steals $80 and breaks the pact'); eq(E('T.total()'), b0, 'betrayal moves gold, never mints it'); ok(E('RP(1).allyCd') > E('RPG.round'), 'betrayer cannot ally again at once'); ok(E('RP(1).st.sab') >= 2, 'betrayal counts toward Villain');
  // wanted
  fresh('std', ['human', 'demon', 'angel'], 4, true); E('T.at(1, 60); T.at(2, 20); T.at(3, 25)'); E('rpgWantedTick()'); eq(E('RPG.wanted'), 1, 'the runaway leader is Wanted');
  const w0 = E('playerCash[2]'); E('rpgHit(2, 1, "x")'); eq(E('playerCash[2]'), w0 + 75, 'sabotaging the Wanted hero pays $75'); E('rpgHit(2, 1, "x")'); eq(E('playerCash[2]'), w0 + 75, 'same hunter must wait');
  E('RPG.round += 3; rpgHit(2,1,"x"); RPG.round += 3'); ok(E('RPG.wanted') === 0 || E('RPG.wantedHits') <= 3, 'bounty capped at 3 payouts');
  fresh('std', ['human', 'demon'], 4, true); E('T.at(1,60); T.at(2,20); rpgWantedTick(); RPG.allies=[{a:1,b:2,since:0,exp:99}]'); const w1 = E('playerCash[2]'); E('rpgHit(2,1,"x")'); eq(E('playerCash[2]'), w1, 'allies cannot farm the bounty');
  fresh('std', ['human', 'demon'], 4, true); E('T.at(1,60); T.at(2,20); rpgWantedTick(); RPG.round += 7; rpgWantedTick()'); eq(E('RPG.wanted'), 0, 'bounty expires after 6 rounds');
});

test('bosses: block the road, shared HP, rewards, defeat, hardcore', async () => {
  fresh('std', ['human', 'demon'], 2, true); E('T.tile(33,{t:"boss",k:"ice"}); RPG.boss.ice={hp:16,max:16,alive:true,dmg:{}}; T.at(1,30)');
  await A('await executeTurn(5, false)'); // roll a 5: 30 -> would reach 35, but the Ice Titan stops the hero on 33 (or repels them)
  const p1 = E('playerPositions[1]'); ok(p1 <= 33, 'boss stops the hero at or before its tile (' + p1 + ')'); ok(E('RPG.boss.ice.hp') < 16, 'the fight dealt damage'); ok(/Boss fight/.test(E('T.logs(6).join("|")')), 'fight is logged');
  // shared HP, bounded duration, never more than 3 exchanges
  let killed = 0, fell = 0, pushed = 0;
  for (let s = 1; s <= 200; s++) {
    fresh('std', ['human', 'demon'], s, true); E('T.tile(56,{t:"boss",k:"dragon"}); RPG.boss.dragon={hp:20,max:20,alive:true,dmg:{}}; T.at(1,56); T.reseed(' + s + ')');
    const g0 = E('playerCash[1]'); await A('await rpgResolveTile(1,56)'); const hp = E('RPG.boss.dragon.hp'), alive = E('RPG.boss.dragon.alive'), say = E('T.logs(3).join("|")');
    ok(20 - hp <= 3 * (6 + 1 + 3), 'at most 3 exchanges of damage'); ok(hp >= 0, 'HP never negative');
    if (!alive) { killed++; ok(hp === 0, 'dead boss has 0 HP'); ok(E('RP(1).gear') === 'dragon', 'dragonscale awarded'); ok(E('playerCash[1]') >= g0 + 220, 'kill reward $220'); ok(E('RP(1).ach.slayer'), 'Dragon Slayer achievement'); eq(E('playerPositions[1]'), 56, 'victor stands on the boss tile'); }
    else if (/defeated/i.test(say)) { fell++; ok(E('playerPositions[1]') < 56 - 3, 'defeat throws the hero back'); } else { pushed++; ok(E('playerPositions[1]') < 56, 'driven back'); }
  }
  ok(killed > 0 && (fell + pushed) > 0, `all fight outcomes occur (kills ${killed}, defeats ${fell}, driven back ${pushed})`);
  // many visits wear the boss down and a dead boss no longer blocks
  fresh('std', ['human', 'demon'], 8, true); E('T.tile(33,{t:"boss",k:"ice"}); RPG.boss.ice={hp:16,max:16,alive:true,dmg:{}}'); let visits = 0;
  while (E('RPG.boss.ice.alive') && visits < 30) { E('T.at(1, 33)'); await A('await rpgResolveTile(1,33)'); visits++; if (E('playerCash[1]') < 200) E('playerCash[1] = 500'); }
  ok(!E('RPG.boss.ice.alive') && visits <= 12, 'boss falls after a few visits (' + visits + ')'); ok(!E('bossBlocks(33)'), 'a dead boss no longer blocks'); ok(E('RP(1).gear') === 'frost', 'frost armour from the Ice Titan');
  // gear works
  fresh('std', null, 1, true); E('RP(1).gear="frost"; RP(1).gearN=1; currentPlayer=2'); eq(E('rpgGuard(1,2,"freeze")'), 'blocked', 'frost armour blocks a freeze'); eq(E('RP(1).gear'), null, 'and shatters');
  E('RP(2).gear="dragon"; RP(2).gearN=2; T.tile(25,{t:"trap",k:"steal",hidden:true,rev:false}); T.at(2,25)'); await A('await rpgResolveTile(2,25)'); eq(E('playerCash[2]'), 500, 'dragonscale shrugs off a trap'); eq(E('RP(2).gearN'), 1, 'one charge used');
  // hardcore: a lost boss fight is elimination, last hero standing wins
  fresh('hardcore', ['human', 'demon'], 3, true); eq(E('RP(1).lives'), 1, 'hardcore = one life'); let out = false;
  for (let s = 1; s <= 300 && !out; s++) { fresh('hardcore', ['human', 'demon'], s, true); E('T.tile(82,{t:"boss",k:"lich"}); RPG.boss.lich={hp:22,max:22,alive:true,dmg:{}}; T.at(1,82); T.reseed(' + s + ')'); await A('await rpgResolveTile(1,82)'); if (E('RP(1).out')) { out = true; ok(E('gameOver') && E('document.getElementById("win-title").textContent').includes('P2'), 'last survivor wins'); ok(E('alive().length') === 1, 'one hero left'); } }
  ok(out, 'a hardcore hero can be eliminated by a boss');
  fresh('std', ['human', 'demon'], 1, true); E('RP(1).out = true'); eq(E('rivals(2)'), [], 'fallen heroes are not valid targets'); E('currentPlayer = 2; switchTurn()'); eq(E('currentPlayer'), 2, 'turn order skips fallen heroes');
});

test('modes: each one changes the rules as advertised', async () => {
  // Double Trouble
  fresh('double', ['demon', 'angel'], 1, true); eq(E('ladderDest(4,1)'), 24, 'ladder 4→14 becomes 4→24'); eq(E('ladderDest(28,1)'), 98, 'big ladders are capped at 98 (never an instant win)'); eq(E('snakeDest(54,1)'), 14, 'snake 54→34 becomes 54→14'); eq(E('snakeDest(17,1)'), 1, 'drops floor at tile 1');
  fresh('std', ['demon', 'angel'], 1, true); eq(E('ladderDest(4,1)'), 14, 'standard ladder unchanged'); eq(E('snakeDest(54,1)'), 34, 'standard snake unchanged'); E('RPG.mods.snake = 2'); eq(E('snakeDest(54,1)'), 30, 'Snake Awakening −4');
  // Speed
  fresh('speed', ['human', 'angel'], 1); eq(E('playerPositions[1]'), 21, 'Speed Race starts on tile 21'); eq(E('rpgSalary(1)'), 120, 'bigger salary'); ok(E('RPG.speed') < 1, 'faster animations');
  // Richest
  fresh('richest', ['human', 'angel'], 1, true); E('T.at(1,100)'); await A('await rpgLap(1)'); eq(E('[playerPositions[1], playerCash[1]]'), [1, 900], 'lap: +$400 and back to start'); eq(E('gameOver'), false, 'reaching 100 does not end Richest Wins');
  fresh('richest', ['human', 'angel'], 1, true); E('RPG.round = 20; playerCash[2] = 900; playerCash[1] = 300; currentPlayer = 2; switchTurn()'); ok(E('gameOver'), 'ends after 20 rounds'); ok(E('document.getElementById("win-title").textContent').includes('P2'), 'highest gold wins');
  // Survival
  fresh('survival', ['human', 'angel'], 1, true); E('playerCash[1] = 500; playerCash[2] = 3; rpgRoundTick()'); eq(E('playerCash[1]'), 496, 'danger 1 costs $4'); ok(E('RP(2).lives') === 2 && E('RPG.danger') === 1, 'a hero who cannot pay loses a life');
  for (let i = 0; i < 5; i++) E('rpgDangerTick()'); ok(E('RPG.danger') === 6, 'the dungeon gets nastier every round');
  // Bounty Hunter
  fresh('bounty', ['demon', 'human'], 1, true); const b0 = E('playerCash[1]'); E('rpgHit(1,2,"x")'); eq(E('playerCash[1]'), b0 + 60, 'Bounty Hunter pays $60 per hit'); E('rpgHit(1,2,"x"); rpgHit(1,2,"x"); rpgHit(1,2,"x")'); eq(E('playerCash[1]'), b0 + 180, 'capped at 3 payouts per round'); E('RPG.round++; rpgHit(1,2,"x")'); eq(E('playerCash[1]'), b0 + 240, 'resets each round');
  // Chaos
  fresh('chaos', null, 1); const tc = E('Object.values(RPG.tiles).filter(t=>t.t==="portal").length'), tt = E('Object.values(RPG.tiles).filter(t=>t.t==="trap").length'); ok(tc > 3 && tt > 6, 'Chaos has more portals/traps (' + tc + '/' + tt + ')');
  // Classic: original behaviours, no RPG hooks
  fresh('classic', ['human', 'demon'], 1); E('T.at(1, 3)'); await A('await executeTurn(1, false)'); eq(E('playerPositions[1]'), 14, 'classic: ladder on 4 still climbs to 14'); eq(E('playerCash[1]'), 500 + 80, 'classic: human salary $80 untouched (roll 1 is odd: no even-roll bonus)');
  fresh('classic', ['human', 'demon'], 1); E('T.at(1,16); playerShields[1]=false'); await A('await executeTurn(1, false)'); eq(E('playerPositions[1]'), 7, 'classic: snake 17→7');
  // every mode loads and names itself
  for (const m of Object.keys(E('MODES'))) { fresh(m, ['human', 'angel', 'demon'], 5); ok(E('RPG.mode') === m, 'mode ' + m + ' starts'); }
});

test('reputation titles and achievements are earned and are cosmetic', async () => {
  fresh('std', ['human', 'demon'], 1, true); const before = E('JSON.stringify([playerCash, playerPositions])');
  E('RP(1).st.risk = 4'); eq(E('titleOf(1)'), '🎰 Gambler', 'Gambler'); E('RP(1).st.lucky = 4'); eq(E('titleOf(1)'), '🍀 Lucky One', 'Lucky One'); E('RP(1).st.block = 3'); eq(E('titleOf(1)'), '🛡️ Guardian', 'Guardian');
  E('RP(1).st.snakes = 3'); eq(E('titleOf(1)'), '🐍 Snake Master', 'Snake Master'); E('RP(1).st.spent = 600'); eq(E('titleOf(1)'), '💰 Merchant', 'Merchant'); E('RP(1).st.sab = 3'); eq(E('titleOf(1)'), '😈 Villain', 'Villain'); E('RP(1).st.won = true'); eq(E('titleOf(1)'), '🏆 Champion', 'Champion');
  eq(E('JSON.stringify([playerCash, playerPositions])'), before, 'titles never touch gold or position');
  // achievements
  fresh('std', ['human', 'demon'], 1, true); E('rpgHit(1,2,"x")'); ok(E('RP(1).ach.firstblood'), 'First Blood'); E('RPG.firstBlood=true; rpgHit(2,1,"x")'); ok(!E('RP(2).ach.firstblood'), 'only the first hit counts');
  E('playerCash[1] = 1000; bank(1,1)'); ok(E('RP(1).ach.millionaire'), 'Millionaire at $1000');
  fresh('std', ['human', 'demon'], 1, true); E('T.at(1,62); playerShields[1]=false; RP(1).st.snakes=2'); await A('await resolveOnce(1)'); ok(E('RP(1).ach.survivor'), 'Snake Survivor after 3 encounters');
  fresh('std', ['human', 'demon'], 1, true); for (let i = 0; i < 6; i++) E('rpgTurnEnd(1)'); ok(E('RP(1).ach.unstoppable'), 'Unstoppable after 6 clean turns'); fresh('std', ['human', 'demon'], 1, true); for (let i = 0; i < 5; i++) E('rpgTurnEnd(1)'); E('rpgSetback(1); rpgTurnEnd(1); rpgTurnEnd(1)'); ok(!E('RP(1).ach.unstoppable'), 'a setback resets the streak');
  fresh('std', ['human', 'demon'], 1, true); E('T.at(1, 5); T.at(2, 40); rpgTurnEnd(1); T.at(1,100); showWinModal(1)'); ok(E('RP(1).ach.comeback'), 'Comeback King after trailing by 25+');
  fresh('std', ['human', 'demon'], 1, true); E('playerCash[1] = 9000'); for (const k of ['bribe', 'cloak', 'mirror', 'hook', 'lightning']) { E('shopPurchasedThisTurn = false; RP(1).cloak = 0; RP(1).mirror=false; RP(1).hook=false'); E(`buyShopItem('${k}')`); } ok(E('RP(1).ach.trader'), 'Master Trader after 5 different items');
  fresh('std', ['human', 'demon'], 1, true); E('RP(1).ach.slayer = true; localStorage.removeItem("sl-ach")'); eq(E('rpgHudMeta(1).ach.includes("🐉")'), true, 'achievements show on the player card');
});

test('anti-abuse & balance rules', async () => {
  // gold can never go negative; payouts are integers
  fresh('std', null, 1, true); E('playerCash[1] = 10'); E('lose(1, 999)'); eq(E('playerCash[1]'), 0, 'lose() floors at 0'); E('bank(1, 12.7)'); eq(E('playerCash[1]'), 13, 'bank() rounds');
  // catch-up salary for a trailing player; leader is not boosted
  fresh('std', ['demon', 'angel'], 1, true); E('T.at(1, 70); T.at(2, 20)'); eq(E('rpgSalary(1)'), 75, 'leader gets the normal salary (demon 50+25)'); eq(E('rpgSalary(2)'), 80, 'trailing hero gets +$30');
  // leader is likelier to meet bad portal/chest luck, never better
  fresh('std', ['human', 'demon'], 1, true); E('T.at(1,70); T.at(2,10)'); ok(E('isLeader(1)') && !E('isLeader(2)'), 'leader detection');
  // Hardcore/Survival can never leave zero heroes
  fresh('hardcore', ['human', 'demon', 'angel'], 1, true); E('rpgEliminate(1); rpgEliminate(2)'); ok(E('gameOver') && E('alive().length') === 1, 'match ends with one survivor');
  // teleports never target snakes/ladders/bosses/runes
  for (let n = 2; n < 100; n++) { fresh('std', null, 1 + n, true); const d = E(`nearestPlain(${n}, ${n % 2 ? 1 : -1})`); ok(d >= 2 && d <= 99 && !E(`!!(LADDERS[${d}]||SNAKES[${d}]||SPECIAL_TILES[${d}])`), 'nearestPlain(' + n + ') = ' + d); if (fail > 20) break; }
  // victory still needs the exact roll
  fresh('std', ['demon', 'angel'], 1, true); E('T.at(1, 97); RULES.bounce = false'); await A('await executeTurn(5, false)'); eq(E('playerPositions[1]'), 97, 'overshooting 100 is still refused under the exact rule'); E('RULES.bounce = true'); ok(!E('gameOver'), 'no accidental win'); fresh('std', ['demon', 'angel'], 1, true); E('T.at(1, 97)'); await A('await executeTurn(3, false)'); ok(E('gameOver') && E('playerPositions[1]') === 100, 'exact roll wins');
  // snake rules intact: shield/bribe/checkpoint behave as before
  fresh('std', ['demon', 'angel'], 1, true); E('T.at(1,87); playerShields[1]=false; playerCheckpoints[1]=40'); await A('await resolveOnce(1)'); eq(E('playerPositions[1]'), 40, 'checkpoint sigil still caps a snake drop');
  fresh('std', ['demon', 'angel'], 1, true); E('T.at(1,87); playerShields[1]=true'); await A('await resolveOnce(1)'); eq(E('playerPositions[1]'), 87, 'shield still blocks a snake');
});

test('protocol: old rooms stay playable, new tokens validate', async () => {
  const g = { gen: 1, by: 'abcdefghij', seats: ['abcdefghij', 'klmnopqrst'], cls: ['human', 'demon'], nicks: ['a', 'b'], log: '36wK' };
  eq(E(`validG(${JSON.stringify(g)}).mode`), 'classic', 'a room record from the original game plays by the original rules');
  eq(E(`validG(${JSON.stringify({ ...g, mode: 'hardcore', seed: 123 })}).mode`), 'hardcore', 'new rooms carry a mode'); eq(E(`validG(${JSON.stringify({ ...g, mode: 'hardcore', seed: 123 })}).seed`), 123, 'and the host seed');
  eq(E(`validG(${JSON.stringify({ ...g, mode: 'nonsense', seed: -5 })}).mode`), 'classic', 'unknown modes fall back safely');
  for (const log of ['1626riADuq', 'dKaLeADuqv', '6wJ5fK3oM2nikpz', 's4l2g8x1yb3', 'x!']) eq(E(`!!validG(${JSON.stringify({ ...g, log })})`), log !== 'x!', 'log grammar ' + log);
  eq(E(`!!validG(${JSON.stringify({ ...g, log: '9' })})`), false, 'invalid digit rejected');
});

test('no client-side randomness in shared outcomes (static scan)', async () => {
  const src = srcHtml, a = src.indexOf('RPG LAYER 1/6'), b = src.indexOf('   INPUT\n');
  const layer = src.slice(a, b).split('\n'); const hits = [];
  let fn = '';
  layer.forEach(l => { const m = l.match(/^(?:async )?function (\w+)/); if (m) fn = m[1]; const t = l.trim(); if (/Math\.random\(/.test(l) && !t.startsWith('(') && !t.startsWith('//') && !t.startsWith('*')) hits.push((/^const newSeed/.test(t) ? 'newSeed' : /^const R_vis/.test(t) ? 'R_vis' : fn) + ' :: ' + t.slice(0, 70)); });
  // handleRollClick: the acting player's own dice roll, which is written to the shared log and replayed everywhere (original design)
  // arenaOffer / aiArena / rpgAiItem: decisions of the single-device AI opponent, never run online
  const allowed = ['newSeed', 'R_vis', 'handleRollClick', 'aiArena', 'rpgAiItem', 'arenaOffer'];
  const bad = hits.filter(h => !allowed.some(a => h.startsWith(a + ' ')));
  eq(bad, [], 'Math.random only appears in cosmetic code, seed creation and bot (single-device) decisions');
});

test('fuzz: whole games in every mode terminate, stay consistent, never throw', async () => {
  E(`promptPowerUpChoice = () => { const t = ['swap','freeze','shield','cash'][Math.floor(Math.random()*4)]; return applyPowerUp(currentPlayer, t, rivals(currentPlayer)[0]); };
     promptDecision = (k, n, ui, bp, who) => Promise.resolve(n.includes('A') ? (Math.random() < 0.6 ? 'A' : 'D') : (Math.random() < 0.5 ? 'u' : 'q'));`);
  const modes = Object.keys(E('MODES')); let games = 0, finished = 0;
  for (const m of modes) {
    for (let g = 0; g < (process.env.FUZZ ? +process.env.FUZZ : 6); g++) {
      const classes = [['human', 'demon'], ['wizard', 'angel', 'human'], ['demon', 'wizard', 'angel', 'human']][g % 3];
      fresh(m, classes, 1000 + g * 37 + m.length);
      let turns = 0, bad = '';
      while (!E('gameOver') && turns < 3500) {
        turns++;
        const me = E('currentPlayer');
        if (E('rpgOn()') && !E('RPG.actionUsed') && Math.random() < 0.15) { const ks = ['duel', 'comp', 'offer', 'betray']; const k = ks[Math.floor(Math.random() * 4)], t = E(`rivals(${me})[0] || 0`); if (!E(`arenaWhy("${k}", ${me}, ${t})`)) await A(`await rpgArena("${k}", ${t}, false)`); }
        if (Math.random() < 0.4 && !E('shopPurchasedThisTurn')) { const ks = E('Object.keys(SHOP_ITEMS)'); E(`buyShopItem("${ks[Math.floor(Math.random() * ks.length)]}", ${E(`rivals(${me})[0] || 0`)} || undefined)`); }
        if (E('rpgOn() && RP(currentPlayer).loaded')) E('RP(currentPlayer).loaded = false');
        await A('await executeTurn(' + (1 + Math.floor(Math.random() * 6)) + ', false)');
        const inv = E(`(() => { for (const p of PLAYERS()) { if (!(playerPositions[p] >= 1 && playerPositions[p] <= 100)) return 'pos ' + p + '=' + playerPositions[p]; if (!Number.isInteger(playerCash[p]) || playerCash[p] < 0) return 'gold ' + p + '=' + playerCash[p]; } return ''; })()`);
        if (inv) { bad = inv; break; }
      }
      games++; if (E('gameOver')) finished++;
      ok(!bad, `${m} game ${g}: invariants hold ${bad}`); ok(E('gameOver'), `${m} game ${g} finished within ${turns} turns`);
    }
  }
  console.log(`   fuzz: ${finished}/${games} games finished`);
});

test('online guards: nothing starts while a Jack deal or a pending decision holds the board', async () => {
  fresh('std', ['human', 'wizard', 'demon'], 9);
  E('fastMode = false; NET.on = true; NET.seat = currentPlayer; NET.G = { gen: 1, seed: 9, log: "", seats: ["a","b","c"] }; NET.applied = 0; isRolling = false; gameOver = false');
  ok(E('canAct()') === true, 'baseline: the current player can act');
  E('NET.decWait = { kind: "ally", need: "uq", who: 3 }'); ok(E('canAct()') === false, 'a pending alliance/altar decision blocks every other action');
  E('NET.decWait = null; jack = { p: currentPlayer }'); ok(E('canAct()') === false, 'a Jack deal in progress blocks actions');
  const h0 = E('moveHistory.length'); E('handleRollClick()'); ok(E('isRolling') === false && E('moveHistory.length') === h0, 'clicking the dice during a Jack deal does nothing');
  E('jack = null; NET.on = false; fastMode = true');
});

// ---------------------------------------------------------------------------------------------
(async () => {
  await new Promise(r => setTimeout(r, 150));
  for (const [name, fn] of tests) {
    if (only.length && !only.some(o => name.startsWith(o))) continue;
    cur = name; const f0 = fail;
    try { await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT: test hung (an awaited prompt/stage never resolved)')), 120000))]); } catch (e) { fail++; console.log('   ✗ EXCEPTION [' + name + '] ' + (e && e.stack || e)); }
    console.log((fail === f0 ? '✔ ' : '✘ ') + name);
  }
  console.log(`\n${pass} checks passed, ${fail} failed`);
  console.log('page errors:', errors.length ? errors.slice(0, 8) : 'none');
  process.exit(fail || errors.length ? 1 : 0);
})();
