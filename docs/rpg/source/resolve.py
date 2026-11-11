import re
L=open('merged.html',encoding='utf8').read().split('\n')
idx=[i for i,l in enumerate(L) if l.startswith('<<<<<<< ')]
blocks={}
for n,s in enumerate(idx,1):
    m=next(i for i in range(s,len(L)) if L[i]=='=======')
    e=next(i for i in range(m,len(L)) if L[i].startswith('>>>>>>> '))
    blocks[n]=(s,m,e,L[s+1:m],L[m+1:e])
J=lambda *p:[x for part in p for x in part]
def raw(t): return t.split('\n')
res={}
O=lambda n:blocks[n][3]; T=lambda n:blocks[n][4]
res[1]=J(O(1),T(1))
res[2]=J(T(2)[:3],[
 '      <button class="btn btn-guide" onclick="openGuide()" title="How the dungeon works">📖 <span class="hide-sm">Guide</span></button>',
 '      <button id="fx-btn" class="btn btn-ghost" onclick="toggleFx()" title="Effects quality (turn down on slow phones)">✨ <span id="fx-text" class="hide-sm">FX High</span></button>'],T(2)[3:])
res[3]=J(O(3),['      </div>'],T(3))
res[4]=['    <p id="win-subtitle" class="text-sm text-slate-300 mt-1 mb-3"></p>','    <div id="win-stats" class="mb-3"></div>','    <div id="win-extra" class="mb-4 text-xs text-slate-300"></div>']
res[5]=J(T(5),O(5))
res[6]=J(O(6),T(6)[1:])
res[7]=[]                                   # shop functions live in the market layer (ported by hand)
res[8]=['async function executeTurn(forcedRoll, fromLog, dieKey) {']
res[9]=T(9); res[10]=T(10); res[11]=T(11); res[12]=T(12); res[13]=T(13); res[14]=T(14)   # replaced wholesale below
res[15]=J(O(15),T(15))
res[16]=raw("""    let dest = ladderDest(pos, p);
    if (playerClasses[p] === 'wizard' && dest + TUNE.wizardLadder <= (RPG.cfg.dbl ? 98 : 100) && !SNAKES[dest + TUNE.wizardLadder]) {
      dest += TUNE.wizardLadder;""")
res[17]=J(O(17),T(17))
sw=T(18)[:-1]
res[18]=J(sw,O(18))
res[19]=J(O(19),T(19)[1:])
res[20]=['  NET.decWait = null;','  stageLocked = false; if (stageFin) stageFin();',"  ['powerup-modal', 'shop-modal', 'target-modal', 'win-modal', 'confirm-modal', 'jack-modal', 'arena-modal', 'loaded-modal'].forEach(closeModal);"]
res[21]=J(O(21),T(21)); res[22]=J(O(22),T(22)); res[33]=J(O(33),T(33))
res[23]=["const LOG_RE = /^(?:[1-6btcHCrikpnevADuqz]|[wfmSFoda][JKLMN]|[slg][1-8]|x[0-2]|y[a-t][0-9])*$/;"]
res[24]=raw("""  // a room record without a mode comes from the original game: play it by the original rules
  const mode = (typeof g.mode === 'string' && MODES[g.mode]) ? g.mode : 'classic';
  const seed = (Number.isInteger(g.seed) && g.seed >= 0 && g.seed <= 4294967295) ? g.seed : 1;
  return { gen: g.gen, by: g.by, seats: g.seats.slice(), cls: g.cls.slice(), nicks: g.nicks.map(cleanNick), log: g.log, mode, seed, rule: g.rule === 'x' ? 'x' : 'b' };""")
res[25]=["  const G = NET.G ? { gen: NET.G.gen, by: NET.G.by, seats: NET.G.seats, cls: NET.G.cls, nicks: NET.G.nicks, log: NET.G.log, mode: NET.G.mode, seed: NET.G.seed, rule: NET.G.rule } : null;"]
res[26]=["  NET.G = { gen: G.gen, by: G.by, seats: G.seats.slice(), cls: G.cls.slice(), nicks: G.nicks.slice(), log: G.log, mode: validMode(G.mode), seed: G.seed >>> 0 || 1, rule: G.rule === 'x' ? 'x' : 'b' };","  modeKey = NET.G.mode;","  RULES.bounce = NET.G.rule !== 'x';"]
res[27]=T(27)  # fixed by hand after
res[28]=J(T(28),O(28))
res[29]=["  netStart({ gen: NET.G.gen + 1, by: NET.tok, seats: keep.map(i => NET.G.seats[i]), cls: keep.map(i => NET.G.cls[i]), nicks: keep.map(i => NET.G.nicks[i]), log: '', mode: NET.G.mode, seed: newSeed(), rule: NET.G.rule });"]
res[30]=["  const G = { gen: 1, by: NET.tok, seats: NET.G.seats.slice(), cls: NET.G.cls.slice(), nicks: NET.G.nicks.slice(), log: '', mode: NET.G.mode, seed: newSeed(), rule: NET.G.rule };"]
res[31]=J(O(31),T(31))
res[32]=["  NET.G = { gen: 0, by: NET.tok, seats: [NET.tok], cls: [NET.cls], nicks: [NET.nick], log: '', mode: pendingRpgMode || 'std', seed: 1, rule: soloBounce ? 'b' : 'x' };"]
out=[];i=0
starts={b[0]:n for n,b in blocks.items()}
while i<len(L):
    if i in starts:
        n=starts[i]; out+=res[n]; i=blocks[n][2]+1
    else: out.append(L[i]); i+=1
txt='\n'.join(out)
# replace executeTurn .. switchTurn wholesale
a=txt.index('async function executeTurn(')
b=txt.index('/* ---- Tile events ---- */')
txt=txt[:a]+open('exec_new.js',encoding='utf8').read()+txt[b:]
open('resolved.html','w',encoding='utf8').write(txt)
print(len(txt.split('\n')), txt.count('<<<<<<<'))
