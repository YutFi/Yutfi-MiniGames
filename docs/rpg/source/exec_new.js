async function executeTurn(forcedRoll, fromLog, dieKey) {
  if (gameOver || isRolling) return;
  const gid = gameId;
  isRolling = true;
  updateControls();

  const me = currentPlayer;
  if (rpgOn() && RP(me).out) { isRolling = false; switchTurn(); return; }
  RPG.fromLog = !!fromLog; RPG.teleHops = 0;
  const name = playerName(me);
  const wasExtra = extraRollPending;
  extraRollPending = false;
  $('extra-roll-badge').classList.add('hidden');

  // Salary (once per turn, not on extra rolls)
  let salary = 0;
  if (!wasExtra) {
    salary = rpgSalary(me);
    gain(me, salary);
    playerStats[me].turns++;
    turnPaid = true;
    floatAtPlayer(me, `+$${salary}`, '#fde68a');
    // Golden Investment: the second payment arrives with a later salary
    for (const e of playerDelayedGold[me].slice()) {
      if (--e.wait > 0) continue;
      playerDelayedGold[me].splice(playerDelayedGold[me].indexOf(e), 1);
      gain(me, e.amt);
      floatAtPlayer(me, `+$${e.amt}`, '#fde68a');
      addLogEntry(me, `📈 Golden Investment pays out: <b>+$${e.amt}</b>.`);
    }
    refreshAll();

    if (rpgOn() && RP(me).poison > 0) {
      const r = RP(me); r.poison--;
      const l = lose(me, 20);
      rpgLog(me, `☠️ Poison saps <b>$${l}</b> (${r.poison} turn${r.poison === 1 ? '' : 's'} left).`);
      refreshAll();
    }

    if (playerPoisoned[me]) {
      playerPoisoned[me] = false;
      playerThawed[me] = 1;
      addLogEntry(me, '❄️ Frozen solid — <b>turn skipped</b>!');
      await splash('frozenSkip', { p: me });
      setBanner(`<p class="text-xs font-bold text-sky-300">${name} is frozen and loses this turn (+$${salary})</p>`);
      refreshAll();
      await sleep(1200);
      if (gid !== gameId) return;
      rpgTurnEnd(me);
      switchTurn();
      return;
    }

    if (rpgOn() && RP(me).skip > 0) {
      const r = RP(me), jail = r.why === 'jail'; r.skip--; r.why = '';
      rpgLog(me, jail ? '⛓️ Locked in an iron cage — <b>turn skipped</b>!' : '⏳ Lost turn — <b>turn skipped</b>!');
      await quick({ kicker: jail ? 'IRON CAGE' : 'LOST TURN', title: jail ? 'Caged!' : 'Turn Lost', sub: name, emoji: jail ? '⛓️' : '⏳', tint: '#475569', ms: 1300 });
      setBanner(`<p class="text-xs font-bold text-slate-300">${name} loses this turn (+$${salary})</p>`);
      refreshAll();
      await sleep(700);
      if (gid !== gameId) return;
      rpgTurnEnd(me);
      switchTurn();
      return;
    }
  }

  if (isBot(me) && !shopPurchasedThisTurn) {
    await aiShop(me);
    await splashIdle();
    if (gid !== gameId) return;
  }
  if (isBot(me) && rpgOn() && !wasExtra) {
    await aiArena();
    await splashIdle();
    if (gid !== gameId) return;
  }

  // Which die? A replayed or online roll names its die; a bot picks one; a local human uses the picker.
  // Loaded Dice (Black Market): the roll is picked by the player and always uses the normal die.
  const loadedBot = !forcedRoll && isBot(me) && rpgOn() && RP(me).loaded;
  let dKey = forcedRoll ? (DICE[dieKey] ? dieKey : 'normal') : (loadedBot ? 'normal' : isBot(me) ? aiChooseDie(me) : selectedDie);
  if (!DICE[dKey] || DICE[dKey].cost > playerCash[me]) dKey = 'normal';      // can't afford it → the normal die
  let roll = forcedRoll || (loadedBot ? aiLoadedPick(me) : rollDie(dKey));
  if (!DICE[dKey].faces.includes(roll)) { dKey = 'normal'; if (!DICE.normal.faces.includes(roll)) roll = 1; }   // a roll this die can't produce is ignored
  const die = DICE[dKey];
  selectedDie = 'normal';
  if (die.cost > 0) {
    spend(me, die.cost);
    playerStats[me].dice++;
    floatAtPlayer(me, `-$${die.cost}`, '#fb7185');
    addLogEntry(me, `${die.icon} Paid <b>$${die.cost}</b> for the <b>${die.name}</b>.`);
    refreshAll();
  }
  if (rpgOn()) RP(me).lastFrom = playerPositions[me];
  updateControls();
  const rawRoll = roll;
  await rollDice3D(roll, dKey);
  if (gid !== gameId) return;
  roll = rpgAdjustRoll(me, rawRoll);

  // Time Collapse: this roll can be 3 at most
  let capped = 0;
  if (playerRollCap[me]) {
    playerRollCap[me] = false;
    if (roll > 3) { capped = roll; roll = 3; floatAtPlayer(me, '⏳ Capped at 3', '#c4b5fd'); addLogEntry(me, `⏳ Time Collapse: the roll of ${capped} is <b>capped at 3</b>.`); }
    else addLogEntry(me, '⏳ Time Collapse fizzles: the roll was already 3 or less.');
  }

  setBanner(`<p class="text-xs font-bold text-white">${name} rolled <span style="padding:2px 9px;border-radius:8px;background:rgba(139,92,246,.3);border:1px solid rgba(167,139,250,.5);color:#ddd6fe;font-size:14px">${rawRoll}</span>${roll !== rawRoll ? ` <span class="text-rose-300">→ ${roll}${capped ? ' ⏳' : ''}</span>` : ''}${dKey !== 'normal' ? ` <span class="text-slate-400">${die.icon} ${die.short}</span>` : ''}${salary ? ` <span class="text-amber-300">(+$${salary} salary)</span>` : ''}</p>`);

  if (playerClasses[me] === 'human' && roll % 2 === 0) {
    gain(me, TUNE.humanEven);
    floatAtPlayer(me, `+$${TUNE.humanEven}`, '#fde68a');
    addLogEntry(me, `🧑 Work ethic: even roll (${roll}) earned <b>+$${TUNE.humanEven}</b>.`);
    refreshAll();
  }

  if (die.bonus.includes(roll)) {                      // a bonus face (a 6 on the normal and Lucky dice): an extra roll and a power-up
    extraRollPending = true;
    $('extra-roll-badge').classList.remove('hidden');
    playSound('powerup');
    await splash('sixRoll', { p: me });
    if (gid !== gameId) return;
    if (isBot(me)) await aiPowerUp(me); else await promptPowerUpChoice(fromLog);
    if (gid !== gameId) return;
  }

  // Movement
  const from = playerPositions[me];
  const mv = computePath(from, roll, RULES.bounce);

  // One animated step onto `pos` (shared by forward and bounce-back movement)
  const stepOnto = async (pos) => {
    movePlayerTo(me, pos, 0.2);
    hop(me);
    playSound('step');
    if (playerClasses[me] === 'demon') {
      for (const q of rivals(me)) {
        if (pos !== playerPositions[q] || playerCash[q] <= 0) continue;
        if (rpgOn() && rpgGuard(q, me, 'hellfire') !== 'hit') continue;
        const stolen = loseGold(q, Math.min(TUNE.demonSteal, playerCash[q]));
        gain(me, stolen);
        floatAtPlayer(q, `-$${stolen}`, '#fb7185');
        floatAtPlayer(me, `+$${stolen}`, '#fde68a');
        addLogEntry(me, `😈 Hellfire: passed ${playerName(q)} and stole <b>$${stolen}</b>!`);
        playSound('cash');
        refreshAll();
        if (rpgOn()) rpgHit(me, q, 'hellfire');
        await splash('steal', { p: me, t: q, amt: stolen });
      }
    }
    await sleep(210);
  };

  if (mv.blocked) {
    // "Exact" rule: a roll past 100 is wasted
    addLogEntry(me, `Rolled ${roll} but needs exactly <b>${100 - from}</b> to land on 100.`);
    floatAtPlayer(me, 'Need exact!', '#fca5a5');
    await splash('needExact', { p: me });
    await sleep(900);
  } else {
    // Walk up toward 100 — and, under the "bounce" rule, back down with the leftover steps.
    // Example: on 98 rolling 5 → 99, 100 (2 forward) then 99, 98, 97 (3 back) → lands on 97.
    let barred = false;
    for (const pos of mv.fwd) {
      await stepOnto(pos);
      if (gid !== gameId) return;
      if (rpgOn() && bossBlocks(pos)) { barred = true; break; }          // a living boss bars the road
    }
    if (mv.over > 0 && !barred) {
      playerStats[me].bounces++;
      addLogEntry(me, `Rolled ${roll} from ${from} — hit tile 100 and <b>bounced back ${mv.over}</b> to tile <b>${mv.landing}</b>.`);
      floatAtPlayer(me, 'Bounce!', '#fca5a5');
      await splash('bounceBack', { p: me, n: mv.landing });
      if (gid !== gameId) return;
      for (const pos of mv.back) {
        await stepOnto(pos);
        if (gid !== gameId) return;
      }
    }
    await resolveTile(me, gid);
    if (gid !== gameId) return;
    if (gameOver) return;
    rpgDetect(me);
    if (playerPositions[me] === 100) {
      if (rpgOn() && RPG.cfg.rounds) { await rpgLap(me); if (gid !== gameId) return; }
      else { showWinModal(me); return; }
    }
  }

  rpgTurnEnd(me);
  let bonusRoll = false, secondChance = false;
  if (!extraRollPending && rpgOn() && !RP(me).out && RP(me).bonusRoll) {
    const r = RP(me); r.bonusRoll = false;
    if (r.twin) { r.twin = false; r.bonusRoll = true; }
    extraRollPending = true; bonusRoll = true;
    $('extra-roll-badge').classList.remove('hidden');
  }
  if (!extraRollPending && playerBonusRolls[me] > 0) {      // Second Chance
    playerBonusRolls[me]--;
    extraRollPending = true;
    bonusRoll = true; secondChance = true;
    $('extra-roll-badge').classList.remove('hidden');
  }
  if (extraRollPending) {
    addLogEntry(me, secondChance ? '🎲 Second Chance — <b>extra roll</b>!' : bonusRoll ? '🎲 Bonus roll — <b>roll again</b>!' : '🔥 Rolled a 6 — <b>extra roll</b>!');
    isRolling = false;
    updateControls();
    if (isBot(me)) scheduleBot(1000);
  } else {
    switchTurn();
  }
}

