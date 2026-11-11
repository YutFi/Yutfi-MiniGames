
/* ============================================================
   RPG LAYER 3/6 — HUD chips, tile art, mode pickers, guide
   ============================================================ */
let modeKey = 'std';                 // game mode used by the next resetGame()
let pendingRpgMode = 'std';
let lastChips = '';

function renderHudChips() {
  const box = $('hud-chips'); if (!box) return;
  const m = MODES[RPG.mode];
  let h = `<span class="chip mode" title="${m.desc}">${m.icon} ${m.name}</span>`;
  if (rpgOn()) {
    h += `<span class="chip">⏱ Round ${RPG.round}${RPG.cfg.rounds ? '/' + RPG.cfg.rounds : ''}</span>`;
    if (RPG.mods.snake > 0) h += `<span class="chip evt">🐍 Snakes +4 · ${RPG.mods.snake}r</span>`;
    if (RPG.mods.storm > 0) h += `<span class="chip evt">⛈️ Dice ≤4 · ${RPG.mods.storm}r</span>`;
    if (RPG.mods.fest > 0)  h += `<span class="chip evt">🎪 Market −30% · ${RPG.mods.fest}r</span>`;
    if (RPG.mods.sal > 0)   h += `<span class="chip evt">🤑 Salary ×2 · ${RPG.mods.sal}r</span>`;
    if (RPG.wanted) h += `<span class="chip wanted" title="Sabotage the leader to earn a bounty">🎯 Wanted: ${playerName(RPG.wanted)}</span>`;
    if (RPG.cfg.danger || RPG.mode === 'survival') h += `<span class="chip evt">☠️ Danger ${RPG.danger}</span>`;
  }
  if (h !== lastChips) { box.innerHTML = h; lastChips = h; }
}

function rpgDecorateTiles() {
  for (let n = 1; n <= 100; n++) { const el = tileEls[n]; if (el) { el.querySelectorAll('.rt').forEach(x => x.remove()); el.title = ''; } }
  if (!rpgOn()) return;
  Object.entries(RPG.tiles).forEach(([ns, t]) => {
    const n = +ns, el = tileEls[n]; if (!el) return;
    if (t.t === 'trap' && !t.rev) return;
    const info = TILE_INFO[t.t];
    let icon = info.icon, lbl = info.lbl, extra = '', cls = 'rt rt-' + t.t, tip = info.tip;
    if (t.t === 'trap') { const k = TRAP_KINDS[t.k]; icon = k.icon; lbl = 'trap'; tip = k.name + ' (revealed)'; }
    if (t.t === 'boss') {
      const b = BOSSES[t.k], bs = RPG.boss[t.k]; icon = b.icon; lbl = b.name.split(' ')[0]; tip = b.name + (bs.alive ? ` — ${bs.hp}/${bs.max} HP` : ' (defeated)');
      if (!bs.alive) cls += ' boss-dead'; else extra = `<div class="rt-hp"><i style="width:${Math.max(3, bs.hp / bs.max * 100)}%"></i></div>`;
    }
    if (dormant(n)) { cls += ' dormant'; tip += ' — resting'; }
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = `<span class="rt-ico">${icon}</span>${lbl ? `<span class="rt-lbl">${lbl}</span>` : ''}${extra}`;
    el.appendChild(d); el.title = tip;
  });
}

function rpgHudBuffs(p) {
  const r = RP(p), b = [];
  if (!r || !rpgOn()) return b;
  if (r.out) b.push('<span class="buff red">☠️ Fallen</span>');
  if (RPG.cfg.lives && !r.out) b.push(`<span class="buff red">❤️ ${r.lives} ${r.lives === 1 ? 'life' : 'lives'}</span>`);
  if (RPG.wanted === p) b.push('<span class="buff red">🎯 WANTED</span>');
  if (r.cloak > 0) b.push(`<span class="buff violet">👻 Cloak ${r.cloak}</span>`);
  if (r.mirror) b.push('<span class="buff violet">🪞 Mirror</span>');
  if (r.hook) b.push('<span class="buff lime">🪝 Hook</span>');
  if (r.loaded) b.push('<span class="buff amber">🎲 Loaded</span>');
  if (r.disc) b.push(`<span class="buff amber">🏷️ ${r.disc >= 1 ? 'FREE item' : '−' + Math.round(r.disc * 100) + '%'}</span>`);
  if (r.poison > 0) b.push(`<span class="buff lime">☠️ Poison ${r.poison}</span>`);
  if (r.curse) b.push(`<span class="buff red">${CURSES[r.curse].icon} ${CURSES[r.curse].name}</span>`);
  if (r.skip > 0) b.push(`<span class="buff blue">${r.why === 'jail' ? '⛓️ Caged' : '⏳ Lost turn'}</span>`);
  if (r.slow > 0) b.push('<span class="buff blue">🥶 Slowed</span>');
  if (r.contract) b.push(`<span class="buff amber">🎯 Bounty→${playerName(r.contract.on)}</span>`);
  if (r.gear) b.push(`<span class="buff cyan">${GEAR[r.gear].icon} ${GEAR[r.gear].name} ×${r.gearN}</span>`);
  const al = allyOf(p); if (al) b.push(`<span class="buff green">🤝 ${playerName(al)}</span>`);
  return b;
}
function rpgHudMeta(p) {
  const r = RP(p); if (!r || !rpgOn()) return { title: '', ach: '' };
  const t = titleOf(p);
  const ach = Object.keys(r.ach).map(k => `<span class="ach" title="${ACH[k].name}: ${ACH[k].desc}">${ACH[k].icon}</span>`).join('');
  return { title: t ? `<span class="rep-title">${t}</span>` : '', ach };
}

