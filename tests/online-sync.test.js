
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

async function scenario(n, classes, mode) {
  console.log(`\n=== ${n}-player room${mode ? ' · mode ' + mode : ''} ===`);
  const clients = Array.from({ length: n }, () => boot()); await sleep(80);
  const [H, ...G] = clients;
  H.d.getElementById('net-nick').value = 'Host'; ev(H, `NET.cls='${classes[0]}'`);
  await H.w.netCreate(); const code = ev(H, 'NET.code');
  if (mode) ev(H, `NET.G.mode='${mode}'; netPublish()`);
  for (let i = 0; i < G.length; i++) { const c = G[i]; c.d.getElementById('net-nick').value = 'Guest'; ev(c, `NET.cls='${classes[i + 1]}'`); c.d.getElementById('net-code').value = code; await c.w.netJoin(); await sleep(30); }
  await sleep(120);
  console.log('roster on host:', ev(H, 'NET.G.seats.length'), '| guest sees lobby roster rows:', G[0].d.querySelectorAll('#online-roster .roster-row').length, '| host start btn visible:', !H.d.getElementById('net-start-btn').classList.contains('hidden'), '| guest start hidden:', G[0].d.getElementById('net-start-btn').classList.contains('hidden'));
  H.w.netStartMatch();
  for (let i = 0; i < 200 && !clients.every(c => ev(c, 'NET.G && NET.G.gen') >= 1); i++) await sleep(10);
  console.log('seats:', clients.map(c => ev(c, 'NET.seat')).join(','), '| NP', clients.map(c => ev(c, 'NP')).join(','), '| nicks', JSON.stringify(ev(G[0], 'NET.nicks')), '| cards', H.d.querySelectorAll('.player-card').length, 'tokens', H.d.querySelectorAll('.game-token').length);
  console.log('mode on every client:', clients.map(c => ev(c, 'RPG.mode')).join(','), '| seed shared:', new Set(clients.map(c => ev(c, 'NET.G.seed'))).size === 1);
  console.log('only current player can roll:', clients.map(c => !c.d.getElementById('roll-btn').disabled).join(','));
  const done = await drive(clients, 9000, () => clients.some(c => ev(c, 'gameOver')));
  await settled(clients);
  console.log('finished:', done, '| winner pos', JSON.stringify(ev(H, 'playerPositions')), '| log len', ev(H, 'NET.G.log.length'));
  console.log('ALL STATES MATCH:', same(clients), '| ALL LOGS MATCH:', clients.every(c => ev(c, 'NET.G.log') === ev(H, 'NET.G.log')));
  if (!same(clients)) clients.forEach((c, i) => console.log(' c' + i, state(c)));
  console.log('jack gambles in log:', (ev(H, 'NET.G.log').match(/x[0-2]y[a-t][0-9]/g) || []).length, '| dice units:', (ev(H, 'NET.G.log').match(/[slg][1-8]/g) || []).length);
  console.log('targets used in log:', (ev(H, 'NET.G.log').match(/[wfmSF][JKLMN]/g) || []).length, '| sample:', ev(H, 'NET.G.log').slice(0, 50));
  return { clients, code };
}


(async () => {
  await scenario(2, ['wizard','demon']);
  const { clients, code } = await scenario(5, ['human','wizard','demon','angel','wizard']);
  // rematch, then a guest reloads mid-game (host stays up)
  clients[1].w.playAgain(); await sleep(300);
  console.log('rematch gens', clients.map(c => ev(c, 'NET.G.gen')).join(','));
  await drive(clients, 600, () => ev(clients[0], 'NET.G.log.length') >= 50); await settled(clients);
  const tok = ev(clients[3], 'NET.tok'); await clients[3].w.netLeave(); await sleep(100);
  const R = boot(tok); await sleep(100); R.d.getElementById('net-code').value = code; await R.w.netJoin();
  for (let i = 0; i < 300 && !(ev(R, 'NET.G') && ev(R, 'NET.applied') === ev(R, 'NET.G.log.length') && ev(R, 'NET.applied') > 0); i++) await sleep(10);
  const cs = [clients[0], clients[1], clients[2], R, clients[4]]; await settled(cs);
  console.log('guest reload: seat', ev(R, 'NET.seat'), '| replayed', ev(R, 'NET.applied'), '| MATCH', same(cs));
  const done = await drive(cs, 9000, () => cs.some(c => ev(c, 'gameOver'))); await settled(cs);
  console.log('finished after reload:', done, '| MATCH', same(cs));
  // wrong code -> not found
  const D = boot(); await sleep(100); D.d.getElementById('net-code').value = 'ZZZZ'; await D.w.netJoin(); console.log('wrong code, still searching:', ev(D, 'NET.on'));
  // invite link
  console.log('copy link text would be:', ev(clients[0], "location.href.split('#')[0] + '#room-' + NET.code"));
  if (!process.env.QUICK) for (const m of ['classic', 'hardcore', 'richest', 'survival', 'bounty', 'chaos', 'double', 'speed', 'nomarket']) await scenario(3, ['human', 'wizard', 'demon'], m);
  console.log('ERRORS:', errors.length ? errors.slice(0, 8) : 'none'); process.exit(0);
})();
