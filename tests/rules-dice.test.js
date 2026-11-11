// Finish rule (bounce / exact), special dice, bot dice choice and match stats, run in jsdom against the real page.
//   cd tests && npm install && npm run test:rules
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script src=[^>]*><\/script>/g, '');
const errors = [];
process.on('unhandledRejection', e => errors.push('unhandled: ' + (e && e.stack || e)));
const real = global.setTimeout;
const sleep = ms => new Promise(r => real(r, ms));

function boot() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail || e.message)));
  const dom = new JSDOM(html, { url: 'https://yutfi.github.io/Dungeon-of-Snakes-Ladders/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => null;   // the effects canvas is not needed (and not implemented) in jsdom
      const st = w.setTimeout.bind(w);
      w.setTimeout = (fn, ms, ...a) => st(fn, ((ms || 0) >= 5000 ? ms : Math.min(ms || 0, 2)), ...a);
      w.addEventListener('error', e => errors.push('window.onerror: ' + e.message));
    } });
  return dom.window;
}
let passed = 0, failed = 0;
function check(name, ok, extra) { if (ok) { passed++; console.log('  ok   ' + name); } else { failed++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const w = boot(); await sleep(100);
  const ev = s => w.eval(s);
  // A clean two-player same-screen game (angels, with the starting shield removed so snakes bite)
  const fresh = () => ev("gameMode='PvP'; playerClasses={1:'angel',2:'angel'}; soloBounce=true; modeKey='classic'; resetGame(); fastMode=true; playerShields={1:false,2:false}");
  // Play one full turn for the current player. A roll of 6 opens the power-up prompt; pick the cash bounty.
  const turn = async (roll, die) => {
    ev(`executeTurn(${roll}, false, ${die ? "'" + die + "'" : 'undefined'})`);
    for (let i = 0; i < 400; i++) {
      await sleep(2);
      if (ev('!!window.resolvePowerUp')) { w.selectPowerUp('cash'); continue; }
      if (!ev('isRolling')) break;
    }
    await sleep(5);
  };

  console.log('\nPath calculation (computePath)');
  const P = (f, r, b) => ev(`computePath(${f},${r},${b})`);
  const walk = (f, r, b) => { const m = P(f, r, b); return [...m.fwd, ...m.back]; };
  check('98 + 5 bounces: 99,100,99,98,97 (the example from the request)', same(walk(98, 5, true), [99, 100, 99, 98, 97]) && P(98, 5, true).landing === 97);
  check('99 + 6 bounces to 95', same(walk(99, 6, true), [100, 99, 98, 97, 96, 95]));
  check('95 + 6 bounces to 99', same(walk(95, 6, true), [96, 97, 98, 99, 100, 99]));
  check('an exact roll to 100 does not bounce', same(walk(96, 4, true), [97, 98, 99, 100]) && P(96, 4, true).over === 0);
  check('94 + 6 lands on 100 exactly', P(94, 6, true).landing === 100 && P(94, 6, true).back.length === 0);
  check('rolls of 7 and 8 bounce correctly (Gambler die)', P(95, 8, true).landing === 97 && P(99, 8, true).landing === 93);
  check('ordinary move, no bounce', same(walk(10, 4, true), [11, 12, 13, 14]) && P(10, 4, true).landing === 14);
  check('exact rule: 98 + 5 is blocked and stays on 98', P(98, 5, false).blocked === true && P(98, 5, false).landing === 98 && walk(98, 5, false).length === 0);
  check('exact rule: 98 + 2 still wins', P(98, 2, false).blocked === false && P(98, 2, false).landing === 100);
  let allOk = true;
  for (let f = 1; f <= 99; f++) for (let r = 1; r <= 8; r++) {
    const m = P(f, r, true), path = [...m.fwd, ...m.back];
    const expect = f + r <= 100 ? f + r : 200 - f - r;
    if (m.landing !== expect || path.length !== r || (path.length ? path[path.length - 1] : f) !== expect) allOk = false;
  }
  check('every start tile × roll 1–8: the piece walks exactly `roll` steps and lands where it should', allOk);

  console.log('\nFull turns in the engine');
  fresh(); ev('playerPositions[1]=98'); await turn(5);
  check('bounce rule: 98 rolling 5 ends on 97 and the turn passes', ev('playerPositions[1]') === 97 && ev('currentPlayer') === 2, ev('playerPositions'));
  check('...and the bounce is counted', ev('playerStats[1].bounces') === 1);
  fresh(); ev('RULES.bounce=false; playerPositions[1]=98'); await turn(5);
  check('exact rule: 98 rolling 5 stays on 98 and the turn passes', ev('playerPositions[1]') === 98 && ev('currentPlayer') === 2);
  fresh(); ev('RULES.bounce=false; playerPositions[1]=98'); await turn(2);
  check('exact rule: 98 rolling 2 wins', ev('gameOver') === true && ev('playerPositions[1]') === 100);
  fresh(); ev('playerPositions[1]=94'); await turn(6);
  check('94 rolling 6 lands on 100 and wins', ev('gameOver') === true && ev('playerPositions[1]') === 100);
  fresh(); ev('playerPositions[1]=96'); await turn(6);
  check('96 rolling 6 passes 100 by 2 and bounces to 98 — no win', ev('gameOver') === false && ev('playerPositions[1]') === 98, ev('playerPositions'));
  fresh(); ev('playerPositions[1]=97'); await turn(4);
  check('bouncing onto the snake on 99 slides you down to 78 (and counts the bite)', ev('playerPositions[1]') === 78 && ev('playerStats[1].snakes') === 1, ev('playerPositions'));

  console.log('\nDice');
  check('four dice: normal, steady, lucky, gambler', same(ev('DICE_KEYS'), ['normal', 'steady', 'lucky', 'gambler']));
  check('normal die is a fair 1–6 and free', same(ev('DICE.normal.faces'), [1, 2, 3, 4, 5, 6]) && ev('DICE.normal.cost') === 0);
  const seen = {};
  for (const k of ev('DICE_KEYS')) { const s = new Set(); for (let i = 0; i < 2000; i++) s.add(ev(`rollDie('${k}')`)); seen[k] = [...s].sort((a, b) => a - b); }
  check("rollDie only ever produces each die's own faces, and all of them", ev('DICE_KEYS').every(k => same(seen[k], [...new Set(ev(`DICE.${k}.faces`))].sort((a, b) => a - b))), seen);

  fresh(); ev('playerCash[1]=1000; playerPositions[1]=10');
  const gc = ev('DICE.gambler.cost'), cash0 = ev('playerCash[1]');
  ev('playerPositions[1]=11'); await turn(7, 'gambler');
  check('Gambler die: rolling a 7 from tile 11 lands on 18', ev('playerPositions[1]') === 18, ev('playerPositions'));
  check('the die price is charged (salary comes in, price goes out)', ev('playerCash[1]') === cash0 + 50 - gc, [ev('playerCash[1]'), cash0, gc]);
  check('...and counted in the stats', ev('playerStats[1].dice') === 1 && ev('playerStats[1].spent') === gc);
  fresh(); ev('playerCash[1]=1000; playerPositions[1]=10');
  await turn(8, 'gambler');
  check('Gambler die: an 8 lands on 18 and also opens the power-up (extra roll bonus), a 7 does not', ev('playerPositions[1]') === 18 && ev('playerCash[1]') > 1000 + 50 - gc, [ev('playerPositions[1]'), ev('playerCash[1]')]);

  fresh(); ev('playerCash[1]=0; playerPositions[1]=10');
  await turn(3, 'lucky');
  check('an unaffordable die is replaced by the normal die: no charge, the roll still moves you', ev('playerStats[1].dice') === 0 && ev('playerStats[1].spent') === 0 && ev('playerPositions[1]') === 13, ev('playerPositions'));
  fresh(); ev('playerCash[1]=1000; playerPositions[1]=10'); await turn(8, 'lucky');
  check('a roll the die cannot produce (Lucky never rolls 8) is ignored: the die falls back and the 8 is not applied', ev('playerPositions[1]') === 11 && ev('playerStats[1].dice') === 0, ev('playerPositions'));
  fresh(); ev('playerCash[1]=1000; playerPositions[1]=10'); await turn(4, 'steady');
  check('Steady die is free', ev('playerStats[1].spent') === 0 && ev('playerPositions[1]') === 14);
  fresh(); ev('playerCash[1]=1000; playerPositions[1]=10'); await turn(3, 'bogus');
  check('an unknown die name falls back to the normal die', ev('playerPositions[1]') === 13);

  console.log('\nPicking a die in the UI');
  fresh(); ev('fastMode=false; playerCash[1]=1000; updateControls()');
  check('die buttons exist for all four dice', ev('DICE_KEYS').every(k => !!w.document.getElementById('die-' + k)));
  w.selectDie('lucky');
  check('selecting a die highlights it and changes the roll button', ev('selectedDie') === 'lucky' && w.document.getElementById('die-lucky').classList.contains('on') && /LUCKY/.test(w.document.getElementById('roll-label').textContent));
  check('the cube previews the selected die', w.document.getElementById('cube').dataset.die === 'lucky' && w.document.querySelectorAll('#cube .face.num').length === 6);
  w.selectDie('nope');
  check('an unknown die name is ignored', ev('selectedDie') === 'lucky');
  ev('playerCash[1]=10; updateControls()');
  check("a die you can't afford is disabled; the normal die is not", w.document.getElementById('die-lucky').disabled === true && w.document.getElementById('die-normal').disabled === false);
  w.selectDie('normal');
  check('selecting the normal die puts the pips back', ev('selectedDie') === 'normal' && w.document.querySelectorAll('#cube .pip').length === 21);
  ev('fastMode=true');

  console.log('\nBot dice choice');
  fresh(); ev('playerCash[2]=1000; playerPositions[2]=95');
  check('a bot that is a few tiles from the finish picks the Steady die', ev('aiChooseDie(2)') === 'steady', ev('aiChooseDie(2)'));
  ev('playerPositions[2]=40');
  check('mid-board with plenty of gold the bot picks a valid die', ev('DICE_KEYS').includes(ev('aiChooseDie(2)')));
  ev('playerCash[2]=0');
  check('a bot with no gold never picks a paid die', ev('DICE[aiChooseDie(2)].cost') === 0);
  check('bots can play from either seat (aiChooseItem / aiRival take the seat)', ev('typeof aiChooseItem(1)') !== 'undefined' && ev('aiRival(1)') === 2);

  console.log('\nClass numbers and the freeze rule');
  fresh(); ev('playerClasses={1:"human",2:"demon"}; playerCash={1:500,2:500}; playerPositions={1:10,2:30}');
  let c0 = ev('playerCash[1]'); await turn(3);
  check('Human salary is the tuned $' + ev('TUNE.humanSalary') + ' (odd roll: no work-ethic bonus)', ev('playerCash[1]') === c0 + ev('TUNE.humanSalary'), [ev('playerCash[1]'), c0]);
  await turn(1);
  fresh(); ev('playerClasses={1:"human",2:"demon"}; playerCash={1:500,2:500}; playerPositions={1:11,2:30}');
  c0 = ev('playerCash[1]'); await turn(2);
  check('Human even roll adds the tuned bonus', ev('playerCash[1]') === c0 + ev('TUNE.humanSalary') + ev('TUNE.humanEven'), [ev('playerCash[1]'), c0]);
  c0 = ev('playerCash[2]'); await turn(3);
  check('Demon salary is base + bonus', ev('playerCash[2]') === c0 + ev('TUNE.baseSalary') + ev('TUNE.demonBonus'), [ev('playerCash[2]'), c0]);
  fresh(); ev('playerClasses={1:"human",2:"human"}; playerCash={1:900,2:900}; playerPositions={1:10,2:12}');
  ev('playerPoisoned[2]=true');
  ev('currentPlayer=2'); await turn(3);
  check('a frozen player skips the turn and is then thawed (immune)', ev('playerThawed[2]') >= 1 && ev('playerPoisoned[2]') === false && ev('playerPositions[2]') === 12, [ev('playerThawed[2]'), ev('playerPositions[2]')]);
  ev('currentPlayer=1; shopPurchasedThisTurn=false'); const got = ev('buyShopItem("freeze", 2)');
  check('Paralyzing Frost cannot chain-lock a player who just thawed', got === false && ev('playerPoisoned[2]') === false, got);
  await turn(3); await turn(3); await turn(3);   // 1, 2, 1 ... player 2 has now taken a full turn
  await turn(3); await turn(3);
  ev('currentPlayer=1; shopPurchasedThisTurn=false'); ev('playerCash[1]=900');
  check('...and the protection is gone after their next full turn', ev('playerThawed[2]') === 0, ev('playerThawed'));

  console.log('\nMatch stats and the victory screen');
  fresh(); ev('playerPositions[1]=96'); await turn(4);
  check('winner screen has a column per player', ev('gameOver') === true && w.document.querySelectorAll('#win-stats th').length === 3);
  check('stats table shows turns and gold', /Turns/.test(w.document.getElementById('win-stats').textContent) && /Gold earned/.test(w.document.getElementById('win-stats').textContent));
  check('gold earned = the salary collected', ev('playerStats[1].earned') === 50, ev('playerStats[1]'));

  console.log('\nOnline log grammar and room record');
  const re = ev('LOG_RE');
  check('digits, die letter + digit, and the old codes are valid', re.test('46s3l6g8wJ12bFK'), String(re));
  check('a die letter without its digit, or an out-of-range digit, is rejected', !re.test('s') && !re.test('l9') && !re.test('g0') && !re.test('x4'));
  const g = { gen: 1, by: 'abcdefghij', seats: ['abcdefghij', 'klmnopqrst'], cls: ['human', 'demon'], nicks: ['a', 'b'], log: '' };
  check('room records default to bounce, and keep an exact-rule choice', ev(`validG(${JSON.stringify(g)}).rule`) === 'b' && ev(`validG(${JSON.stringify({ ...g, rule: 'x' })}).rule`) === 'x' && ev(`validG(${JSON.stringify({ ...g, rule: 'zzz' })}).rule`) === 'b');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  console.log('ERRORS:', errors.length ? errors.slice(0, 8) : 'none');
  process.exit(failed || errors.length ? 1 : 0);
})();