/* ---- mode pickers ---- */
function renderModeList(boxId, sel, pick, locked) {
  const box = $(boxId); if (!box) return;
  box.innerHTML = '';
  Object.entries(MODES).forEach(([k, m]) => {
    const b = document.createElement('button');
    b.className = 'mode-card' + (k === sel ? ' selected' : '');
    b.disabled = !!locked;
    b.innerHTML = `<span class="mi">${m.icon}</span><span><b>${m.name}</b><small>${m.desc}</small></span>`;
    b.onclick = () => pick(k);
    box.appendChild(b);
  });
}

function openGuide() {
  $('guide-body').innerHTML = `
  <div class="guide-sec"><h4>🎯 Goal</h4><p>Reach tile 100 with an <b>exact roll</b>. Gold and items help you get there (or stop rivals getting there first).</p></div>
  <div class="guide-sec"><h4>🗺️ New tiles</h4><ul>
    <li>🎁 <b>Chest</b> — gold, a half-price coupon, a shield, a free power-up… or a Mimic that bites.</li>
    <li>🌀 <b>Portal</b> — jump forward/back, swap with a rival, or reach a secret bonus room.</li>
    <li>🎡 <b>Wheel of Fortune</b> — spin for $200, extra rolls, shields… or a curse / lost turn.</li>
    <li>🔮 <b>Cursed Altar</b> — pay $100 for a blessing, or refuse and risk a curse.</li>
    <li>🏕️ <b>Rest Camp</b> — cures poison, curses and freezes; restores a shield; a little gold.</li>
    <li>❓ <b>Hidden traps</b> — spikes, poison, gold-thieving pits, cages. 🧙 Wizards sense them ahead, 🧑 Humans may disarm them, 😇 Angels shrug off poison and cages, 😈 Demons ignore spikes.</li>
    <li>👹 <b>Bosses</b> block the way: 🧊 Ice Titan (33), 🐉 Ancient Dragon (56), 💀 Lich King (82). Their health is shared — chip away, land the final blow for the best loot.</li></ul></div>
  <div class="guide-sec"><h4>🛒 New Black Market items</h4><p>⏪ Time Rewind · 🪞 Mirror Curse · 🎲 Loaded Dice (1/match) · 👻 Phantom Cloak · 🪝 Snakeslayer Hook · 🎯 Bounty Contract · ⚡ Chain Lightning. Still one purchase per turn, with match limits and cooldowns.</p></div>
  <div class="guide-sec"><h4>🌍 World events</h4><p>Every 3–5 rounds the dungeon announces an event (Gold Rush, Dark Storm, Dragon's Wrath…). Everyone sees the same event.</p></div>
  <div class="guide-sec"><h4>⚔️ The Arena</h4><p>Duel a rival (higher roll wins $50), start a Treasure Competition, form a 3-round Alliance (and betray it if you dare). The player in the lead is <b>Wanted</b>: sabotaging them pays a bounty.</p></div>
  <div class="guide-sec"><h4>🏅 Titles &amp; achievements</h4><p>Earned by how you play and shown beside your name. They are cosmetic: they never change the numbers.</p></div>
  <div class="guide-sec"><h4>🎮 Modes</h4><ul>${Object.values(MODES).map(m => `<li>${m.icon} <b>${m.name}</b> — ${m.desc}</li>`).join('')}</ul></div>`;
  openModal('guide-modal');
}
