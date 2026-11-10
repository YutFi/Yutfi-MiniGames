// Main-menu flows and online chat ("Table Talk"), run in jsdom against a fake MQTT broker.
//   cd tests && npm install && npm run test:menu
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script src=[^>]*><\/script>/g, '');
const BASE = 'https://yutfi.github.io/Dungeon-of-Snakes-Ladders/';
const errors = [];
process.on('unhandledRejection', e => errors.push('unhandled: ' + (e && e.stack || e)));
const real = global.setTimeout;
const sleep = ms => new Promise(r => real(r, ms));

// ---- fake MQTT broker: retained messages, '+' wildcard, last-will on unclean end ----
const retained = new Map(); const clientsLive = new Set();
function matches(filter, topic) { if (filter.endsWith('/+')) { const b = filter.slice(0, -1); return topic.startsWith(b) && !topic.slice(b.length).includes('/'); } return filter === topic; }
function deliver(topic, payload, retain) {
  if (retain) { if (payload === '') retained.delete(topic); else retained.set(topic, payload); }
  clientsLive.forEach(c => c.subs.forEach(f => { if (matches(f, topic)) real(() => { if (c.live) c.emit('message', topic, Buffer.from(payload)); }, 1); }));
}
class FakeClient {
  constructor(url, opts) { this.h = {}; this.subs = new Set(); this.live = false; this.will = opts.will;
    real(() => { this.live = true; clientsLive.add(this); this.emit('connect'); }, 4); }
  on(ev, f) { (this.h[ev] = this.h[ev] || []).push(f); return this; }
  once(ev, f) { const w = (...a) => { this.h[ev] = this.h[ev].filter(x => x !== w); f(...a); }; return this.on(ev, w); }
  emit(ev, ...a) { (this.h[ev] || []).slice().forEach(f => { try { f(...a); } catch (e) { errors.push('mqtt handler: ' + e.stack); } }); }
  subscribe(f) { this.subs.add(f); retained.forEach((p, t) => { if (matches(f, t)) real(() => { if (this.live) this.emit('message', t, Buffer.from(p)); }, 1); }); }
  publish(t, p, o) { if (!this.live) return; deliver(t, String(p), !!(o && o.retain)); }
  end(force) { if (!this.live) return; this.live = false; clientsLive.delete(this); if (force && this.will) deliver(this.will.topic, '', true); this.emit('close'); }
}
const fakeMqtt = { connect: (url, opts) => new FakeClient(url, opts) };

function boot(opts = {}) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail || e.message)));
  const dom = new JSDOM(html, { url: opts.url || BASE, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      const st = w.setTimeout.bind(w);
      w.setTimeout = (fn, ms, ...a) => st(fn, ((ms || 0) >= 5000 ? ms : Math.min(ms || 0, 2)), ...a);
      if (opts.tok) w.sessionStorage.setItem('sl-tok', opts.tok);
      w.mqtt = fakeMqtt;
      w.addEventListener('error', e => errors.push('window.onerror: ' + e.message));
    } });
  const c = { w: dom.window, d: dom.window.document };
  // every test client taps through the welcome splash unless it is the one testing it
  if (!opts.keepIntro) c.w.introStart();
  return c;
}
const ev = (c, s) => c.w.eval(s);
const vis = (c, id) => !c.d.getElementById(id).classList.contains('hidden');
const click = (c, sel) => c.d.querySelector(sel).click();

let failed = 0, passed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  ok   ' + name); } else { failed++; console.log('  FAIL ' + name); } }
async function until(fn, ms = 3000) { for (let t = 0; t < ms / 10; t++) { if (fn()) return true; await sleep(10); } return false; }

