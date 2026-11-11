
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/<script src=[^>]*><\/script>/g,'');
const errors = [];
process.on('unhandledRejection', e => errors.push('unhandled: ' + (e && e.stack || e)));
const real = global.setTimeout;
const sleep = ms => new Promise(r => real(r, ms));

// ---- fake MQTT broker (retained msgs, wildcard '+', last-will on unclean end, first broker URL can be made to fail) ----
const retained = new Map(); const clientsLive = new Set(); const FAIL_URLS = new Set(['wss://broker.emqx.io:8084/mqtt']);
function matches(filter, topic) { if (filter.endsWith('/+')) { const b = filter.slice(0, -1); return topic.startsWith(b) && !topic.slice(b.length).includes('/'); } return filter === topic; }
function deliver(topic, payload, retain, except) {
  if (retain) { if (payload === '' ) retained.delete(topic); else retained.set(topic, payload); }
  clientsLive.forEach(c => { if (c !== except || true) c.subs.forEach(f => { if (matches(f, topic)) real(() => { if (c.live) c.emit('message', topic, Buffer.from(payload)); }, 1); }); });
}
class FakeClient {
  constructor(url, opts) { this.h = {}; this.subs = new Set(); this.live = false; this.will = opts.will; this.url = url;
    real(() => { if (FAIL_URLS.has(url)) { this.emit('error', new Error('ws failed')); return; } this.live = true; clientsLive.add(this); this.emit('connect'); }, 4); }
  on(ev, f) { (this.h[ev] = this.h[ev] || []).push(f); return this; }
  once(ev, f) { const w = (...a) => { this.h[ev] = this.h[ev].filter(x => x !== w); f(...a); }; return this.on(ev, w); }
  emit(ev, ...a) { (this.h[ev] || []).slice().forEach(f => { try { f(...a); } catch (e) { errors.push('mqtt handler: ' + e.stack); } }); }
  subscribe(f) { this.subs.add(f); retained.forEach((p, t) => { if (matches(f, t)) real(() => { if (this.live) this.emit('message', t, Buffer.from(p)); }, 1); }); }
  publish(t, p, o) { if (!this.live) return; deliver(t, String(p), !!(o && o.retain), this); }
  end(force) { if (!this.live) return; this.live = false; clientsLive.delete(this); if (force && this.will) deliver(this.will.topic, '', true); this.emit('close'); }
}
const fakeMqtt = { connect: (url, opts) => new FakeClient(url, opts) };
function boot(tok) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail || e.message)));
  const dom = new JSDOM(html, { url: 'https://yutfi.github.io/Dungeon-of-Snakes-Ladders/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => null;   // the effects canvas is not needed (and not implemented) in jsdom
      const st = w.setTimeout.bind(w);
      w.setTimeout = (fn, ms, ...a) => st(fn, ((ms || 0) >= 5000 ? ms : Math.min(ms || 0, 2)), ...a);
      if (tok) w.sessionStorage.setItem('sl-tok', tok);
      w.mqtt = fakeMqtt;
      w.HTMLCanvasElement.prototype.getContext = () => null;   // jsdom has no canvas; the game falls back to no particles
      w.addEventListener('error', e => errors.push('window.onerror: ' + e.message));
    } });
  if (process.env.TRACE) dom.window.eval(`window.TRACE=[]; (function(){const _a=addLogEntry; addLogEntry=function(p,t){ try{TRACE.push([NET.applied,p,String(t).replace(/<[^>]+>/g,''),JSON.stringify(playerPositions),JSON.stringify(playerShields),isRolling,!!jack,fastMode]);}catch(e){} return _a.apply(this,arguments); };})();`);
  return { w: dom.window, d: dom.window.document };
}
const ev = (c, s) => c.w.eval(s);
const state = c => JSON.stringify(ev(c, '({p:playerPositions,c:playerCash,s:playerShields,b:playerBribes,cp:playerCheckpoints,f:playerPoisoned,cur:currentPlayer,over:gameOver,snk:SNAKES,mines:placedMines,own:customSnakeOwner,sp:shopPurchasedThisTurn,x:extraRollPending,rule:RULES.bounce,st:playerStats,fn:playerFrozenNext,br:playerBonusRolls,dg:playerDelayedGold,fb:playerFreeBuy,rc:playerRollCap,mb:playerMarketBan,ev:playerEvents,rpg:{mode:RPG.mode,round:RPG.round,rng:RPG.s,p:RPG.p,tiles:RPG.tiles,boss:RPG.boss,mods:RPG.mods,allies:RPG.allies,wanted:RPG.wanted,cool:RPG.cool,danger:RPG.danger,ev:RPG.ev,used:RPG.actionUsed}})'));
async function drive(clients, maxSteps, stopWhen) {
  for (let i = 0; i < maxSteps; i++) {
    await sleep(6);
    if (stopWhen && stopWhen()) return true;
    for (const c of clients) {
      const w = c.w, d = c.d;
      const tm = d.getElementById('target-modal');
      // cinematic questions (altar, alliance offers) are answered by the client the question is for
      const sb = [...d.querySelectorAll('#stage .st-choices button')];
      if (sb.length) { sb[Math.floor(Math.random() * sb.length)].click(); continue; }
      const lm = d.getElementById('loaded-modal');
      if (!lm.classList.contains('hidden')) { const b = [...d.querySelectorAll('#loaded-pick button')]; b[Math.floor(Math.random() * b.length)].click(); continue; }
      if (!tm.classList.contains('hidden')) { const b = [...d.querySelectorAll('#target-list button')].filter(x => !x.disabled); if (b.length && Math.random() < 0.9) b[Math.floor(Math.random() * b.length)].click(); else w.eval("closeModal('target-modal')"); continue; }
      // Jack of Trader: pick a card (or walk away), and press Continue when the card has flipped
      const jm = d.getElementById('jack-modal');
      if (!jm.classList.contains('hidden')) {
        if (!d.getElementById('jack-continue').classList.contains('hidden')) { w.jackContinue(); continue; }
        const cards = [...d.querySelectorAll('#jack-cards .jack-card')].filter(x => !x.disabled);
        if (cards.length && ev(c, 'canAct()') && !ev(c, 'jack')) { if (Math.random() < 0.8) cards[Math.floor(Math.random() * cards.length)].click(); else w.jackCancel(); }
        continue;
      }
      const pm = d.getElementById('powerup-modal');
      if (!pm.classList.contains('hidden') && ev(c, 'canAct()')) { w.selectPowerUp(['swap', 'freeze', 'shield', 'cash'][Math.floor(Math.random() * 4)]); continue; }
      if (ev(c, 'canAct()') && !ev(c, 'isRolling') && !ev(c, 'splashActive()') && pm.classList.contains('hidden')) {
        if (Math.random() < 0.5 && !ev(c, 'shopPurchasedThisTurn')) { const keys = Object.keys(ev(c, 'SHOP_ITEMS')); w.uiBuy(keys[Math.floor(Math.random() * keys.length)]); if (!tm.classList.contains('hidden')) continue; }
        if (ev(c, 'rpgOn()') && !ev(c, 'RPG.actionUsed') && Math.random() < 0.22) {
          w.openArena(); const ab = [...d.querySelectorAll('#arena-list button')].filter(x => !x.disabled);
          if (ab.length) { ab[Math.floor(Math.random() * ab.length)].click(); continue; }
        }
        w.eval("['win-modal','shop-modal','arena-modal'].forEach(id=>{const m=document.getElementById(id); m.classList.add('hidden'); m.dataset.state='closed';})");
        if (Math.random() < 0.35) w.selectDie(ev(c, 'DICE_KEYS')[Math.floor(Math.random() * 4)]);   // sometimes roll a special die
        w.handleRollClick();
      }
    }
  }
  return false;
}
async function settled(clients) { for (let i = 0; i < 600; i++) { await sleep(10); if (clients.every(c => !ev(c, 'isRolling') && !ev(c, 'NET.puWait') && !ev(c, 'NET.decWait') && ev(c, 'NET.applied') === ev(c, 'NET.G.log.length') && !ev(c, 'splashDepth') && !ev(c, 'jack') && c.d.getElementById('jack-modal').classList.contains('hidden') && c.d.getElementById('target-modal').classList.contains('hidden'))) return true; } return false; }
const same = (cs) => { const s = cs.map(state); return s.every(x => x === s[0]); };

