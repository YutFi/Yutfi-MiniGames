// Balance simulations: bots play thousands of real games in jsdom against the real engine (fast mode, no animation).
//   node balance.js classes [games-per-pairing]     class matchups, first-player advantage, game length
//   node balance.js items   [games-per-item]        what each Black Market item is worth (forced-buy bot vs a bot that never shops)
//   node balance.js dice    [games-per-die]         what each special die is worth after its price
//   node balance.js jack    [purchases]             what one Jack of Trader card is worth, outcome by outcome
// Caveat: the numbers describe the built-in bots (heuristic AI), not human skill. They are for finding what is clearly off.
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script src=[^>]*><\/script>/g, '');

function boot() {
  const vc = new VirtualConsole();
  const dom = new JSDOM(html, { url: 'https://yutfi.github.io/Dungeon-of-Snakes-Ladders/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      const st = w.setTimeout.bind(w);
      w.setTimeout = (fn, ms, ...a) => st(fn, ((ms || 0) >= 5000 ? ms : Math.min(ms || 0, 1)), ...a);
    } });
  return dom.window;
}
const real = global.setTimeout;
const sleep = ms => new Promise(r => real(r, ms));

// One game between bots. `setup(w)` may change the page before play (policies, cash...). Returns what happened.
async function game(w, classes, setup) {
  const ev = s => w.eval(s);
  ev(`gameMode='BOTS'; playerClasses=${JSON.stringify(classes)}; soloBounce=true; resetGame(); fastMode=true; scheduleBot = function () {}; clearTimeout(botTimer);`);
  if (setup) setup(w);
  let turns = 0;
  while (!ev('gameOver') && turns < 700) {
    await w.executeTurn();
    turns++;
    if (turns % 25 === 0) await sleep(0);
  }
  if (!ev('gameOver')) return { winner: 0, turns, stalled: true };
  const winner = ev('playerPositions[1] >= 100') ? 1 : ev('playerPositions[2] >= 100') ? 2 : 0;
  return { winner, turns: ev('Math.max(...Object.values(playerStats).map(s => s.turns))'), stats: ev('JSON.parse(JSON.stringify(playerStats))'), cash: ev('JSON.parse(JSON.stringify(playerCash))') };
}
const pct = (a, n) => (n ? (100 * a / n).toFixed(1) : '–') + '%';
const ci = (p, n) => (1.96 * Math.sqrt(p * (1 - p) / n) * 100).toFixed(1);   // 95% interval half-width, in points

async function classes(N) {
  const w = boot(); await sleep(150);
  const C = ['human', 'wizard', 'demon', 'angel'];
  const wins = {}, games = {}, seat1 = {}, lens = [];
  C.forEach(c => { wins[c] = 0; games[c] = 0; });
  const table = {};
  for (const a of C) for (const b of C) {
    let wa = 0, w1 = 0, n = 0;
    for (let i = 0; i < N; i++) {
      const r = await game(w, { 1: a, 2: b });
      if (!r.winner) continue;
      n++; lens.push(r.turns);
      if (r.winner === 1) { w1++; }
      const win = r.winner === 1 ? a : b;
      if (win === a && a !== b) wa++;
      if (a !== b) { games[a]++; games[b]++; wins[win]++; }
    }
    table[a + ' (seat 1) vs ' + b + ' (seat 2)'] = { seat1: pct(w1, n), n };
  }
  console.log('\nCLASSES (bots, bounce rule, natural AI incl. the market)');
  console.log('Seat 1 win rate for every ordered pairing:');
  for (const [k, v] of Object.entries(table)) console.log('  ' + k.padEnd(34) + v.seat1.padStart(7) + '   (n=' + v.n + ')');
  console.log('\nOverall win rate per class against the OTHER classes (any seat):');
  C.forEach(c => console.log('  ' + c.padEnd(8) + pct(wins[c], games[c]).padStart(7) + '  ±' + ci(wins[c] / games[c], games[c]) + ' pts   (' + games[c] + ' games)'));
  lens.sort((x, y) => x - y);
  console.log('\nGame length (turns per player): median ' + lens[lens.length >> 1] + ', p10 ' + lens[Math.floor(lens.length * 0.1)] + ', p90 ' + lens[Math.floor(lens.length * 0.9)]);
}