(async () => {
  /* ---------------- main menu: solo ---------------- */
  console.log('\nWelcome splash + music');
  const I = boot({ keepIntro: true }); await sleep(60);
  let toneStarts = 0;
  I.w.Tone = { start() { toneStarts++; return Promise.resolve(); } };   // stand-in: only checks the gesture hand-off
  const introEl = () => I.d.getElementById('intro');
  check('splash is up on load and welcomes Yutfi MiniGames', !!introEl() && introEl().textContent.replace(/\s+/g, ' ').includes('Welcome to') && introEl().querySelector('h1').textContent.replace(/\s+/g, ' ').trim() === 'Yutfi MiniGames');
  check('page title is Yutfi MiniGames', I.d.title === 'Yutfi MiniGames');
  check('no sound is started before the tap', toneStarts === 0);
  I.w.dispatchEvent(new I.w.KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
  check('a key press starts the show: audio is unlocked from that gesture, exactly once', toneStarts === 1);
  check('...and the key did not roll the dice or reach the menu behind', ev(I, 'isRolling') === false && vis(I, 'menu-modes'));
  I.w.introStart(); I.w.introStart();
  check('repeat taps do not restart audio', toneStarts === 1);
  check('splash fades out and is removed', await until(() => !introEl(), 1500));
  check('game-mode screen is revealed under it', vis(I, 'main-menu') && vis(I, 'menu-modes'));
  check('Music toggle is on by default and labelled', I.d.getElementById('menu-music-text').textContent === 'Music On');
  I.w.toggleMusic();
  check('Music Off: label flips, preference saved, nothing throws without a player', I.d.getElementById('menu-music-text').textContent === 'Music Off' && I.w.localStorage.getItem('sl-music') === 'off');
  I.w.toggleMusic();
  check('Music On again restarts from a tap (audio re-unlocked)', I.d.getElementById('menu-music-text').textContent === 'Music On' && toneStarts === 2);
  I.w.toggleSound(); I.w.toggleSound();
  check('master Audio switch still toggles cleanly', I.d.getElementById('menu-sound-text').textContent === 'Audio On');
  const I2 = boot({ keepIntro: true }); I2.w.localStorage.setItem('sl-music', 'off'); I2.w.eval("musicEnabled=false;syncMusicButton()");
  check('Music Off shows on the button when preference is off', I2.d.getElementById('menu-music-text').textContent === 'Music Off');

  console.log('\nMain menu — solo');
  const A = boot(); await sleep(60);
  check('launch shows the game-mode screen first', vis(A, 'main-menu') && vis(A, 'menu-modes') && !vis(A, 'menu-home') && !vis(A, 'menu-solo-pane'));
  check('champion screen is no longer forced open on load', !vis(A, 'class-modal'));
  check('Resume is hidden before any match is started', !vis(A, 'menu-resume'));
  check('menu counts as open for the game (Space cannot roll behind it)', ev(A, 'anyModalOpen()'));
  const party = A.d.getElementById('menu-mode-party');
  check('Party Game card is a real link to party.html (no Coming-soon placeholder)', party.tagName === 'A' && party.getAttribute('href') === 'party.html' && !party.textContent.includes('Coming soon') && !party.hasAttribute('aria-disabled'));
  click(A, '#menu-mode-snake');
  check('Snake Game opens its menu with Solo / Online / How to Play', vis(A, 'menu-home') && !vis(A, 'menu-modes') && vis(A, 'menu-solo') && vis(A, 'menu-online'));
  A.w.dispatchEvent(new A.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Esc on the Snake Game menu goes back to the mode screen', vis(A, 'menu-modes') && !vis(A, 'menu-home'));
  click(A, '#menu-mode-snake');
  click(A, '#menu-solo');
  check('Play Solo opens the solo pane', vis(A, 'menu-solo-pane') && !vis(A, 'menu-home'));
  A.w.dispatchEvent(new A.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Esc on the solo pane goes back to the home pane', vis(A, 'menu-home') && !vis(A, 'menu-solo-pane'));
  click(A, '#menu-solo');
  click(A, '#menu-solo-pane .menu-btn:nth-of-type(1)');
  await sleep(40);
  check('vs AI Bot hides the menu and opens champion select', !vis(A, 'main-menu') && vis(A, 'class-modal') && ev(A, 'pendingMode') === 'PvC');
  click(A, '#class-close-btn'); await sleep(40);
  check('closing champion select returns to the solo pane', vis(A, 'main-menu') && vis(A, 'menu-solo-pane') && !vis(A, 'class-modal'));
  click(A, '#menu-solo-pane .menu-btn:nth-of-type(1)'); await sleep(40);
  click(A, '#class-list-1 .class-card:nth-child(2)');       // Wizard
  click(A, '#class-modal .btn-primary'); await sleep(60);
  check('Enter the Dungeon starts the match: menu closed, wizard picked', !vis(A, 'main-menu') && ev(A, "playerClasses[1]") === 'wizard' && ev(A, 'matchActive') === true);
  check('header chip shows the mode; no chat button in solo', A.d.getElementById('mode-chip').textContent.includes('vs AI Bot') && !vis(A, 'chat-fab') && !vis(A, 'chat-panel'));
  check('Champions button is available in solo', vis(A, 'classes-btn'));
  A.w.handleRollClick();
  let picked = false;      // a roll of 6 (1 in 6) first waits for the player to pick a bonus
  const moved = await until(() => {
    if (!picked && vis(A, 'powerup-modal')) { picked = true; A.w.selectPowerUp('cash'); }
    return ev(A, 'playerPositions[1]') > 1;
  }, 5000);
  check('the first roll works after starting from the menu', moved);
  await until(() => !ev(A, 'isRolling') && ev(A, 'currentPlayer') === 1 || ev(A, 'gameOver'), 8000);
  click(A, '#menu-btn'); await sleep(30);
  check('header Menu button opens the Snake Game menu (not the mode picker) and offers Resume', vis(A, 'main-menu') && vis(A, 'menu-home') && !vis(A, 'menu-modes') && vis(A, 'menu-resume'));
  click(A, '#menu-resume'); await sleep(30);
  check('Resume closes the menu and keeps the board', !vis(A, 'main-menu') && ev(A, 'playerPositions[1]') > 1);
  click(A, '#menu-btn'); await sleep(30);
  click(A, '#menu-solo'); await until(() => !ev(A, 'isRolling'), 8000);
  click(A, '#menu-solo-pane .menu-btn:nth-of-type(2)'); await sleep(40);
  check('2 Players same screen opens champion select in PvP', vis(A, 'class-modal') && ev(A, 'pendingMode') === 'PvP');
  click(A, '#class-modal .btn-primary'); await sleep(60);
  check('2-player match starts and the chip says so', ev(A, 'gameMode') === 'PvP' && A.d.getElementById('mode-chip').textContent.includes('2 Players'));

  /* ---------------- main menu: online ---------------- */
  console.log('\nMain menu — online');
  const B = boot(); await sleep(60);
  click(B, '#menu-mode-snake');
  click(B, '#menu-online'); await sleep(40);
  check('Play Online opens the online dialog on the Create tab', vis(B, 'online-modal') && !vis(B, 'main-menu') && vis(B, 'net-pane-create') && !vis(B, 'net-pane-join'));
  click(B, '#net-tab-join');
  check('Join tab shows the code field', vis(B, 'net-pane-join') && !vis(B, 'net-pane-create') && B.d.getElementById('net-tab-join').classList.contains('on'));
  const codeEl = B.d.getElementById('net-code');
  codeEl.value = 'ab-c1!'; codeEl.dispatchEvent(new B.w.Event('input', { bubbles: true }));
  check('room code input is forced to upper-case letters/digits', codeEl.value === 'ABC1');
  click(B, '#online-modal .btn-ghost'); await sleep(40);
  check('Back from the online dialog returns to the menu', vis(B, 'main-menu') && vis(B, 'menu-home') && !vis(B, 'online-modal'));
  click(B, '#menu-online'); await sleep(40);
  click(B, '#net-pane-create .btn-primary');
  check('creating a room with no name works and defaults the name to Hero', await until(() => vis(B, 'online-wait')) && ev(B, 'NET.nick') === 'Hero');
  check('the name is remembered for next time', ev(B, "localStorage.getItem('sl-nick')") === 'Hero');
  check('host cannot start alone (button disabled)', B.d.getElementById('net-start-btn').disabled === true);
  click(B, '#online-modal .btn-ghost'); await sleep(60);
  check('Back inside the waiting room leaves the room and returns to the form', ev(B, 'NET.on') === false && vis(B, 'online-setup'));

  console.log('\nInvite link');
  const C = boot({ url: BASE + '#room-QWER' }); await sleep(80);
  check('invite link skips the menu and lands on Join with the code filled in',
    !vis(C, 'main-menu') && vis(C, 'online-modal') && vis(C, 'net-pane-join') && C.d.getElementById('net-code').value === 'QWER');

  /* ---------------- chat ---------------- */
  console.log('\nTable talk (3-player room)');
  const clients = [boot(), boot(), boot()]; await sleep(80);
  const [H, G1, G2] = clients;
  H.d.getElementById('net-nick').value = 'Host';
  await H.w.netCreate(); const code = ev(H, 'NET.code');
  for (const [i, c] of [G1, G2].entries()) {
    c.d.getElementById('net-nick').value = 'Guest' + (i + 1); c.d.getElementById('net-code').value = code;
    await c.w.netJoin(); await sleep(30);
  }
  await sleep(100);
  check('no chat button in the waiting room', clients.every(c => !vis(c, 'chat-fab') && !vis(c, 'chat-panel')));
  H.w.netStartMatch();
  check('match starts for everyone', await until(() => clients.every(c => ev(c, 'NET.G && NET.G.gen') >= 1)));
  await sleep(150);
  check('a Chat button appears for every player once the match starts, drawer closed', clients.every(c => vis(c, 'chat-fab') && !vis(c, 'chat-panel')));
  check('quick-chat and emoji buttons are built', H.d.querySelectorAll('#chat-chips .chat-chip').length === 10 && H.d.querySelectorAll('#emoji-row .emoji-btn').length === 10);
  clients.forEach(c => {
    c.w.__fx = [];
    new c.w.MutationObserver(m => m.forEach(r => r.addedNodes.forEach(n => c.w.__fx.push(n.className)))).observe(c.d.getElementById('fx-layer'), { childList: true });
  });
  const lines = c => [...c.d.querySelectorAll('#chat-log .chat-line')].map(l => l.textContent);
  const phrase = ev(H, 'CHAT_PHRASES[2]');

  H.d.getElementById('chat-fab').click();
  check('clicking the Chat button opens the drawer', vis(H, 'chat-panel') && H.d.getElementById('chat-fab').getAttribute('aria-expanded') === 'true');
  check('sending quick chat succeeds', ev(H, "chatSend('q', 2)") === true);
  await sleep(120);
  const badge = c => vis(c, 'chat-badge') ? c.d.getElementById('chat-badge').textContent : '';
  check('players with the drawer closed get an unread badge; the sender does not', badge(G1) === '1' && badge(G2) === '1' && badge(H) === '');
  check('everyone else receives the phrase from the right player', [G1, G2].every(c => lines(c).some(t => t.includes('Host') && t.includes(phrase))));
  check('sender sees it exactly once (own echo is ignored)', lines(H).filter(t => t.includes(phrase)).length === 1);
  check('a speech bubble is drawn over the sender\'s token on every board, even with the drawer closed', clients.every(c => c.w.__fx.includes('chat-bubble')));
  G1.d.getElementById('chat-fab').click(); G2.d.getElementById('chat-fab').click();
  check('opening the drawer clears the unread badge', badge(G1) === '' && badge(G2) === '' && vis(G1, 'chat-panel'));
  G1.w.dispatchEvent(new G1.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Esc closes the drawer', !vis(G1, 'chat-panel'));
  G1.d.getElementById('chat-fab').click();

  check('sending again immediately is rate-limited', ev(H, "chatSend('q', 3)") === false);
  await sleep(760);

  check('emoji taunt succeeds', ev(G1, "chatSend('e', 1)") === true);
  await sleep(120);
  check('emoji pops up on the other boards and lands in their logs', [H, G2].every(c => c.w.__fx.includes('emoji-pop') && lines(c).some(t => t.includes('Guest1') && t.includes('😈'))));
  await sleep(760);

  H.d.getElementById('chat-input').value = '<img src=x onerror=alert(1)> gg  ez';
  H.w.chatSubmit();
  await sleep(120);
  check('typed message arrives as plain text (no HTML is ever created)', clients.every(c => c.d.querySelectorAll('#chat-log img').length === 0) && lines(G2).some(t => t.includes('<img src=x onerror=alert(1)> gg ez')));
  check('input box is cleared after sending', H.d.getElementById('chat-input').value === '');
  check('control / bidi characters are stripped and whitespace collapsed', ev(H, "chatClean('a\\u0000b\\u202ec    d')") === 'a b c d');
  check('typed messages are capped at 80 characters', ev(H, "chatClean('x'.repeat(500)).length") === 80);
  await sleep(760);

  // forged / malformed messages straight onto the wire
  const before = lines(G1).length;
  H.w.eval("NET.ch.chat({ t: NET.tok, k: 'q', i: 99 })");        await sleep(450);
  H.w.eval("NET.ch.chat({ t: NET.tok, k: 'x', i: 0 })");         await sleep(450);
  H.w.eval("NET.ch.chat({ t: 'zzzzzzzzzz', k: 'q', i: 0 })");    await sleep(450);   // not seated in this match
  H.w.eval("NET.ch.chat({ t: 'bad token!', k: 'm', s: 'hi' })"); await sleep(450);
  H.w.eval("NET.ch.chat({ t: NET.tok, k: 'e', i: -1 })");        await sleep(450);
  check('out-of-range index, unknown kind, unseated sender and bad token are all ignored', lines(G1).length === before);

  // mute
  G1.w.chatToggleMute();
  const g1Before = lines(G1).length, g2Before = lines(G2).length;
  ev(H, "chatSend('q', 0)"); await sleep(150);
  check('a muted player does not see new chat while others still do', lines(G1).length === g1Before);
  check('...and the unmuted player still receives it', lines(G2).length === g2Before + 1);
  check('mute button reflects the state', G1.d.getElementById('chat-mute-btn').textContent.includes('off'));
  G1.w.chatToggleMute();

  // keyboard
  let rolls = 0; H.w.handleRollClick = () => { rolls++; };
  const inp = H.d.getElementById('chat-input'); inp.focus();
  inp.dispatchEvent(new H.w.KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
  inp.dispatchEvent(new H.w.KeyboardEvent('keydown', { key: 's', code: 'KeyS', bubbles: true }));
  check('typing Space / S in the chat box does not roll or open the shop', rolls === 0 && !vis(H, 'shop-modal'));
  H.d.body.dispatchEvent(new H.w.KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
  check('Space on the board still rolls', rolls === 1);

  // not replayed to a rejoining player
  const tok = ev(G2, 'NET.tok'); await G2.w.netLeave(); await sleep(100);
  check('leaving the room hides the Chat button and clears the log', !vis(G2, 'chat-fab') && !vis(G2, 'chat-panel') && lines(G2).length === 0);
  const R = boot({ tok }); await sleep(100); R.d.getElementById('net-code').value = code; await R.w.netJoin();
  await until(() => ev(R, 'NET.G') && ev(R, 'NET.G.gen') >= 1 && vis(R, 'chat-fab'), 4000); await sleep(100);
  check('a player who rejoins does not get old chat replayed', lines(R).every(t => !t.includes(phrase)) && lines(R).length <= 1);
  ev(H, "chatLastSent = 0"); ev(H, "chatSend('q', 4)"); await sleep(150);
  check('...but receives new chat after rejoining', lines(R).some(t => t.includes(ev(H, 'CHAT_PHRASES[4]'))));

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  console.log('ERRORS:', errors.length ? errors.slice(0, 8) : 'none');
  process.exit(failed || errors.length ? 1 : 0);
})();