function switchTurn() {
  // end-of-turn bookkeeping for the player who is leaving
  const prev = currentPlayer;
  if (playerThawed[prev] === 2) playerThawed[prev] = 0;                       // the protection after a thaw lasts through your next full turn
  else if (playerThawed[prev] === 1) playerThawed[prev] = 2;
  if (playerFrozenNext[prev]) { playerFrozenNext[prev] = false; playerPoisoned[prev] = true; }     // Frozen Contract bites now: their next turn is skipped
  if (playerMarketBan[prev] === 2) playerMarketBan[prev] = 0;                                          // Cursed Fortune: the closed turn is over
  else if (playerMarketBan[prev] === 1) playerMarketBan[prev] = 2;                                      // ...and starts with their next turn
  if (playerEvents[prev]) { playerEvents[prev].prev = playerEvents[prev].cur; playerEvents[prev].cur = []; }
  turnPaid = false;
  let c = currentPlayer, wrapped = false;
  for (let i = 0; i < NP; i++) {
    const n = c % NP + 1;
    if (n <= c) wrapped = true;
    c = n;
    if (!(rpgOn() && RP(c).out)) break;
  }
  currentPlayer = c;
  shopPurchasedThisTurn = false;
  extraRollPending = false;
  isRolling = false;
  let ended = false;
  if (rpgOn()) {
    RPG.actionUsed = false; RPG.teleHops = 0;
    if (RP(c).cloak > 0) RP(c).cloak--;
    if (wrapped) ended = rpgRoundTick();
  }
  updateTurnUI();
  if (ended) { rpgEndByRounds(); return; }
  if (gameOver) return;
  if (isBot(currentPlayer)) scheduleBot(900);
}