// ---------------- move clock tests ----------------
let fails = 0;
const ok = (name, cond, extra) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || extra === undefined ? '' : '  -> ' + JSON.stringify(extra))); };
const grow = async (c, from) => { for (let i = 0; i < 200; i++) { await sleep(10); if (ev(c, 'NET.G.log.length') > from) return true; } return false; };

async function room(n, tmr) {
  const clients = Array.from({ length: n }, () => boot()); await sleep(80);
  const [H, ...G] = clients;
  H.d.getElementById('net-nick').value = 'Host'; ev(H, "NET.cls='wizard'");
  await H.w.netCreate(); const code = ev(H, 'NET.code');
  if (tmr !== undefined) H.w.netSetTimer(tmr);
  for (const c of G) { c.d.getElementById('net-nick').value = 'Guest'; ev(c, "NET.cls='demon'"); c.d.getElementById('net-code').value = code; await c.w.netJoin(); await sleep(30); }
  await sleep(120);
  return { clients, H, G, code };
}
async function start(clients, H) {
  H.w.netStartMatch();
  for (let i = 0; i < 200 && !clients.every(c => ev(c, 'NET.G && NET.G.gen') >= 1); i++) await sleep(10);
  await settled(clients);
}
const actor = clients => clients.find(c => ev(c, 'currentPlayer') === ev(c, 'NET.seat'));

