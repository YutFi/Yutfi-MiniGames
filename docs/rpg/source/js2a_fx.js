
/* ============================================================
   RPG LAYER 2/6 — FX engine (canvas particles), screen shake, sound, cinematic stage
   Visual only: nothing here may change game state, and everything is skipped while fastMode (log replay).
   ============================================================ */
const REDUCED = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
let fxLow = false;
try { fxLow = localStorage.getItem('sl-fx') === 'low'; } catch (e) {}
const FXE = { cv: null, cx: null, ps: [], on: false, w: 0, h: 0, dpr: 1, slow: 0, last: 0 };
const FX_COL = {
  gold:  ['#fde047', '#fbbf24', '#f59e0b', '#fff7c2'], magic: ['#a78bfa', '#22d3ee', '#f0abfc', '#ffffff'], fire: ['#fb923c', '#f97316', '#fde047', '#ef4444'],
  ice:   ['#e0f2fe', '#7dd3fc', '#38bdf8', '#ffffff'], boom: ['#ef4444', '#f97316', '#fde047', '#ffffff'], heal: ['#86efac', '#4ade80', '#bbf7d0', '#ffffff'],
  dark:  ['#7e22ce', '#a855f7', '#1e1b4b', '#e9d5ff'], blood: ['#fb7185', '#e11d48', '#9f1239', '#ffffff']
};
function fxInit() {
  FXE.cv = $('fx-canvas'); if (!FXE.cv) return;
  FXE.cx = FXE.cv.getContext ? FXE.cv.getContext('2d') : null;
  fxResize();
  window.addEventListener('resize', fxResize);
  document.body.classList.toggle('fx-low', fxLow);
  syncFxButton();
}
function fxResize() {
  const cv = FXE.cv; if (!cv || !cv.parentElement) return;
  FXE.dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.parentElement.getBoundingClientRect();
  FXE.w = Math.max(1, r.width); FXE.h = Math.max(1, r.height);
  cv.width = Math.round(FXE.w * FXE.dpr); cv.height = Math.round(FXE.h * FXE.dpr);
}
function toggleFx() {
  fxLow = !fxLow;
  try { localStorage.setItem('sl-fx', fxLow ? 'low' : 'high'); } catch (e) {}
  document.body.classList.toggle('fx-low', fxLow);
  syncFxButton();
  toast(fxLow ? 'Effects: low (smoother on slow phones)' : 'Effects: high');
}
function syncFxButton() { const t = $('fx-text'); if (t) t.textContent = fxLow ? 'FX Low' : 'FX High'; }
// emit n particles at a board tile (or {x,y} in board %)
function fxEmit(where, kind, n, o) {
  if (fastMode || REDUCED || !FXE.cx) return;
  o = o || {};
  const c = typeof where === 'number' ? getTileCoordinates(where) : where;
  const cols = FX_COL[kind] || FX_COL.magic;
  const cap = fxLow ? 70 : 220;
  n = Math.round(n * (fxLow ? 0.4 : 1));
  for (let i = 0; i < n && FXE.ps.length < cap; i++) {
    const a = (o.up ? -Math.PI / 2 + (R_vis() - .5) * 1.2 : R_vis() * Math.PI * 2), sp = (o.speed || 1) * (30 + R_vis() * 110);
    FXE.ps.push({ x: c.x / 100 * FXE.w, y: c.y / 100 * FXE.h, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift || 0), g: o.g == null ? 140 : o.g,
      life: 0, max: (o.life || .9) * (.6 + R_vis() * .8), s: (o.size || 3.2) * (.6 + R_vis() * .9), c: cols[Math.floor(R_vis() * cols.length)], kind });
  }
  if (!FXE.on) { FXE.on = true; FXE.last = performance.now(); requestAnimationFrame(fxFrame); }
}
const R_vis = () => Math.random();          // cosmetic randomness only (never used for game outcomes)
function fxFrame(t) {
  const cx = FXE.cx; if (!cx) { FXE.on = false; return; }
  const dt = Math.min(0.05, (t - FXE.last) / 1000); FXE.last = t;
  if (dt > 0.034) FXE.slow++; else if (FXE.slow > 0) FXE.slow--;
  if (FXE.slow > 70 && !fxLow) { fxLow = true; document.body.classList.add('fx-low'); syncFxButton(); toast('Effects lowered for smoother play (use ✨ to change).'); FXE.slow = 0; }
  cx.setTransform(FXE.dpr, 0, 0, FXE.dpr, 0, 0);
  cx.clearRect(0, 0, FXE.w, FXE.h);
  cx.globalCompositeOperation = 'lighter';
  const ps = FXE.ps;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]; p.life += dt;
    if (p.life >= p.max) { ps.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const k = 1 - p.life / p.max;
    cx.globalAlpha = Math.max(0, k);
    cx.fillStyle = p.c;
    cx.beginPath(); cx.arc(p.x, p.y, Math.max(.4, p.s * (.4 + k * .6)), 0, 6.283); cx.fill();
  }
  cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
  if (ps.length) requestAnimationFrame(fxFrame); else { FXE.on = false; cx.clearRect(0, 0, FXE.w, FXE.h); }
}
function shakeBoard(big) {
  if (fastMode || REDUCED) return;
  const el = document.querySelector('.board-frame'); if (!el) return;
  el.classList.remove('board-shake', 'board-shake-big'); void el.offsetWidth;
  el.classList.add(big ? 'board-shake-big' : 'board-shake');
  setTimeout(() => el.classList.remove('board-shake', 'board-shake-big'), 1000);
  try { if (navigator.vibrate) navigator.vibrate(big ? [60, 30, 90] : 40); } catch (e) {}
}
function hotTile(n) { if (fastMode || !tileEls[n]) return; tileEls[n].classList.remove('hot'); void tileEls[n].offsetWidth; tileEls[n].classList.add('hot'); }
function dmgText(tile, text, crit) {
  if (fastMode) return;
  const c = typeof tile === 'number' ? getTileCoordinates(tile) : tile;
  const el = document.createElement('div');
  el.className = 'float-text dmg' + (crit ? ' crit' : '');
  el.style.left = (c.x + (R_vis() * 6 - 3)) + '%'; el.style.top = (c.y - 3) + '%'; el.style.color = crit ? '#fde047' : '#fb7185';
  el.textContent = text; $('fx-layer').appendChild(el); setTimeout(() => el.remove(), 1200);
}
// a coin flies from the player's token to their gold counter
function coinFly(p) {
  if (fastMode || REDUCED || fxLow) return;
  const t = $('token-' + p), dst = $(`p${p}-cash`); if (!t || !dst) return;
  const a = t.getBoundingClientRect(), b = dst.getBoundingClientRect();
  for (let i = 0; i < 3; i++) {
    const el = document.createElement('div'); el.className = 'coin-fly'; el.textContent = '🪙';
    el.style.left = (a.left + a.width / 2 + (i - 1) * 10) + 'px'; el.style.top = (a.top + a.height / 3) + 'px'; el.style.opacity = '1';
    document.body.appendChild(el);
    setTimeout(() => { el.style.transform = `translate(${b.left - a.left - a.width / 2}px,${b.top - a.top - a.height / 3}px) scale(.5)`; el.style.opacity = '.1'; }, 30 + i * 90);
    setTimeout(() => { el.remove(); dst.classList.remove('cash-pop'); void dst.offsetWidth; dst.classList.add('cash-pop'); }, 950 + i * 90);
  }
}