// Forced policy: player 1 buys `key` whenever it can; player 2 never shops. `cls` for both.
function shopPolicy(key) {
  return w => w.eval(`aiChooseItem = function (me) { return me === 1 ? ${key ? `'${key}'` : 'null'} : null; }`);
}
async function items(N, cls) {
  cls = cls || 'human';
  const w = boot(); await sleep(150);
  if (process.env.PRICES) for (const [k, c] of Object.entries(JSON.parse(process.env.PRICES))) w.eval(`SHOP_ITEMS.${k}.cost = ${+c}`);   // e.g. PRICES='{"freeze":260}'
  const keys = process.env.ONLY ? [null, ...process.env.ONLY.split(',')] : [null, 'swap', 'bribe', 'freeze', 'checkpoint', 'buysnake', 'mine', 'jack'];
  console.log(`\nBLACK MARKET (${cls} vs ${cls}): player 1 buys the item whenever it can; player 2 never shops. ${N} games each, seats alternate.`);
  console.log('item'.padEnd(12) + 'price'.padStart(6) + 'win rate'.padStart(10) + '  ±pts' + '   buys/game');
  let base = 0.5;
  for (const k of keys) {
    let win = 0, n = 0, buys = 0;
    for (let i = 0; i < N; i++) {
      const swap = i % 2 === 1;                       // alternate which seat is the buyer
      const r = await game(w, { 1: cls, 2: cls }, ww => {
        ww.eval(`aiChooseItem = function (me) { return me === ${swap ? 2 : 1} ? ${k ? `'${k}'` : 'null'} : null; }`);
      });
      if (!r.winner) continue;
      n++;
      const buyer = swap ? 2 : 1;
      if (r.winner === buyer) win++;
      if (k) buys += r.stats[buyer].spent;           // (gold spent incl. salary-independent; divided by price below)
    }
    const p = win / n;
    if (!k) base = p;
    const price = k ? w.eval(`SHOP_ITEMS.${k}.cost`) : 0;
    console.log((k || '(no shopping)').padEnd(12) + String(price).padStart(6) + pct(win, n).padStart(10) + ('  ±' + ci(p, n)).padEnd(8) + (k ? ((buys / price) / n).toFixed(2).padStart(8) : ''));
  }
  console.log('(a baseline of ~50% means shopping neither helps nor hurts the buyer; far above/below means the item is over/under-priced for how it is used)');
}

async function dice(N, cls) {
  cls = cls || 'human';
  const w = boot(); await sleep(150);
  console.log(`\nDICE (${cls} vs ${cls}): player 1 rolls this die whenever it can afford it, player 2 rolls the normal die. ${N} games each, seats alternate.`);
  console.log('die'.padEnd(10) + 'price'.padStart(6) + 'win rate'.padStart(10) + '  ±pts');
  for (const k of ['normal', 'steady', 'lucky', 'gambler']) {
    let win = 0, n = 0;
    for (let i = 0; i < N; i++) {
      const swap = i % 2 === 1, me = swap ? 2 : 1;
      const r = await game(w, { 1: cls, 2: cls }, ww => {
        ww.eval(`aiChooseItem = function () { return null; }; aiChooseDie = function (me) { return me === ${me} && playerCash[me] >= DICE.${k}.cost ? '${k}' : 'normal'; }`);
      });
      if (!r.winner) continue;
      n++; if (r.winner === me) win++;
    }
    console.log(k.padEnd(10) + String(w.eval(`DICE.${k}.cost`)).padStart(6) + pct(win, n).padStart(10) + '  ±' + ci(win / n, n));
  }
}

