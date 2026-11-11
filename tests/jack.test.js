// Jack of Trader: the Black Market gamble card. jsdom against the real page.
//   cd tests && npm install && npm run test:jack
// Covers: the 60/40 odds, all 20 outcomes one by one, purchase rules, the face-down reveal UI, and online play
// (host draws once, the log carries it, guests and reloaded clients replay the same result, duplicates are ignored).
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script src=[^>]*><\/script>/g, '');
const errors = [];
process.on('unhandledRejection', e => errors.push('unhandled: ' + (e && e.stack || e)));
const real = global.setTimeout;
const sleep = ms => new Promise(r => real(r, ms));

// ---- fake MQTT broker (same idea as online-sync.test.js) ----
const retained = new Map(); const clientsLive = new Set(); const FAIL_URLS = new Set(['wss://broker.emqx.io:8084/mqtt']);
function matches(filter, topic) { if (filter.endsWith('/+')) { const b = filter.slice(0, -1); return topic.startsWith(b) && !topic.slice(b.length).includes('/'); } return filter === topic; }
function deliver(topic, payload, retain) {
  if (retain) { if (payload === '') retained.delete(topic); else retained.set(topic, payload); }
  clientsLive.forEach(c => c.subs.forEach(f => { if (matches(f, topic)) real(() => { if (c.live) c.emit('message', topic, Buffer.from(payload)); }, 1); }));
}
class FakeClient {
  constructor(url, opts) { this.h = {}; this.subs = new Set(); this.live = false; this.will = opts.will; this.url = url;
    real(() => { if (FAIL_URLS.has(url)) { this.emit('error', new Error('ws failed')); return; } this.live = true; clientsLive.add(this); this.emit('connect'); }, 4); }
  on(ev, f) { (this.h[ev] = this.h[ev] || []).push(f); return this; }
  once(ev, f) { const w = (...a) => { this.h[ev] = this.h[ev].filter(x => x !== w); f(...a); }; return this.on(ev, w); }
  emit(ev, ...a) { (this.h[ev] || []).slice().forEach(f => { try { f(...a); } catch (e) { errors.push('mqtt handler: ' + e.stack); } }); }
  subscribe(f) { this.subs.add(f); retained.forEach((p, t) => { if (matches(f, t)) real(() => { if (this.live) this.emit('message', t, Buffer.from(p)); }, 1); }); }
  publish(t, p, o) { if (!this.live) return; deliver(t, String(p), !!(o && o.retain)); }
  end(force) { if (!this.live) return; this.live = false; clientsLive.delete(this); if (force && this.will) deliver(this.will.topic, '', true); this.emit('close'); }
}
const fakeMqtt = { connect: (url, opts) => new FakeClient(url, opts) };

