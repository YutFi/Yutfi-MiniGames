// Smoothness helpers: DOM write diffing, Smooth-mode default and saved choice, static (non-CDN) Tailwind block.
const { JSDOM } = require('jsdom'); const fs = require('fs'), path = require('path');
const raw = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const html = raw.replace(/<script src=[^>]*><\/script>/g, '');
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c || x === undefined ? '' : ' -> ' + JSON.stringify(x))); };
function boot(ua, store, touch) {
  const dom = new JSDOM(html, { url: 'https://yutfi.github.io/Dungeon-of-Snakes-Ladders/', runScripts: 'dangerously', pretendToBeVisual: true, userAgent: ua, beforeParse(w) {
    w.HTMLCanvasElement.prototype.getContext = () => null; w.mqtt = { connect() { return { on() { return this; }, once() { return this; }, subscribe() {}, publish() {}, end() {} }; } };
    if (touch) { w.matchMedia = q => ({ matches: /coarse/.test(q), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }); Object.defineProperty(w.screen, 'width', { value: 390 }); Object.defineProperty(w.screen, 'height', { value: 844 }); }
    if (store) Object.entries(store).forEach(([k, v]) => w.localStorage.setItem(k, v)); } });
  return dom.window;
}
(async () => {
  ok('Tailwind Play CDN script is gone (no runtime JIT)', !/cdn\.tailwindcss\.com/.test(raw));
  ok('static Tailwind block is present', /<style id="tw-static">/.test(raw) && raw.includes('/*TW-START*/') && raw.includes('/*TW-END*/'));
  const phone = 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
  const desk = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
  let w = boot(phone, null, true); await new Promise(r => setTimeout(r, 100));
  ok('phone defaults to Smooth mode', w.eval('fxLow') === true && w.document.body.classList.contains('fx-low'));
  w = boot(phone, { 'sl-fx': 'high' }, true); await new Promise(r => setTimeout(r, 100));
  ok('a saved "high" choice beats the phone default', w.eval('fxLow') === false);
  w = boot(desk); await new Promise(r => setTimeout(r, 100));
  ok('desktop keeps full effects by default', w.eval('fxLow') === false);
  w = boot(desk, { 'sl-fx': 'low' }); await new Promise(r => setTimeout(r, 100));
  ok('a saved "low" choice is respected on desktop', w.eval('fxLow') === true);
  // setTxt / setHtml skip identical writes (no needless style/layout work)
  w = boot(desk); await new Promise(r => setTimeout(r, 100));
  const n = w.document.createElement('div'); w.document.body.appendChild(n);
  w.eval('window.__n = document.body.lastChild'); let muts = 0; new w.MutationObserver(m => muts += m.length).observe(n, { childList: true, characterData: true, subtree: true });
  w.eval("setTxt(__n,'a')"); await new Promise(r => setTimeout(r, 10)); const m1 = muts;
  w.eval("setTxt(__n,'a'); setTxt(__n,'a')"); await new Promise(r => setTimeout(r, 10));
  ok('setTxt with the same text writes nothing', m1 >= 1 && muts === m1, [m1, muts]);
  w.eval("setHtml(__n,'<b>x</b>')"); await new Promise(r => setTimeout(r, 10)); const m2 = muts;
  w.eval("setHtml(__n,'<b>x</b>')"); await new Promise(r => setTimeout(r, 10));
  ok('setHtml with the same markup writes nothing', muts === m2 && n.innerHTML === '<b>x</b>', [m2, muts]);
  w.eval("setTxt(__n,'b')"); ok('setTxt still updates when text changes', n.textContent === 'b');
  // token slide: final position set directly, a transform animation does the travel
  const t = w.document.createElement('div'); w.document.body.appendChild(t); w.eval('window.__t = document.body.lastChild');
  let anim = 0; t.animate = () => { anim++; return { cancel() {}, playState: 'running' }; };
  Object.defineProperty(t.parentElement, 'clientWidth', { value: 400 }); Object.defineProperty(t.parentElement, 'clientHeight', { value: 400 });
  w.document.body.classList.remove('no-waapi'); w.eval('fastMode=false; slideToken(__t,10,10,.2)'); w.eval('slideToken(__t,50,10,.2)');
  ok('slideToken animates a move (first placement is instant, the next one animates)', anim === 1, anim);
  w.eval('slideToken(__t,50,10,.2)'); ok('slideToken does nothing for a move to the same spot', anim === 1, anim);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PERF TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