(async () => {
  // 1. host picks the clock in the lobby; guests see it; it travels in the room record
  {
    const { clients, H, G } = await room(2, 30);
    ok('default clock is 60s for a fresh room', ev(boot(), 'TMR_DEFAULT') === 60);
    ok('host sees 30s selected', H.d.getElementById('net-tmr-30').classList.contains('on') && !H.d.getElementById('net-tmr-60').classList.contains('on'));
    ok('guest sees the host\'s choice (30s)', G[0].d.getElementById('net-tmr-30').classList.contains('on'));
    ok('guest cannot change it (buttons disabled)', G[0].d.getElementById('net-tmr-30').disabled === true);
    G[0].w.netSetTimer(120);
    await sleep(80);
    ok('guest call to netSetTimer is ignored', ev(H, 'NET.G.tmr') === 30);
    H.w.netSetTimer(7);
    ok('junk value falls back to no clock', ev(H, 'NET.G.tmr') === 0);
    H.w.netSetTimer(90); await sleep(80);
    ok('host change reaches the guest lobby', G[0].d.getElementById('net-tmr-90').classList.contains('on'));
    await start(clients, H);
    ok('both clients carry tmr=90 in the match record', clients.every(c => ev(c, 'NET.G.tmr') === 90), clients.map(c => ev(c, 'NET.G.tmr')));
    await sleep(700);                                              // the real 250ms interval draws the widget
    ok('clock widget is visible on both', clients.every(c => !c.d.getElementById('turn-clock').classList.contains('hidden')));
    const a = actor(clients), o = clients.find(c => c !== a);
    const sa = ev(a, 'tmrState()'), so = ev(o, 'tmrState()');
    ok('state is "roll" for the player whose turn it is, on both clients', sa && so && sa.phase === 'roll' && so.phase === 'roll' && sa.who === so.who, [sa, so]);
    ok('only the player on turn sees their "Your move" label', /Your move/.test(a.d.getElementById('tc-label').textContent) && /thinking/.test(o.d.getElementById('tc-label').textContent), [a.d.getElementById('tc-label').textContent, o.d.getElementById('tc-label').textContent]);
    // extension: two per move, then no more
    ev(a, 'tmrTick()'); const l0 = ev(a, 'TC.left');
    ev(a, 'tmrExtend()'); ev(a, 'tmrExtend()'); ev(a, 'tmrExtend()');
    ok('two +30s extensions allowed, third refused', ev(a, 'TC.ext') === 2 && ev(a, 'TC.left') >= l0 + 59000 - 1000, [ev(a, 'TC.ext'), l0, ev(a, 'TC.left')]);
    ev(o, 'tmrTick()'); const lo = ev(o, 'TC.left'); ev(o, 'tmrExtend()');
    ok('the waiting player cannot extend someone else\'s clock', ev(o, 'TC.ext') === 0 && ev(o, 'TC.left') === lo);
    // pause while animating
    ev(a, 'isRolling=true'); ok('no countdown while the dice animation runs', ev(a, 'tmrState()') === null); ev(a, 'isRolling=false');
    // expiry: a default move is played through the normal log and everyone stays in sync
    ev(a, 'tmrTick()'); const before = ev(a, 'NET.G.log.length');
    ev(a, 'TC.left=1; TC.last=performance.now()-300; tmrTick()');
    ok('expiry pushes a move to the shared log', await grow(a, before));
    await settled(clients);
    ok('after expiry both clients have the same log and state', clients.every(c => ev(c, 'NET.G.log') === ev(a, 'NET.G.log')) && same(clients));
    ok('the turn passed on (or the mover got a normal follow-up), no stuck wait', clients.every(c => !ev(c, 'isRolling') && !ev(c, 'NET.decWait')));
    // the opponent never plays for someone else
    const o2 = clients.find(c => ev(c, 'currentPlayer') !== ev(c, 'NET.seat')); if (o2) {
      const b2 = ev(o2, 'NET.G.log.length'); ev(o2, 'tmrTick()'); ev(o2, 'TC.left=1; TC.last=performance.now()-300; tmrTick()'); await sleep(150);
      ok('the waiting client never enforces the other player\'s clock', ev(o2, 'NET.G.log.length') === b2);
    }
    // power-up default: shield when none held, else cash; never targets anyone
    for (const c of clients) await c.w.netLeave();
  }
  // 2. no clock when the host turns it off
  {
    const { clients, H } = await room(2, 0); await start(clients, H);
    ok('Off: tmr is 0 on both clients', clients.every(c => ev(c, 'NET.G.tmr') === 0));
    ok('Off: widget hidden and no state', clients.every(c => c.d.getElementById('turn-clock').classList.contains('hidden') && ev(c, 'tmrState()') === null));
    const a = actor(clients), n0 = ev(a, 'NET.G.log.length'); ev(a, 'TC.left=0; tmrTick()'); await sleep(100);
    ok('Off: nothing is auto-played', ev(a, 'NET.G.log.length') === n0);
    for (const c of clients) await c.w.netLeave();
  }
  // 3. an old room record without the field plays without a clock
  {
    const { clients, H } = await room(2, 60); await start(clients, H);
    ev(clients[1], 'delete NET.G.tmr');
    ok('record without tmr -> no clock', ev(clients[1], 'tmrSecs()') === 0 && ev(clients[1], 'tmrState()') === null);
    ev(clients[1], 'tmrTick()'); ok('widget hides itself for an old record', clients[1].d.getElementById('turn-clock').classList.contains('hidden'));
    ev(clients[1], 'NET.G.tmr=45'); ok('unknown value is treated as no clock', ev(clients[1], 'tmrSecs()') === 0);
    for (const c of clients) await c.w.netLeave();
  }
  // 4. solo / local play never shows or runs the clock
  {
    const S = boot(); await sleep(60);
    ok('solo: no clock state', ev(S, 'tmrState()') === null && ev(S, 'tmrSecs()') === 0);
  }
  // 5. the clock must not use randomness (it would desync the shared dice)
  {
    const src = html, a = src.indexOf('const TMR_CHOICES'), b = src.indexOf('/* ---- Online transport');
    ok('timer module found', a > 0 && b > a);
    ok('timer module never calls Math.random', !/Math\.random/.test(src.slice(a, b)));
  }
  console.log('\nERRORS:', errors.length ? errors.slice(0, 8) : 'none');
  console.log(fails || errors.length ? `\n${fails} FAILED` : '\nALL TIMER TESTS PASSED');
  process.exit(fails || errors.length ? 1 : 0);
})();