// What a Jack card is worth: from mid-game positions, buy it, force each outcome in turn, and measure the swing against a copy that does not
async function jack(N) {
  const w = boot(); await sleep(150);
  const ev = s => w.eval(s);
  const names = ev('JACK.map(o => o.name)');
  // Value an outcome by what it does to the buyer vs the rival, in "gold-equivalents": a tile is worth the salary of a turn / tiles per turn.
  // 3.5 tiles per turn and ~$75 average income per turn → 1 tile ≈ $21. (A rough yardstick, not a law.)
  const TILE = 21;
  const res = names.map(() => ({ n: 0, v: 0 }));
  for (let it = 0; it < N; it++) {
    for (let idx = 0; idx < 20; idx++) {
      const k = Math.floor(Math.random() * ev(`JACK[${idx}].n`));
      const pos1 = 10 + Math.floor(Math.random() * 75), pos2 = 10 + Math.floor(Math.random() * 75);
      ev(`gameMode='PvP'; playerClasses={1:'human',2:'human'}; resetGame(); fastMode=true; playerPositions={1:${pos1},2:${pos2}}; playerCash={1:600,2:${100 + Math.floor(Math.random() * 500)}}; playerShields={1:${Math.random() < 0.25},2:false}; for (const t of [12,25,36,45,68,77,88]) { if (playerPositions[1]===t) playerPositions[1]++; }`);
      const before = ev('({ pos: playerPositions[1], cash: playerCash[1], rc: playerCash[2], sh: playerShields[1] })');
      ev(`buyShopItem('jack', 1)`);
      const paid = before.cash - ev('playerCash[1]');
      ev(`jackDeliver(${idx}, ${k})`);
      for (let i = 0; i < 100 && ev('jack !== null'); i++) await sleep(0);
      const after = ev('({ pos: playerPositions[1], cash: playerCash[1], rc: playerCash[2], sh: playerShields[1], pz: playerPoisoned[1] || playerFrozenNext[1], br: playerBonusRolls[1], fb: playerFreeBuy[1], cap: playerRollCap[1], ban: playerMarketBan[1], dg: playerDelayedGold[1].length, angel: false })');
      let v = (after.pos - before.pos) * TILE + (after.cash - (before.cash - paid)) - (after.rc - before.rc) * 0;   // own tiles and gold, excluding the price
      v += (after.sh ? 70 : 0) - (before.sh ? 70 : 0);        // a shield is worth about a quarter of a 12-tile snake bite ≈ $70
      if (after.pz) v -= 3.5 * TILE + 75;                      // losing a turn: its tiles and its salary
      if (after.br) v += 3.5 * TILE;                           // an extra roll
      if (after.fb) v += 110;                                  // one free market item (avg worth ≈ $110 net of what it would have cost)
      if (after.cap) v -= (3.5 - 2.17) * TILE;                 // a roll capped at 3
      if (after.ban) v -= 30;                                  // a closed market for a turn
      if (after.dg) v += 50;                                   // the deferred $50 (the first $50 is already counted in the cash)
      v -= (after.rc - before.rc) * 1;                         // gold the rival took
      res[idx].n++; res[idx].v += v;
    }
  }
  const price = ev("SHOP_ITEMS.jack.cost");
  console.log(`\nJACK OF TRADER: average swing per outcome (gold-equivalents, 1 tile ≈ $${TILE}), ${N} samples each, random mid-game positions`);
  let ev60 = 0, ev40 = 0;
  res.forEach((r, i) => { const m = r.v / r.n; console.log('  ' + (i < 10 ? '+ ' : '- ') + names[i].padEnd(24) + m.toFixed(0).padStart(6)); if (i < 10) ev60 += m * 0.06; else ev40 += m * 0.04; });
  console.log(`\n  expected value of one card: boons +${ev60.toFixed(0)}, curses ${ev40.toFixed(0)}  → net ${(ev60 + ev40).toFixed(0)} per card, against a price of $${price}`);
}