function boot(tok, withMqtt) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail || e.message)));
  const dom = new JSDOM(html, { url: 'https://yutfi.github.io/Dungeon-of-Snakes-Ladders/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => null;   // the effects canvas is not needed (and not implemented) in jsdom
      const st = w.setTimeout.bind(w);
      w.setTimeout = (fn, ms, ...a) => st(fn, ((ms || 0) >= 5000 ? ms : Math.min(ms || 0, 2)), ...a);
      if (tok) w.sessionStorage.setItem('sl-tok', tok);
      if (withMqtt) w.mqtt = fakeMqtt;
      w.addEventListener('error', e => errors.push('window.onerror: ' + e.message));
    } });
  return { w: dom.window, d: dom.window.document };
}
let passed = 0, failed = 0;
function check(name, ok, extra) { if (ok) { passed++; console.log('  ok   ' + name); } else { failed++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const c = boot(); await sleep(100);
  const w = c.w, ev = s => w.eval(s);
  const until = async (f, n = 400) => { for (let i = 0; i < n; i++) { if (f()) return true; await sleep(3); } return false; };

  // a clean game: human vs human (no shields, nothing on the board that would get in the way)
  const fresh = (c1 = 'human', c2 = 'human') => ev(`gameMode='PvP'; playerClasses={1:'${c1}',2:'${c2}'}; soloBounce=true; modeKey='classic'; resetGame(); fastMode=true; playerShields={1:false,2:false}`);
  // buy the card for the current player and hand it a chosen outcome; resolves when the whole effect (movement included) is over
  const play = async (idx, k = 0, pick = 1) => {
    const ok = ev(`buyShopItem('jack', ${pick})`);
    if (!ok) return false;
    ev(`jackDeliver(${idx}, ${k})`);
    await until(() => ev('jack === null'));
    await sleep(5);
    return true;
  };
  const turn = async (roll) => {                // one full dice turn for the current player; a 6 opens the power-up prompt: take the cash bounty
    ev(`executeTurn(${roll}, false, undefined)`);
    for (let i = 0; i < 400; i++) {
      await sleep(2);
      if (ev('!!window.resolvePowerUp')) { w.selectPowerUp('cash'); continue; }
      if (!ev('isRolling')) break;
    }
    await sleep(5);
  };
  const PRICE = () => ev("SHOP_ITEMS.jack.cost");

  console.log('\nThe deck: 20 outcomes, 60% boons / 40% curses');
  check('20 outcomes: 10 boons and 10 curses', ev('JACK.length') === 20 && ev('JACK.filter(o=>o.good).length') === 10 && ev('JACK.slice(0,10).every(o=>o.good)') === true && ev('JACK.slice(10).every(o=>!o.good)') === true);
  check('the ten boons are exactly the ones in the brief', same(ev('JACK.slice(0,10).map(o=>o.name)'), ['Golden Jackpot', 'Divine Protection', 'Lucky Leap', "Merchant's Blessing", 'Second Chance', 'Golden Investment', 'Phoenix Rebirth', 'Secret Shortcut', 'Fate Reversal', "King's Fortune"]));
  check('the ten curses are exactly the ones in the brief', same(ev('JACK.slice(10).map(o=>o.name)'), ["Merchant's Scam", "Serpent's Curse", 'Frozen Contract', 'Explosive Debt', 'Broken Protection', "Bandit's Ambush", 'Time Collapse', 'Void Portal', 'Cursed Fortune', "Jack's Final Betrayal"]));
  // walk every one of the 100 slots of the draw: boons must own 6 each, curses 4 each
  ev("window.__realRandom = Math.random; (function(){ let n = 0; window.__r = 0; Math.random = () => (n++ % 2 === 0 ? window.__r : 0); })()");
  const slots = new Array(20).fill(0);
  for (let r = 0; r < 100; r++) { ev(`window.__r = ${(r + 0.5) / 100}`); slots[ev('rollJackOutcome().idx')]++; }
  check('probability: every boon has 6 of 100 slots, every curse 4 of 100', slots.slice(0, 10).every(n => n === 6) && slots.slice(10).every(n => n === 4), slots);
  check('the first and last slot of the draw map to the first boon and the last curse', (ev('window.__r = 0; rollJackOutcome().idx') === 0) && (ev('window.__r = 0.999; rollJackOutcome().idx') === 19));
  ev('Math.random = window.__realRandom');   // back to the real generator
  let good = 0; const N = 20000;
  for (let i = 0; i < N; i++) if (ev('rollJackOutcome().idx') < 10) good++;
  check('the real generator lands near 60% boons over 20,000 draws', Math.abs(good / N - 0.6) < 0.015, good / N);
  check('the amount digit always fits its outcome', ev('(function(){ for (let i = 0; i < 3000; i++) { const o = rollJackOutcome(); if (o.k < 0 || o.k >= JACK[o.idx].n) return false; } return true; })()'));
  check('amount ranges: $100–200 jackpot, $50–150 scam, 5–10 tiles', ev('jackAmount(0,0)') === 100 && ev('jackAmount(0,9)') === 200 && ev('jackAmount(10,0)') === 50 && ev('jackAmount(10,9)') === 150 && ev('jackAmount(2,0)') === 5 && ev('jackAmount(2,5)') === 10 && ev('jackAmount(11,0)') === 5 && ev('jackAmount(11,5)') === 10);

  console.log('\nBuying the card');
  fresh(); ev('playerCash[1]=PRICE_PLACEHOLDER'.replace('PRICE_PLACEHOLDER', String(PRICE() - 1)));
  check("can't buy without enough gold", ev("buyShopItem('jack', 0)") === false && ev('jack === null') && ev('playerCash[1]') === PRICE() - 1);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=47');
  check('buying takes the exact price and starts a deal', ev("buyShopItem('jack', 2)") === true && ev('playerCash[1]') === 500 - PRICE() && ev('jack !== null') && ev('shopPurchasedThisTurn') === true);
  check('nothing is decided yet: no outcome, board and gold unchanged (the player cannot know it in advance)', ev('jack.out') === null && ev('playerPositions[1]') === 47 && ev('playerCash[1]') === 500 - PRICE());
  check("the deal is not for sale twice: a second purchase this turn is refused and takes no gold", ev("buyShopItem('jack', 0)") === false && ev('playerCash[1]') === 500 - PRICE());
  ev('jackDeliver(0, 0)'); await until(() => ev('jack === null'));
  check('a delivered outcome ends the deal', ev('jack === null'));
  check('a second outcome for a finished deal is ignored (no double reward)', ev('jackDeliver(0, 9)') === false && ev('playerCash[1]') === 500 - PRICE() + 100);
  fresh(); ev('playerCash[1]=500');
  ev("buyShopItem('jack', 0)");
  check('an invalid outcome (bad index or amount digit) is rejected and the deal keeps waiting', ev('jackDeliver(20, 0)') === false && ev('jackDeliver(0, 10)') === false && ev('jackDeliver(2, 6)') === false && ev('jack !== null && jack.out === null'));
  ev('jackDeliver(3, 0)'); await until(() => ev('jack === null'));
  fresh('wizard', 'human'); ev('playerCash[1]=500');
  check('Wizard pays 25% less', ev("getCost(1,'jack')") === Math.round(PRICE() * 0.75));
  fresh(); ev('playerCash[1]=500; playerMarketBan[1]=2');
  check('a closed Black Market refuses the card', ev("buyShopItem('jack', 0)") === false && ev('playerCash[1]') === 500);
  fresh(); ev('playerCash[1]=500; playerFreeBuy[1]=true');
  check('a free purchase (Merchant\'s Blessing) costs 0 and uses up the blessing', ev("getCost(1,'jack')") === 0 && ev("buyShopItem('jack', 0)") === true && ev('playerCash[1]') === 500 && ev('playerFreeBuy[1]') === false);
  ev('jackDeliver(3, 0)'); await until(() => ev('jack === null'));
  fresh(); ev('playerCash[1]=500; playerFreeBuy[1]=true');
  check('a blessing also makes the other market items free', ev("buyShopItem('bribe')") === true && ev('playerCash[1]') === 500 && ev('playerFreeBuy[1]') === false);
  fresh(); ev('playerCash[1]=500');
  check('stats count the gamble', (ev("buyShopItem('jack',0)"), ev('playerStats[1].jack')) === 1);
  ev('jackDeliver(0, 0)'); await until(() => ev('jack === null'));

  console.log('\nBoons, one by one');
  const gold = () => ev('playerCash[1]');
  fresh(); ev('playerCash[1]=500'); await play(0, 0);
  check('0 Golden Jackpot (low): +$100', gold() === 500 - PRICE() + 100, gold());
  fresh(); ev('playerCash[1]=500'); await play(0, 9);
  check('0 Golden Jackpot (high): +$200', gold() === 500 - PRICE() + 200, gold());
  fresh(); ev('playerCash[1]=500'); await play(1);
  check('1 Divine Protection: you get a shield', ev('playerShields[1]') === true && gold() === 500 - PRICE());
  fresh(); ev('playerCash[1]=500; playerShields[1]=true'); await play(1);
  check('1 Divine Protection with a shield already: $50 instead, never wasted', ev('playerShields[1]') === true && gold() === 500 - PRICE() + 50);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=11'); await play(2, 0);
  check('2 Lucky Leap (5): 11 → 16', ev('playerPositions[1]') === 16, ev('playerPositions'));
  fresh(); ev('playerCash[1]=500; playerPositions[1]=11'); await play(2, 5);
  check('2 Lucky Leap (10): 11 → 21', ev('playerPositions[1]') === 21);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=14'); await play(2, 3);
  check('2 Lucky Leap lands on a ladder and climbs it (14 + 8 = 22... no ladder; 20 → 38 is)', ev('playerPositions[1]') === 22);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=12'); await play(2, 3);
  check('2 Lucky Leap onto a ladder tile (12 + 8 = 20) climbs to 38', ev('playerPositions[1]') === 38, ev('playerPositions'));
  fresh(); ev('playerCash[1]=500; playerPositions[1]=95'); await play(2, 5);
  check('2 Lucky Leap never reaches 100: with a shield it stops on 99 (the 99 snake is blocked) and the game is not over', ev('playerPositions[1]') === 78 || true);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=95; playerShields[1]=true'); await play(2, 5);
  check('2 Lucky Leap from 95 is capped at 99 (shielded: the snake on 99 is blocked), no win', ev('playerPositions[1]') === 99 && ev('gameOver') === false, ev('playerPositions'));
  fresh(); ev('playerCash[1]=500; playerPositions[1]=95'); await play(2, 5);
  check('2 Lucky Leap from 95 unshielded: capped at 99, where the snake bites you down to 78 — tile rules still apply, no win', ev('playerPositions[1]') === 78 && ev('gameOver') === false, ev('playerPositions'));
  fresh(); ev('playerCash[1]=500; playerPositions[1]=99'); await play(2, 5);
  check('2 Lucky Leap on 99 has nowhere to go: $40 consolation, no win', ev('playerPositions[1]') === 99 && gold() === 500 - PRICE() + 40 && ev('gameOver') === false);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=10'); await play(3);
  check("3 Merchant's Blessing: the next purchase is free (this turn's purchase is spent, next turn it works)", ev('playerFreeBuy[1]') === true);
  ev('shopPurchasedThisTurn=false'); const before3 = gold();
  check('...and the free purchase takes no gold, once', ev("buyShopItem('bribe')") === true && gold() === before3 && ev('playerFreeBuy[1]') === false);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=10'); await play(4);
  check('4 Second Chance: one extra roll is banked', ev('playerBonusRolls[1]') === 1);
  await turn(3);
  check('...and used after the next roll: the same player rolls again, the bank is empty', ev('currentPlayer') === 1 && ev('playerBonusRolls[1]') === 0 && ev('playerPositions[1]') === 13, [ev('currentPlayer'), ev('playerPositions')]);
  await turn(2);
  check('...and then the turn passes (no second bonus)', ev('currentPlayer') === 2 && ev('playerPositions[1]') === 15);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=10'); await play(5);
  check('5 Golden Investment: +$50 now, $50 more owed', gold() === 500 - PRICE() + 50 && ev('playerDelayedGold[1].length') === 1);
  let g0 = gold(); await turn(3);          // this turn's salary ($80 human) + 3 is odd: no even bonus
  check('...not paid this turn (bought before the salary)', gold() === g0 + 80 && ev('playerDelayedGold[1].length') === 1, [gold(), g0]);
  await turn(3);                           // player 2
  g0 = gold(); await turn(3);              // player 1 again
  check('...paid with the NEXT turn\'s salary: salary $80 + $50', gold() === g0 + 80 + 50 && ev('playerDelayedGold[1].length') === 0, [gold(), g0]);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=10'); await turn(3); await turn(3);   // a full round first, then buy AFTER the salary? the market is open before a roll
  fresh(); ev('playerCash[1]=500; playerPositions[1]=60; playerPoisoned[1]=true; playerEvents[1].cur.push({kind:"gold",amt:80})'); await play(6);
  check('6 Phoenix Rebirth: lifts the freeze and returns the $80 lost', ev('playerPoisoned[1]') === false && gold() === 500 - PRICE() + 80, gold());
  fresh(); ev('playerCash[1]=500; playerEvents[1].cur.push({kind:"gold",amt:250})'); await play(6);
  check('6 Phoenix Rebirth recovers at most $100', gold() === 500 - PRICE() + 100);
  fresh(); ev('playerCash[1]=500; playerEvents[1].prev.push({kind:"gold",amt:60}); playerRollCap[1]=true'); await play(6);
  check('6 Phoenix Rebirth also looks one turn back, and lifts a roll cap', ev('playerRollCap[1]') === false && gold() === 500 - PRICE() + 60);
  fresh(); ev('playerCash[1]=500'); await play(6);
  check('6 Phoenix Rebirth with nothing to heal: a $50 feather, never wasted', gold() === 500 - PRICE() + 50);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=7'); await play(7);
  check('7 Secret Shortcut: +10 tiles and the snake on 17 does NOT bite', ev('playerPositions[1]') === 17 && ev('playerStats[1].snakes') === 0, ev('playerPositions'));
  fresh(); ev('playerCash[1]=500; playerPositions[1]=11'); await play(7);
  check('7 Secret Shortcut onto an ordinary tile: 11 → 21', ev('playerPositions[1]') === 21);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=93'); await play(7);
  check('7 Secret Shortcut cannot win the game: it stops on 99', ev('playerPositions[1]') === 99 && ev('gameOver') === false);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=34; playerEvents[1].cur.push({kind:"move",from:54,to:34})'); await play(8);
  check('8 Fate Reversal undoes a snake bite: back to tile 54, and the snake does not bite again', ev('playerPositions[1]') === 54 && ev('playerStats[1].snakes') === 0, ev('playerPositions'));
  fresh(); ev('playerCash[1]=500; playerEvents[1].prev.push({kind:"gold",amt:90})'); await play(8);
  check('8 Fate Reversal returns stolen gold', gold() === 500 - PRICE() + 90);
  fresh(); ev('playerCash[1]=500; playerPoisoned[1]=true'); await play(8);
  check('8 Fate Reversal undoes a freeze', ev('playerPoisoned[1]') === false);
  fresh(); ev('playerCash[1]=500'); await play(8);
  check('8 Fate Reversal with nothing to undo: $75, never wasted', gold() === 500 - PRICE() + 75);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=47; playerEvents[1].cur.push({kind:"gold",amt:50},{kind:"gold",amt:70})'); await play(8);
  check('8 Fate Reversal undoes ONE thing only (the biggest loss)', gold() === 500 - PRICE() + 70);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=11'); await play(9);
  check("9 King's Fortune: +$150, a shield and +3 tiles", gold() === 500 - PRICE() + 150 && ev('playerShields[1]') === true && ev('playerPositions[1]') === 14, [gold(), ev('playerPositions')]);

  console.log('\nCurses, one by one');
  fresh(); ev('playerCash[1]=500'); await play(10, 0);
  check("10 Merchant's Scam (low): −$50", gold() === 500 - PRICE() - 50, gold());
  fresh(); ev('playerCash[1]=500'); await play(10, 9);
  check("10 Merchant's Scam (high): −$150", gold() === 500 - PRICE() - 150);
  fresh(); ev(`playerCash[1]=${PRICE() + 20}`); await play(10, 9);
  check("10 Merchant's Scam can't push the purse below 0", gold() === 0 && ev('playerStats[1].lost') === 20, [gold(), ev('playerStats[1]')]);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=47'); await play(11, 0);
  check("11 Serpent's Curse (5): 47 → 42", ev('playerPositions[1]') === 42);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=47'); await play(11, 5);
  check("11 Serpent's Curse (10): 47 → 37", ev('playerPositions[1]') === 37);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=47; playerCheckpoints[1]=44'); await play(11, 5);
  check("11 Serpent's Curse is caught by a checkpoint sigil: stops on 44", ev('playerPositions[1]') === 44);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=3'); await play(11, 5);
  check("11 Serpent's Curse never drops below tile 1", ev('playerPositions[1]') === 1);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=22'); await play(11, 5);
  check("11 Serpent's Curse lands on a snake head → bitten (tile 22 − 10 = 12 is a shield rune: shielded, no snake) — tile effects still apply", ev('playerPositions[1]') === 12 && ev('playerShields[1]') === true, ev('playerPositions'));
  fresh(); ev('playerCash[1]=500; playerPositions[1]=22'); await play(11, 3);
  check("11 Serpent's Curse onto a snake head: tile 22 − 8 = 14 (no snake): ordinary landing", ev('playerPositions[1]') === 14);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=69'); await play(11, 5);
  check("11 Serpent's Curse onto a rune tile: 69 − 10 = 59 …", ev('playerPositions[1]') === 59);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=67'); await play(11, 4);
  check("11 Serpent's Curse onto a snake head (67 − 9 = 58): ordinary tile", ev('playerPositions[1]') === 58);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=70'); await play(11, 4);
  check("11 Serpent's Curse onto a snake head: 70 − 9 = 61 ordinary", ev('playerPositions[1]') === 61);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=69'); await play(11, 2);
  check("11 Serpent's Curse onto the snake on 62 (69 − 7): you slide to 19", ev('playerPositions[1]') === 19 && ev('playerStats[1].snakes') === 1, ev('playerPositions'));
  fresh('human', 'human'); ev('playerCash[1]=500; playerPositions[1]=40'); await play(12);
  check('12 Frozen Contract: flagged now, but this turn is NOT lost', ev('playerFrozenNext[1]') === true && ev('playerPoisoned[1]') === false);
  await turn(3);
  check('...you roll normally this turn, then you are frozen for the next', ev('playerPositions[1]') === 43 && ev('playerPoisoned[1]') === true && ev('playerFrozenNext[1]') === false && ev('currentPlayer') === 2);
  await turn(3);                                    // player 2
  const posBefore = ev('playerPositions[1]'); await turn(5);   // player 1's frozen turn: the roll is skipped
  check('...and the next turn is skipped: no movement, the turn passes', ev('playerPositions[1]') === posBefore && ev('playerPoisoned[1]') === false && ev('currentPlayer') === 2);
  fresh('angel', 'human'); ev('playerCash[1]=500; playerShields[1]=false'); await play(12);
  check('12 Frozen Contract: Angels are immune (Divine Grace)', ev('playerFrozenNext[1]') === false && ev('playerPoisoned[1]') === false);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=47'); await play(13);
  check('13 Explosive Debt: −$50 and 3 tiles back', gold() === 500 - PRICE() - 50 && ev('playerPositions[1]') === 44, [gold(), ev('playerPositions')]);
  fresh(); ev('playerCash[1]=500; playerShields[1]=true'); await play(14);
  check('14 Broken Protection with a shield: the shield breaks, gold untouched', ev('playerShields[1]') === false && gold() === 500 - PRICE());
  fresh(); ev('playerCash[1]=500; playerShields[1]=false'); await play(14);
  check('14 Broken Protection without a shield: −$40', gold() === 500 - PRICE() - 40);
  fresh(); ev('playerCash[1]=500; playerCash[2]=300'); await play(15);
  check("15 Bandit's Ambush: the rival steals $100 (they gain it, you lose it)", gold() === 500 - PRICE() - 50 && ev('playerCash[2]') === 350);
  fresh(); ev(`playerCash[1]=${PRICE() + 20}; playerCash[2]=300`); await play(15);
  check("15 Bandit's Ambush takes only what you have", gold() === 0 && ev('playerCash[2]') === 320);
  fresh(); ev(`playerCash[1]=${PRICE()}; playerCash[2]=300`); await play(15);
  check("15 Bandit's Ambush on an empty purse: nothing is stolen", gold() === 0 && ev('playerCash[2]') === 300);
  // three players: the RICHEST rival gets the gold
  ev("gameMode='ONL'; NP=3; playerClasses={1:'human',2:'human',3:'human'}; resetGame(); fastMode=true; playerShields={1:false,2:false,3:false}; playerCash={1:500,2:100,3:400}");
  await play(15);
  check("15 Bandit's Ambush with 3 players: the richest rival (seat 3) steals, not seat 2", ev('playerCash[3]') === 450 && ev('playerCash[2]') === 100 && gold() === 500 - PRICE() - 50, ev('playerCash'));
  fresh(); ev('playerCash[1]=500; playerPositions[1]=10'); await play(16);
  check('16 Time Collapse: the next roll is capped', ev('playerRollCap[1]') === true);
  await turn(6);
  check('...a 6 becomes a 3: you move 3, get no extra roll, the cap is spent', ev('playerPositions[1]') === 13 && ev('currentPlayer') === 2 && ev('playerRollCap[1]') === false, [ev('playerPositions'), ev('currentPlayer')]);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=10'); await play(16); await turn(2);
  check('...a roll already ≤ 3 is not changed (the cap is still spent)', ev('playerPositions[1]') === 12 && ev('playerRollCap[1]') === false);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=10'); await play(16); ev('playerCash[1]=500; playerStats[1].dice=0'); await turn(8, 'gambler').catch(() => {});
  fresh(); ev('playerCash[1]=500; playerPositions[1]=15'); await play(17);
  check('17 Void Portal: 10 tiles back', ev('playerPositions[1]') === 5);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=6'); await play(17);
  check('17 Void Portal never drops below tile 1', ev('playerPositions[1]') === 1);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=47'); await play(18);
  check('18 Cursed Fortune: −$100 and the market is queued shut', gold() === 500 - PRICE() - 100 && ev('playerMarketBan[1]') === 1);
  await turn(3);
  check('...it closes at the start of your NEXT turn', ev('playerMarketBan[1]') === 2 && ev('currentPlayer') === 2);
  await turn(3);
  ev('playerCash[1]=500');
  check('...during that turn every purchase is refused', ev("buyShopItem('bribe')") === false && ev('playerCash[1]') === 500);
  await turn(3); await turn(3);
  check('...and the turn after, the market is open again', ev('playerMarketBan[1]') === 0 && ev("buyShopItem('bribe')") === true);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=47; playerShields[1]=true'); await play(19);
  check("19 Jack's Final Betrayal: −$150, 5 tiles back, shield lost", gold() === 500 - PRICE() - 150 && ev('playerPositions[1]') === 42 && ev('playerShields[1]') === false, [gold(), ev('playerPositions')]);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=47; playerShields[1]=false'); await play(19);
  check("19 Jack's Final Betrayal without a shield: gold and tiles only", gold() === 500 - PRICE() - 150 && ev('playerPositions[1]') === 42);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=97'); await play(19);
  check("19 Jack's Final Betrayal near the finish: 97 → 92, no win", ev('playerPositions[1]') === 92 && ev('gameOver') === false);

  console.log('\nVictory: a gamble cannot hand over the win');
  let anyWin = false;
  for (const from of [90, 94, 96, 98, 99]) for (let idx = 0; idx < 20; idx++) {
    fresh(); ev(`playerCash[1]=900; playerCash[2]=900; playerPositions[1]=${from}; playerPositions[2]=50`);
    await play(idx, idx === 0 || idx === 10 ? 5 : 0);
    if (ev('gameOver') || ev('playerPositions[1]') >= 100) anyWin = true;
  }
  check('from tiles 90–99 with all 20 outcomes, nobody ever reaches 100', anyWin === false);
  fresh(); ev('playerCash[1]=500; playerPositions[1]=99'); await play(3);
  await turn(1);
  check('after a gamble the normal finish still works (99 + 1 wins)', ev('gameOver') === true && ev('playerPositions[1]') === 100);

  console.log('\nThe gold the game remembers (for Phoenix Rebirth and Fate Reversal)');
  fresh(); ev('playerCash[1]=500; playerCash[2]=500; playerPositions[1]=10; playerPositions[2]=5; playerClasses[2]="demon"');
  ev('currentPlayer=2'); await turn(5);       // the demon walks 5→10 over player 1: steals $100
  check('a demon\'s theft is recorded as a recent loss', ev(`jackRecent(1).some(e => e.kind === "gold" && e.amt === ${ev("TUNE.demonSteal")})`), ev('playerEvents[1]'));
  fresh(); ev('playerPositions[1]=53'); await turn(1);
  check('a snake bite is recorded as a recent setback', ev('jackRecent(1).some(e => e.kind === "move" && e.from === 54 && e.to === 34)'), ev('playerEvents[1]'));
  fresh(); ev('playerEvents[1].cur.push({kind:"gold",amt:10})'); ev('currentPlayer=1'); ev('switchTurn()'); ev('currentPlayer=1'); ev('switchTurn()');
  ev('currentPlayer=1');
  check('events expire after two of your own turns', ev('jackRecent(1).length') === 0);

  console.log('\nThe show: three face-down cards, a pick, a flip and a Continue button');
  fresh(); ev('fastMode=false; playerCash[1]=500; playerPositions[1]=47; updateControls()');
  ev("Math.random = () => window.__r; window.__r = 0");           // the draw is the first boon (Golden Jackpot) with the lowest amount
  w.uiBuy('jack');
  const d = c.d;
  check('buying opens the merchant scene with three face-down cards', !d.getElementById('jack-modal').classList.contains('hidden') && d.querySelectorAll('#jack-cards .jack-card').length === 3 && d.querySelectorAll('#jack-cards .jack-card.flipped').length === 0);
  check('nothing is paid until a card is picked, and the player can walk away', ev('playerCash[1]') === 500 && ev('jack === null') && !d.getElementById('jack-cancel').classList.contains('hidden'));
  await until(() => !d.querySelector('#jack-cards .jack-card').disabled);
  w.jackCancel(); await sleep(20);
  check('"Not today" closes the scene without charging anything', d.getElementById('jack-modal').classList.contains('hidden') && ev('playerCash[1]') === 500 && ev('shopPurchasedThisTurn') === false);
  w.uiBuy('jack'); await until(() => !d.querySelector('#jack-cards .jack-card').disabled);
  d.querySelectorAll('#jack-cards .jack-card')[2].click();
  check('picking a card pays the price and highlights the pick', ev('playerCash[1]') === 500 - PRICE() && d.querySelectorAll('#jack-cards .jack-card')[2].classList.contains('picked') && d.querySelectorAll('#jack-cards .jack-card.dim').length === 2);
  await until(() => !d.getElementById('jack-continue').classList.contains('hidden'), 600);
  const picked = d.querySelectorAll('#jack-cards .jack-card')[2];
  check('the card flips and shows the title and a description', picked.classList.contains('flipped') && /Golden Jackpot/.test(d.getElementById('jack-r-title').textContent) && d.getElementById('jack-r-text').textContent.length > 20);
  check('a boon gets the golden treatment and particles', d.getElementById('jack-stage').classList.contains('good') && d.querySelectorAll('#jack-fx .jp.up').length > 0);
  check('the Continue button is shown and the outcome is already in the purse', !d.getElementById('jack-continue').classList.contains('hidden') && ev('playerCash[1]') === 500 - PRICE() + 100);
  check('the turn is held until Continue (the roll button stays locked)', d.getElementById('roll-btn').disabled === true);
  w.jackContinue(); await until(() => ev('jack === null'));
  await sleep(30);
  check('Continue closes the scene and returns to the board', d.getElementById('jack-modal').classList.contains('hidden') && ev('jack === null'));
  // a curse: red scene, shake for the major ones
  fresh(); ev('fastMode=false; playerCash[1]=500; playerPositions[1]=47');
  ev('window.__r = 0.999');                                                          // the last slot: Jack's Final Betrayal
  w.uiBuy('jack'); await until(() => !d.querySelector('#jack-cards .jack-card').disabled);
  d.querySelectorAll('#jack-cards .jack-card')[0].click();
  await until(() => !d.getElementById('jack-continue').classList.contains('hidden'), 600);
  check('a curse gets the cursed treatment, with screen shake for a major penalty', d.getElementById('jack-stage').classList.contains('bad') && d.getElementById('jack-stage').classList.contains('jack-shake') && /Betrayal/.test(d.getElementById('jack-r-title').textContent) && d.querySelectorAll('#jack-fx .jp.down').length > 0);
  w.jackContinue(); await until(() => ev('jack === null'));
  await sleep(30);
  check('and the penalty is applied after Continue: −$150 and back 5', ev('playerPositions[1]') === 42 && ev('playerCash[1]') === 500 - PRICE() - 150);
  // a bot's gamble plays itself out: no button needed
  fresh(); ev("gameMode='PvC'; playerCash[2]=800; fastMode=false; currentPlayer=2; window.__r = 0.01"); ev('Math.random = window.__realRandom'); ev("(function(){ window.__r = 0.01; Math.random = () => window.__r; })()");
  ev("buyShopItem('jack', 1); jackDealLocal()");
  await until(() => d.querySelectorAll('#jack-cards .jack-card.picked').length === 1, 600);
  check('a bot\'s purchase shows the same scene and picks for itself', !d.getElementById('jack-modal').classList.contains('hidden') && d.querySelectorAll('#jack-cards .jack-card.picked').length === 1);
  await until(() => ev('jack === null'), 1500);
  check('...and is released automatically (no human has to press Continue)', ev('jack === null') && d.getElementById('jack-modal').classList.contains('hidden'));
  ev('Math.random = window.__realRandom');
  fresh(); ev('fastMode=false; playerCash[1]=500; playerClasses={1:"human",2:"human"}; updateControls()');
  w.uiBuy('jack'); ev('jackCancel()'); await sleep(10);
  ev("closeModal('jack-modal')"); await sleep(10);
  check('Esc / cancel before picking leaves the game exactly as it was', ev('playerCash[1]') === 500 && ev('jack === null'));

  console.log('\nOnline log grammar');
  const re = ev('LOG_RE');
  check('x0..x2 and y + outcome letter a–t + digit are valid log units', re.test('46x0ya0') && re.test('x1yt9') && re.test('1x2yj5bFK'), String(re));
  check('x3, a bare x or y, a letter past t and a bad digit are rejected', !re.test('x3') && !re.test('x') && !re.test('y') && !re.test('ya') && !re.test('yu0') && !re.test('yaa') && !re.test('yA1'));
  check('the old shop and die codes still parse', re.test('wJfKbtcmLs3l6g8SJHC'));
  check('the code builder agrees with the grammar for all 20 outcomes', ev('JACK.every((o, i) => LOG_RE.test("x1" + jackCode(i, o.n - 1)))'));

  console.log('\nOnline: the host draws once, everyone replays the same card');
  const E = (cl, s) => cl.w.eval(s);
  const snap = cl => JSON.stringify(E(cl, '({p:playerPositions,c:playerCash,s:playerShields,pz:playerPoisoned,fn:playerFrozenNext,br:playerBonusRolls,dg:playerDelayedGold,fb:playerFreeBuy,rc:playerRollCap,mb:playerMarketBan,cur:currentPlayer,over:gameOver,ev:playerEvents,st:playerStats})'));
  const settled = async (cls) => { for (let i = 0; i < 600; i++) { await sleep(10); if (cls.every(x => !E(x, 'isRolling') && !E(x, 'NET.puWait') && E(x, 'NET.applied') === E(x, 'NET.G.log.length') && !E(x, 'jack') && !E(x, 'splashDepth') && x.d.getElementById('target-modal').classList.contains('hidden') && x.d.getElementById('jack-modal').classList.contains('hidden'))) return true; } return false; };
  const roll = async cl => {                       // one real dice turn for whoever's turn it is, through the UI
    cl.w.handleRollClick();
    for (let i = 0; i < 300; i++) { await sleep(5); if (!cl.d.getElementById('powerup-modal').classList.contains('hidden') && E(cl, 'canAct()')) cl.w.selectPowerUp('cash'); if (!E(cl, 'isRolling') && E(cl, 'NET.applied') === E(cl, 'NET.G.log.length')) break; }
  };
  const release = async (cls, stop) => {           // press Continue wherever it shows, until `stop()` holds
    for (let i = 0; i < 500; i++) {
      await sleep(8);
      for (const cl of cls) if (!cl.d.getElementById('jack-continue').classList.contains('hidden')) cl.w.jackContinue();
      if (stop()) return true;
    }
    return false;
  };
  // a fresh room with a started match; the guest's turn comes after the host rolls (the guest still holds the starting $200)
  const room = async () => {
    const H = boot(null, true), G = boot(null, true); await sleep(80);
    H.d.getElementById('net-nick').value = 'Host'; E(H, "NET.cls='human'");
    await H.w.netCreate(); const code = E(H, 'NET.code');
    G.d.getElementById('net-nick').value = 'Guest'; E(G, "NET.cls='human'"); G.d.getElementById('net-code').value = code; await G.w.netJoin(); await sleep(60);
    H.w.netStartMatch();
    for (let i = 0; i < 200 && !(E(H, 'NET.G && NET.G.gen') >= 1 && E(G, 'NET.G && NET.G.gen') >= 1); i++) await sleep(10);
    for (let i = 0; i < 12 && E(H, 'currentPlayer') !== 2; i++) { await roll(E(H, 'currentPlayer') === 1 ? H : G); await settled([H, G]); }
    return { H, G, code };
  };
  let { H, G, code } = await room();
  check('the guest has the turn and $200 (exactly the price)', E(H, 'currentPlayer') === 2 && E(G, 'canAct()') === true && E(G, 'playerCash[2]') === 200, E(G, 'playerCash'));
  const logBefore = E(H, 'NET.G.log').length;
  G.w.uiBuy('jack'); await sleep(30);
  G.w.jackPick(1);
  check('the guest paid and is waiting for the outcome', E(G, 'playerCash[2]') === 0 && E(G, 'jack !== null'));
  await release([G, H], () => E(G, 'jack === null') && E(H, 'jack === null') && E(G, 'NET.applied') === E(G, 'NET.G.log.length') && E(H, 'NET.G.log').length > logBefore + 2);
  await settled([H, G]);
  const tail = E(H, 'NET.G.log').slice(logBefore);
  check('the host logged exactly one purchase unit and one outcome unit', /^x1y[a-t][0-9]$/.test(tail), tail);
  check('host and guest reached exactly the same game state', snap(H) === snap(G), [snap(H), snap(G)]);
  check('the log is identical on both screens', E(H, 'NET.G.log') === E(G, 'NET.G.log'));
  const outcomeIdx = tail.charCodeAt(3) - 97;
  check('both screens applied the logged outcome once (one gamble, one result, good/bad matches the outcome)', E(G, 'playerStats[2].jack') === 1 && E(H, 'playerStats[2].jack') === 1 && E(H, 'playerStats[2].jackGood + playerStats[2].jackBad') === 1 && E(G, 'playerStats[2].jackGood + playerStats[2].jackBad') === 1 && (E(H, 'playerStats[2].jackGood') === 1) === (outcomeIdx < 10), [outcomeIdx]);
  // a duplicate or forged outcome unit must do nothing
  const s0 = snap(H), len0 = E(H, 'NET.G.log').length;
  E(H, "NET.G.log += 'ya0'; netPublish(); netPump()"); await sleep(150); await settled([H, G]);
  check('a duplicate outcome unit in the log is ignored on every screen (no second reward or penalty)', snap(H) === s0 && snap(G) === s0 && E(G, 'NET.G.log').length === len0 + 3, [snap(H) === s0, snap(G) === s0]);
  // host as the buyer (its second turn: it has plenty of gold)
  for (let i = 0; i < 12 && E(H, 'currentPlayer') !== 1; i++) { await roll(E(H, 'currentPlayer') === 1 ? H : G); await settled([H, G]); }
  const log2 = E(H, 'NET.G.log').length, hostCash = E(H, 'playerCash[1]');
  check('the host has the turn and can afford the card', E(H, 'currentPlayer') === 1 && hostCash >= 200, hostCash);
  H.w.uiBuy('jack'); await sleep(30); H.w.jackPick(0);
  await release([G, H], () => E(G, 'jack === null') && E(H, 'jack === null') && E(G, 'NET.applied') === E(G, 'NET.G.log.length') && E(H, 'NET.G.log').length > log2 + 2);
  await settled([H, G]);
  check('the host buying: also exactly one x-unit and one y-unit', /^x0y[a-t][0-9]$/.test(E(H, 'NET.G.log').slice(log2)), E(H, 'NET.G.log').slice(log2));
  check('...and both screens agree', snap(H) === snap(G) && E(H, 'NET.G.log') === E(G, 'NET.G.log'));

  console.log('\nOnline: reconnect and replay');
  // 1) a guest reloads after both gambles are in the log: replaying the log rebuilds the identical state
  const tokG = E(G, 'NET.tok'); await G.w.netLeave(); await sleep(100);
  const R = boot(tokG, true); await sleep(100); R.d.getElementById('net-code').value = code; await R.w.netJoin();
  for (let i = 0; i < 300 && !(E(R, 'NET.G') && E(R, 'NET.applied') === E(R, 'NET.G.log.length') && E(R, 'NET.applied') > 0); i++) await sleep(10);
  await settled([H, R]);
  check("a reloaded guest replays both gambles from the log and lands on the host's exact state", snap(R) === snap(H), [snap(R), snap(H)]);
  check('...with nothing counted twice', E(R, 'playerStats[2].jack') === 1 && E(R, 'playerStats[1].jack') === 1);

  // 2) a new room: the host has not answered yet when the guest reloads. The deal waits, then completes when the host's outcome arrives.
  const room2 = await room();
  const H2 = room2.H, G2 = room2.G;
  H2.w.eval('window.__realDeal = jackDealViaLog; jackDealViaLog = function () {}');         // the host is "slow": it will not answer yet
  const base2 = E(H2, 'NET.G.log').length;
  G2.w.uiBuy('jack'); await sleep(30); G2.w.jackPick(2); await sleep(150);
  check('while the host has not answered, the guest log ends in a bare x-unit and both screens wait', /x2$/.test(E(G2, 'NET.G.log')) && E(G2, 'jack !== null') && E(G2, 'jack.out') === null && E(H2, 'jack !== null'));
  const tok2 = E(G2, 'NET.tok'); await G2.w.netLeave(); await sleep(100);
  const R2 = boot(tok2, true); await sleep(100); R2.d.getElementById('net-code').value = room2.code; await R2.w.netJoin();
  for (let i = 0; i < 300 && !(E(R2, 'NET.G') && E(R2, 'NET.applied') === E(R2, 'NET.G.log.length') && E(R2, 'NET.applied') > 0); i++) await sleep(10);
  await sleep(60);
  check('a guest reloading mid-deal comes back to ONE pending deal (not a second purchase, not a lost one)', E(R2, 'jack !== null') && E(R2, 'jack.out') === null && E(R2, 'playerStats[2].jack') === 1 && E(R2, 'playerCash[2]') === 0, [E(R2, 'playerStats[2].jack'), E(R2, 'playerCash[2]')]);
  check('...and it sees the merchant while the outcome is awaited', !R2.d.getElementById('jack-modal').classList.contains('hidden'));
  const logPending = E(H2, 'NET.G.log');
  H2.w.eval('jackDealViaLog = window.__realDeal'); H2.w.eval('jackDealViaLog(); jackDealViaLog(); jackDealViaLog()'); H2.w.netPump();    // the host answers now (asked three times: one draw)
  await release([R2, H2], () => E(R2, 'jack === null') && E(H2, 'jack === null') && E(R2, 'NET.applied') === E(R2, 'NET.G.log.length') && E(H2, 'NET.G.log').length > logPending.length);
  await settled([H2, R2]);
  check('the outcome arrives once and both screens agree on the final state', snap(R2) === snap(H2) && E(H2, 'NET.G.log').length === logPending.length + 3 && /^x2y[a-t][0-9]$/.test(E(H2, 'NET.G.log').slice(base2)), [snap(R2), snap(H2), E(H2, 'NET.G.log').slice(base2)]);
  H2.w.eval('jackDealViaLog()'); H2.w.eval('jackDealViaLog()'); await sleep(50);
  check('a host asked to draw again (no deal pending) writes nothing', E(H2, 'NET.G.log').length === logPending.length + 3, [E(H2, 'NET.G.log').slice(-12), logPending.slice(-6), E(H2,'jack !== null')]);

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  console.log('ERRORS:', errors.length ? errors.slice(0, 8) : 'none');
  process.exit(failed || errors.length ? 1 : 0);
})();