/* ---- extra sound effects (Tone.js), layered on the existing synths ---- */
function sfx(type) {
  if (fastMode || !soundEnabled || !polySynth) return;
  try {
    if (Tone.context.state !== 'running') Tone.start();
    const t0 = Tone.now() + 0.02;
    const seq = (notes, step, dur) => notes.forEach((n, i) => polySynth.triggerAttackRelease(n, dur || '16n', t0 + i * (step || .09)));
    const chord = (notes, d) => polySynth.triggerAttackRelease(notes, d || '8n', t0);
    const noise = d => { if (noiseSynth) noiseSynth.triggerAttackRelease(d || '8n', t0); };
    switch (type) {
      case 'chest':     seq(['C5', 'E5', 'G5', 'C6', 'E6'], .08); break;
      case 'mimic':     chord(['C2', 'Db2', 'F#2'], '4n'); noise('4n'); break;
      case 'portal':    seq(['C4', 'G4', 'D5', 'A5', 'E6'], .07); break;
      case 'tick':      chord(['A5'], '64n'); break;
      case 'wheelwin':  seq(['C5', 'E5', 'G5', 'C6'], .08); chord(['C4', 'G4'], '2n'); break;
      case 'wheellose': seq(['E4', 'C4', 'A3', 'F3'], .14); break;
      case 'altar':     chord(['D3', 'A3', 'F4'], '2n'); break;
      case 'camp':      seq(['G4', 'B4', 'D5', 'G5'], .12, '8n'); break;
      case 'trap':      noise('8n'); chord(['B2', 'F3'], '8n'); break;
      case 'rewind':    seq(['C6', 'A5', 'F5', 'D5', 'Bb4', 'G4'], .06); break;
      case 'mirror':    seq(['E6', 'B6', 'E7'], .05, '32n'); break;
      case 'loaded':    seq(['C5', 'C5', 'G5'], .09); break;
      case 'cloak':     chord(['D3', 'F3', 'A3'], '4n'); break;
      case 'hook':      noise('16n'); seq(['G4', 'D5'], .08); break;
      case 'bounty':    seq(['E5', 'E5', 'B5'], .1); break;
      case 'lightning': noise('8n'); seq(['C7', 'G6', 'C7', 'E7'], .04, '32n'); break;
      case 'event':     chord(['C3', 'G3'], '2n'); seq(['C4', 'E4', 'G4', 'C5', 'E5'], .13, '8n'); break;
      case 'evbad':     chord(['C2', 'Eb2', 'Gb2'], '2n'); seq(['C3', 'Eb3', 'Gb3', 'A3'], .16, '8n'); noise('4n'); break;
      case 'boss':      chord(['C2', 'G2', 'Db3'], '1n'); noise('2n'); seq(['C3', 'Db3', 'C3', 'Db3'], .22, '8n'); break;
      case 'hit':       noise('16n'); chord(['C3'], '16n'); break;
      case 'crit':      noise('8n'); seq(['C5', 'G5', 'C6'], .05, '16n'); break;
      case 'bossdown':  seq(['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6'], .1, '8n'); chord(['C3', 'G3', 'C4'], '1n'); break;
      case 'defeat':    seq(['C4', 'Bb3', 'Gb3', 'C3'], .2, '4n'); break;
      case 'ach':       seq(['E5', 'G5', 'C6', 'E6'], .07); break;
      case 'duel':      seq(['C4', 'C4', 'G4'], .1); noise('16n'); break;
      case 'ally':      seq(['C4', 'E4', 'G4', 'C5'], .09, '8n'); break;
      case 'betray':    seq(['C3', 'Db3'], .22, '4n'); noise('4n'); break;
      case 'freeze':    seq(['E6', 'C6', 'A5'], .05, '16n'); break;
    }
  } catch (e) { /* audio is optional */ }
}