// Try class-number variants: node balance.js tune 80 '{"humanEven":50}' '{"humanEven":50,"demonSteal":100}' ...
async function tune(N, configs) {
  const w = boot(); await sleep(150);
  const C = ['human', 'wizard', 'demon', 'angel'];
  console.log(`\nTUNE: win rate per class vs the other three (${N} games per ordered pairing, ${N * 12} games per row)`);
  console.log('config'.padEnd(54) + C.map(c => c.padStart(8)).join(''));
  for (const cfg of configs) {
    const wins = {}, games = {};
    C.forEach(c => { wins[c] = 0; games[c] = 0; });
    for (const a of C) for (const b of C) {
      if (a === b) continue;
      for (let i = 0; i < N; i++) {
        const r = await game(w, { 1: a, 2: b }, ww => ww.eval(`Object.assign(TUNE, ${JSON.stringify(cfg)})`));
        if (!r.winner) continue;
        games[a]++; games[b]++; wins[r.winner === 1 ? a : b]++;
      }
    }
    w.eval(`Object.assign(TUNE, { baseSalary: 50, humanSalary: 80, humanEven: 50, demonSteal: 100, demonBonus: 25, angelBonus: 0, wizardDiscount: 0.25, wizardLadder: 2 })`);
    console.log(JSON.stringify(cfg).padEnd(54) + C.map(c => pct(wins[c], games[c]).padStart(8)).join(''));
  }
}

// Try die variants: node balance.js dicesweep 200 '{"lucky":{"cost":200}}' '{"steady":{"faces":[3,4,5]}}' ...   (forced: player 1 always rolls that die when it can pay)
async function dicesweep(N, configs) {
  const w = boot(); await sleep(150);
  w.eval('window.__natDie = aiChooseDie');
  console.log(`\nDICE VARIANTS (human vs human, ${N} games each, seats alternate). "forced" = the die every turn it can be paid for; "smart" = the bot's own die choice.`);
  for (const cfg of configs) {
    const out = [];
    for (const k of Object.keys(cfg)) {
      let win = 0, n = 0, winS = 0, nS = 0;
      for (let i = 0; i < N; i++) {
        const swap = i % 2 === 1, me = swap ? 2 : 1;
        const setup = forced => ww => {
          ww.eval(`Object.assign(DICE.${k}, ${JSON.stringify(cfg[k])}); aiChooseItem = function () { return null; };` +
            (forced ? `aiChooseDie = function (me) { return me === ${me} && playerCash[me] >= DICE.${k}.cost ? '${k}' : 'normal'; }`
                    : `aiChooseDie = function (m) { return m === ${me} ? window.__natDie(m) : 'normal'; }`));
        };
        const r = await game(w, { 1: 'human', 2: 'human' }, setup(true));
        if (r.winner) { n++; if (r.winner === me) win++; }
        if (k !== 'normal') { const r2 = await game(w, { 1: 'human', 2: 'human' }, setup(false)); if (r2.winner) { nS++; if (r2.winner === me) winS++; } }
      }
      out.push(`${k} ${JSON.stringify(cfg[k])}: forced ${pct(win, n)}${nS ? ', smart ' + pct(winS, nS) : ''}`);
      w.eval('location.reload'); 
    }
    console.log('  ' + out.join('   |   '));
    w.eval(`Object.assign(DICE.normal, { bonus: [6], cost: 0 }); Object.assign(DICE.steady, { faces: [3, 4], bonus: [], cost: 0 }); Object.assign(DICE.lucky, { faces: [3, 4, 5, 6], bonus: [6], cost: 150 }); Object.assign(DICE.gambler, { faces: [1, 2, 7, 8], bonus: [], cost: 100 });`);
  }
}

(async () => {
  const [, , cmd, n, cls] = process.argv;
  if (cmd === 'classes') await classes(+n || 100);
  else if (cmd === 'items') await items(+n || 400, cls);
  else if (cmd === 'dice') await dice(+n || 400, cls);
  else if (cmd === 'jack') await jack(+n || 150);
  else if (cmd === 'dicesweep') await dicesweep(+n || 150, process.argv.slice(4).map(x => JSON.parse(x)));
  else if (cmd === 'tune') await tune(+n || 60, process.argv.slice(4).map(x => JSON.parse(x)));
  else console.log('usage: node balance.js classes|items|dice|jack [n] [class]');
  process.exit(0);
})();
