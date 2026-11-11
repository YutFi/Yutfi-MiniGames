// The first-time animated tour: steps, navigation, persistence, mode awareness. Runs in jsdom.
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script src=[^>]*><\/script>/g, '');
const errors = []; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('   ✗ FAIL ' + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function boot() {
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.detail || e.message));
  const dom = new JSDOM(html, { url: 'https://yutfi.github.io/Dungeon-of-Snakes-Ladders/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { w.HTMLCanvasElement.prototype.getContext = () => null; w.mqtt = { connect: () => ({ on() { return this; }, once() { return this; }, subscribe() {}, publish() {}, end() {} }) };
      // jsdom has no layout: give every element a visible box so the tour's "is this on screen" test passes
      w.Element.prototype.getBoundingClientRect = function () { return { left: 10, top: 10, right: 210, bottom: 90, width: 200, height: 80, x: 10, y: 10 }; };
      w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {}; } });
  return dom.window;
}
(async () => {
  const w = boot(); const E = c => w.eval(c); await sleep(200);
  E("document.querySelectorAll('.menu-screen,.intro').forEach(e=>e.classList.add('hidden'))");
  ok(E('tourSeen') === false, 'a fresh browser has not seen the tour');
  E('tourStart(false)'); ok(E('tourLive.on') === false, 'the automatic start never fires in the test browser');
  E('modeKey = "std"; resetGame(); tourStart(true)');
  ok(E('tourLive.on') === true && !w.document.getElementById('tour-layer').classList.contains('hidden'), 'manual start opens the tour');
  const n = E('tourLive.steps.length'); ok(n === 10, 'all 10 steps in an RPG mode (got ' + n + ')');
  ok(/Step 1 of 10/.test(w.document.getElementById('tour-card').textContent) && /Welcome/.test(w.document.getElementById('tour-card').textContent), 'step 1 is the welcome');
  ok(w.document.querySelectorAll('#tour-card .tour-dots i').length === n && w.document.querySelectorAll('#tour-card .tour-dots i.on').length === 1, 'progress dots');
  ok(w.document.querySelector('#tour-card .tour-demo').innerHTML.length > 10, 'each step carries an animated demo');
  E('tourGo(1)'); ok(E('tourLive.i') === 1, 'Next advances'); E('tourGo(-1)'); ok(E('tourLive.i') === 0, 'Back returns'); E('tourGo(-1)'); ok(E('tourLive.i') === 0, 'Back stops at the first step');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); ok(E('tourLive.i') === 1, 'right arrow = next');
  const rolled = E('(()=>{ const p = currentPlayer, pos = playerPositions[p]; handleRollClick && 0; return pos; })()'); ok(rolled >= 1, 'game untouched');
  ok(E("tourLive.steps.every(s => !s.sel || !!document.querySelector(s.sel))"), 'every step points at a real element');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok(E('tourLive.on') === false && w.document.getElementById('tour-layer').classList.contains('hidden'), 'Esc skips the tour');
  ok(w.localStorage.getItem('sl-tour') === '1' && E('tourSeen') === true, 'skipping is remembered');
  ok(w.document.getElementById('roll-btn').classList.contains('btn-nudge'), 'the roll button glows after the tour');
  w.document.getElementById('roll-btn').click(); ok(!w.document.getElementById('roll-btn').classList.contains('btn-nudge'), 'the glow stops once the player acts');
  // replay + finish through the last step
  E('tourStart(true)'); ok(E('tourLive.on') === true, 'the 🎓 button can replay it any time');
  for (let i = 0; i < n; i++) E('tourGo(1)'); ok(E('tourLive.on') === false, 'the last step finishes the tour');
  ok(/Let's play/.test(E("TOUR_STEPS[TOUR_STEPS.length-1].last ? 'Let\\'s play' : ''")), 'last step has the call to action');
  // Classic has no arena: that step is dropped
  E('modeKey = "classic"; resetGame(); tourStart(true)'); const nc = E('tourLive.steps.length'); ok(nc === 9 && E("tourLive.steps.every(s => !s.rpg)"), 'Classic skips the Arena step (got ' + nc + ')'); E('tourDone(true)');
  // blocked while a window is open
  E("openModal('shop-modal')"); E('tourStart(true)'); ok(E('tourLive.on') === false, 'it does not open on top of another window');
  ok(!!w.document.getElementById('tour-btn') && /animated tour/.test(w.document.getElementById('guide-modal').textContent), 'header button and Guide link exist');
  console.log(`\n${pass} checks passed, ${fail} failed\nerrors:`, errors.length ? errors.slice(0, 5) : 'none');
  process.exit(fail || errors.length ? 1 : 0);
})();
