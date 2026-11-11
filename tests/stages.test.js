/* Runs every cinematic (stage) with animations ON, so the visual code is executed too (the logic tests skip it via fastMode).
   Passes when each stage builds without errors, finishes, leaves the overlay closed and nothing stuck in the splash queue. */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/<script src=[^>]*><\/script>/g, '');
const errors = [];
process.on('unhandledRejection', e => errors.push('unhandled: ' + (e && e.stack || e)));
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail || e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ').slice(0, 400)));
const dom = new JSDOM(html, { url: 'https://yutfi.github.io/Dungeon-of-Snakes-Ladders/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) { const st = w.setTimeout.bind(w); w.setTimeout = (fn, ms, ...a) => st(fn, Math.min(ms || 0, 3), ...a); w.HTMLCanvasElement.prototype.getContext = () => null; w.addEventListener('error', e => errors.push('window.onerror: ' + e.message)); } });
const w = dom.window, E = c => w.eval(c), A = c => w.eval('(async()=>{' + c + '})()');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };
const setup = (mode, classes, seed) => E(`gameMode='ONL'; NP=${classes.length}; playerClasses=${JSON.stringify(Object.fromEntries(classes.map((c, i) => [i + 1, c])))}; NET.nicks=${JSON.stringify(classes.map((c, i) => 'P' + (i + 1)))}; NET.G={seed:${seed}}; modeKey='${mode}'; fastMode=false; document.querySelectorAll('.modal').forEach(m=>{m.classList.add('hidden');m.dataset.state='closed'}); resetGame(); RPG.tiles={}; RPG.cool={}; PLAYERS().forEach(p=>{playerCash[p]=500; playerShields[p]=false}); memesOn=true;`);
async function idle() { const t0 = Date.now(); while (Date.now() - t0 < 90000 && (E('splashDepth') > 0 || !E("document.getElementById('stage').classList.contains('hidden')"))) await new Promise(r => setTimeout(r, 4)); return E('splashDepth') === 0 && E("document.getElementById('stage').classList.contains('hidden')"); }
async function clickChoice(idx) { for (let i = 0; i < 2000; i++) { await new Promise(r => setTimeout(r, 3)); const b = w.document.querySelectorAll('#stage .st-choices button'); if (b.length) { b[idx % b.length].click(); return true; } } return false; }
async function check(name, fn) { if (process.env.ONLY && !name.startsWith(process.env.ONLY)) return; const e0 = errors.length; try { await fn(); } catch (e) { errors.push('EXC ' + name + ': ' + e.stack); } const done = await idle(); ok(done, name + ': stage finished and closed'); ok(errors.length === e0, name + ': no errors' + (errors.length > e0 ? ' → ' + errors.slice(e0).join(' | ').slice(0, 300) : '')); console.log((done && errors.length === e0 ? '✔ ' : '✘ ') + name); }

(async () => {
  await new Promise(r => setTimeout(r, 200));
  // every chest outcome (incl. the Mimic), every portal outcome, every wheel slice, camp, traps
  for (const [name, tile, seeds] of [['chest', 'chest', 14], ['portal', 'portal', 14], ['wheel', 'wheel', 5]]) {
    await check(name + ' cinematics', async () => { for (let s = 1; s <= seeds; s++) { setup('std', ['human', 'demon', 'angel'], s); E(`RPG.tiles[40]={t:'${tile}'}; playerPositions[1]=40; playerPositions[2]=60; RPG.s=${s * 7}`); await A('await rpgResolveTile(1,40)'); await idle(); } });
  }
  await check('rest camp', async () => { setup('std', ['human', 'demon'], 1); E("RPG.tiles[20]={t:'camp'}; playerPositions[1]=20; playerPoisoned[1]=true"); await A('await rpgResolveTile(1,20)'); });
  await check('all four traps', async () => { for (const k of ['spike', 'poison', 'steal', 'jail']) { setup('std', ['human', 'demon'], 2); E(`RPG.tiles[25]={t:'trap',k:'${k}',hidden:true,rev:false}; playerPositions[1]=25; RPG.s=${k.length}`); await A('await rpgResolveTile(1,25)'); } });
  await check('altar (accept and refuse, answered on the stage buttons)', async () => {
    for (const idx of [0, 1, 1, 0]) { setup('std', ['human', 'demon'], 5 + idx); E("RPG.tiles[50]={t:'altar'}; playerPositions[1]=50; RPG.s=" + (idx + 3)); const p = A('await rpgResolveTile(1,50)'); ok(await clickChoice(idx), 'altar shows its choice buttons'); await p; }
  });
  await check('boss fights (all three bosses, several outcomes)', async () => {
    for (const [k, tile] of [['ice', 33], ['dragon', 56], ['lich', 82]]) for (let s = 1; s <= 4; s++) { setup('std', ['human', 'wizard', 'angel'], s); E(`RPG.tiles[${tile}]={t:'boss',k:'${k}'}; RPG.boss.${k}={hp:${s === 4 ? 2 : 20},max:20,alive:true,dmg:{}}; playerPositions[1]=${tile}; RPG.s=${s * 13}`); await A(`await rpgResolveTile(1,${tile})`); }
  });
  await check('world events (all ten)', async () => { for (let s = 1; s <= 60; s++) { setup('std', ['human', 'wizard', 'angel'], s); E(`RPG.s=${s}; RPG.ev=null; rpgWorldEvent()`); await idle(); } });
  await check('arena: duel, competition, alliance (accept), alliance (decline), betrayal', async () => {
    setup('std', ['human', 'demon', 'angel'], 3); await A('await rpgArena("duel", 2, false)');
    setup('std', ['human', 'demon', 'angel'], 3); await A('await rpgArena("comp", 0, false)');
    for (const idx of [0, 1]) { setup('std', ['human', 'demon'], 3); const p = A('await rpgArena("offer", 2, false)'); ok(await clickChoice(idx), 'alliance offer buttons'); await p; }
    setup('std', ['human', 'demon'], 3); E('RPG.allies=[{a:1,b:2,since:0,exp:99}]; RPG.round=3'); await A('await rpgArena("betray", 0, false)');
  });
  await check('black market cinematics', async () => { setup('std', ['demon', 'human', 'angel'], 3); E('playerCash[1]=5000; RP(1).lastFrom=40; playerPositions[1]=20'); for (const k of ['rewind', 'mirror', 'loaded', 'cloak', 'hook', 'bounty', 'lightning']) { E(`shopPurchasedThisTurn=false; RPG.round+=9`); E(`buyShopItem('${k}', 2)`); await idle(); } });
  await check('wanted, lap, elimination, skipped turns', async () => {
    setup('std', ['human', 'demon'], 3); E('playerPositions[1]=70; playerPositions[2]=10; rpgWantedTick()'); await idle();
    setup('richest', ['human', 'demon'], 3); await A('await rpgLap(1)');
    setup('hardcore', ['human', 'demon', 'angel'], 3); E('rpgEliminate(3)'); await idle();
    setup('std', ['human', 'demon'], 3); E('RP(1).skip=1; RP(1).why="jail"'); await A('await executeTurn(3,false)'); await idle(); E('RP(2).skip=1'); await A('await executeTurn(3,false)');
  });
  await check('a few complete live turns with animations on', async () => { setup('std', ['human', 'demon'], 9); E("promptPowerUpChoice = () => applyPowerUp(currentPlayer, 'shield')"); for (let i = 0; i < 14; i++) { await A('await executeTurn(' + (1 + (i % 5)) + ', false)'); await idle(); } });
  console.log(`\n${pass} checks passed, ${fail} failed`); console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
  process.exit(fail || errors.length ? 1 : 0);
})();