/* ---- Stage: one overlay that every cinematic uses; joins the meme-splash queue so the move pump waits for it ---- */
let stageSkip = null, stageLocked = false;
function stage(build, opt) {
  if (fastMode) return Promise.resolve();
  const gid = gameId;
  splashDepth++;
  const run = () => showStage(build, opt || {}, gid);
  const p = splashQueue.then(run, run).catch(() => {}).then(() => { splashDepth--; });
  splashQueue = p;
  return p;
}
function showStage(build, opt, gid) {
  return new Promise(resolve => {
    if (gid !== gameId) { resolve(); return; }
    const el = $('stage'), card = $('stage-card');
    el.style.setProperty('--tint', opt.tint || '#7c3aed');
    el.classList.toggle('shake', !!opt.shake);
    card.innerHTML = '';
    const rain = $('stage-rain'); rain.innerHTML = ''; rain.classList.toggle('up', !!opt.up);
    if (opt.rain && !fxLow) for (let i = 0; i < 18; i++) {
      const s = document.createElement('span'); s.textContent = opt.rain[i % opt.rain.length];
      s.style.left = (R_vis() * 96) + '%'; s.style.animationDuration = (1.4 + R_vis() * 1.2) + 's'; s.style.animationDelay = (R_vis() * .8) + 's';
      s.style.setProperty('--rot', (R_vis() * 540 - 270) + 'deg'); rain.appendChild(s);
    }
    el.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    let skipped = false, done = false; const waiters = new Set(); const timers = new Set();
    const wait = ms => new Promise(r => {
      if (skipped) { r(); return; }
      const t = setTimeout(() => { timers.delete(t); waiters.delete(r); r(); }, ms * RPG.speed);
      timers.add(t); waiters.add(r);
    });
    const finish = () => {
      if (done) return; done = true;
      clearTimeout(gt); timers.forEach(clearTimeout); stageSkip = null; el.onclick = null; stageLocked = false;
      el.classList.remove('show');
      setTimeout(() => { if (!el.classList.contains('show')) { el.classList.add('hidden'); card.innerHTML = ''; rain.innerHTML = ''; } resolve(); }, 220);
    };
    const skip = () => { if (stageLocked) return; skipped = true; waiters.forEach(r => r()); waiters.clear(); };
    const ctx = { el, card, wait, skipped: () => skipped, lock: v => { stageLocked = !!v; }, boardShake: shakeBoard };
    stageSkip = skip; el.onclick = skip;
    let gt; const arm = () => { gt = setTimeout(() => { if (stageLocked) arm(); else finish(); }, 60000); }; arm();
    Promise.resolve().then(() => build(ctx)).catch(() => {}).then(async () => { await wait(opt.hold == null ? 350 : opt.hold); finish(); });
  });
}
// prompts the local player with buttons on the stage; resolves with the picked key
function stageChoice(ctx, choices) {
  return new Promise(res => {
    ctx.lock(true);
    const box = document.createElement('div'); box.className = 'st-choices';
    choices.forEach(c => {
      const b = document.createElement('button'); b.className = 'btn ' + (c.cls || 'btn-primary'); b.innerHTML = c.label; b.disabled = !!c.off;
      b.onclick = e => { e.stopPropagation(); ctx.lock(false); box.remove(); res(c.key); };
      box.appendChild(b);
    });
    ctx.card.appendChild(box);
  });
}
const stHead = (kicker, title, sub) => `${kicker ? `<div class="st-kicker">${kicker}</div>` : ''}<div class="st-title">${title}</div><div class="st-sub" id="st-sub">${sub || ''}</div>`;
const stSet = (id, html) => { const e = $(id); if (e) e.innerHTML = html; };
