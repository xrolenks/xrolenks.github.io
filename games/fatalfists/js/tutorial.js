'use strict';
// Fatal Fists - playable tutorial (Rick 2026-11-22: "How to play" opens a real tutorial sequence).
// You play Kade against a dummy (Rook) in G.mode 'tutorial', which works like practice (dummy never K.O.'d,
// no clock) but nobody can lose. A panel (#tutPanel, top middle) shows the step and its tasks; each task ticks
// itself off when you actually do it (hooks: tutContact from practiceContact, tutMark from techThrow, and
// tutTick polling your state every frame). All tasks done -> "STEP CLEAR!" -> next step. 6 steps, the last one
// just points to the Move list / Practice / a real fight. Some tasks make the dummy act (task.dummy):
// 'jab' / 'sweep' = it walks up and attacks so you can block, 'grab' = it walks up and throws.
const TUT_PICKS = [0, 2];      // you = Kade, dummy = Rook
const tut = {step: 0, done: new Set(), clearT: 0, msgT: 0, dT: 0, meIdle: 0, launched: false, just: null};

// key labels: your own keys (or the touch button names on a phone)
const TOUCH_NAMES = {punch: 'Punch', kick: 'Kick', block: 'Block', up: '▲', down: '▼', left: '◀', right: '▶'};
const tk = b => '<kbd>' + (document.body.classList.contains('touch') ? TOUCH_NAMES[b] : keyName(KEYMAP[0][b][0])) + '</kbd>';
const ar = s => '<b class="arr">' + s + '</b>';

const TUT_STEPS = [
  {title: 'Move and guard',
   info: () => 'Knock your rival\'s health to zero. Win two rounds to win the fight. First, get moving.',
   tasks: [
     {id: 'walk',   text: () => 'Walk: ' + tk('left') + ' or ' + tk('right')},
     {id: 'jump',   text: () => 'Jump: ' + tk('up')},
     {id: 'crouch', text: () => 'Crouch: ' + tk('down')},
     {id: 'dash',   text: () => 'Dash: tap ' + tk('right') + ' ' + tk('right') + ' quickly'},
     {id: 'blockHigh', dummy: 'jab',   text: () => 'The dummy punches. Hold ' + tk('block') + ' to block it'},
     {id: 'blockLow',  dummy: 'sweep', text: () => 'Now it sweeps your legs. Hold ' + tk('down') + ' + ' + tk('block') + ' to block low'},
   ]},
  {title: 'Punch and kick',
   info: () => 'Walk up to the dummy and hit it.',
   tasks: [
     {id: 'punch',    text: () => 'Punch: ' + tk('punch')},
     {id: 'kick',     text: () => 'Kick: ' + tk('kick')},
     {id: 'uppercut', text: () => 'Uppercut: hold ' + tk('down') + ' + ' + tk('punch')},
     {id: 'sweep',    text: () => 'Leg sweep: hold ' + tk('down') + ' + ' + tk('kick')},
     {id: 'airPunch', text: () => 'Air punch: from a step back, jump at it (' + tk('up') + ' + ' + tk('right') + ') and press ' + tk('punch') + ' as you come down. It hits even if they crouch'},
   ]},
  {title: 'Strings',
   info: () => 'Press the buttons one after another while each hit lands. A miss stops the string.',
   tasks: [
     {id: 'streetRush', text: () => 'Street Rush: ' + tk('punch') + ' ' + tk('punch') + ' ' + tk('punch')},
     {id: 'alleySpin',  text: () => 'Alley Spin: ' + tk('punch') + ' ' + tk('punch') + ' ' + tk('kick')},
     {id: 'updraft',    text: () => 'Updraft: ' + tk('punch') + ' ' + tk('kick') + ' ' + tk('punch') + ' throws them up. Hit them again before they land'},
   ]},
  {title: 'Throws',
   info: () => 'Throws go through blocks, but someone crouching ducks them.',
   tasks: [
     {id: 'throwF', text: () => 'Get close and press ' + tk('punch') + ' + ' + tk('kick') + ' together'},
     {id: 'throwB', text: () => 'Hold ' + tk('left') + ' (away) and press ' + tk('punch') + ' + ' + tk('kick') + ' to throw it behind you'},
     {id: 'escape', dummy: 'grab', text: () => 'The dummy tries to grab you. Press ' + tk('punch') + ' + ' + tk('kick') + ' as it grabs to break free, or crouch under it'},
   ]},
  {title: 'Special moves',
   info: () => ar('↓ →') + ' means: press down, then toward the dummy, then the button, quickly.',
   tasks: [
     {id: 'blast',  text: () => 'Ember Shot: ' + ar('↓ →') + ' + ' + tk('punch')},
     {id: 'rush',   text: () => 'Fiery Rush: ' + ar('↓ →') + ' + ' + tk('kick')},
     {id: 'cancel', text: () => 'Special cancel: ' + tk('punch') + ' ' + tk('punch') + ', then ' + ar('↓ →') + ' + ' + tk('kick') + ' while the punches land'},
   ]},
  {title: 'Learn more',
   info: () => 'That\'s the basics! Every fighter\'s moves, strings and specials are in the <b>Move list</b>. ' +
     tk('punch') + ' + ' + tk('kick') + ' and the rest can be changed in <b>Controls</b>. Esc or P pauses. ' +
     'Keep hitting the dummy as long as you like, or:',
   tasks: [], end: true},
];
const tutTasks = () => TUT_STEPS[tut.step].tasks;

// start the tutorial from step 1 (the "How to play" button)
function startTutorial() {
  G.mode = 'tutorial';
  G.picks = TUT_PICKS.slice();
  tut.step = 0;
  startMatch();      // calls tutReset, which sets up the step
}
// startMatch (also "Restart fight" from the pause menu): set up the current step again
function tutReset() {
  if (G.mode !== 'tutorial') return;
  goStep(tut.step);
}
function goStep(n) {
  tut.step = Math.max(0, Math.min(TUT_STEPS.length - 1, n));
  tut.done = new Set(); tut.clearT = 0; tut.dT = 0; tut.meIdle = 0; tut.launched = false; tut.just = null;
  G.fighters.forEach(resetFighter);
  G.projectiles = [];
  G.phase = 'fight'; G.pt = 0;      // no ROUND 1 / FIGHT! in the tutorial
  practiceReset();
  setMsg(TUT_STEPS[tut.step].end ? '' : 'STEP ' + (tut.step + 1)); tut.msgT = 60;
  tutRender();
}

// a task was done (only counts if it's in the current step)
function tutMark(id) {
  if (G.mode !== 'tutorial' || tut.clearT || tut.done.has(id) || !tutTasks().some(t => t.id === id)) return;
  tut.done.add(id); tut.just = id;
  SFX_RAW.select();
  if (tutTasks().every(t => tut.done.has(t.id))) {      // whole step done
    tut.clearT = 80;
    setMsg(tut.step === TUT_STEPS.length - 2 ? 'WELL DONE!' : 'STEP CLEAR!'); tut.msgT = 80;
    SFX.fight();
  }
  tutRender();
}
// something touched (from practiceContact): kind 'hit' / 'block' / 'throw', M = the move (blasts have M.blast)
function tutContact(att, kind, M) {
  if (G.mode !== 'tutorial') return;
  if (att.side === 1) {      // the dummy's attack: did you block it?
    if (kind === 'block' && att.move === 'punch') tutMark('blockHigh');
    if (kind === 'block' && att.move === 'sweep') tutMark('blockLow');
    return;
  }
  if (kind === 'throw') return tutMark(att.throwDir > 0 ? 'throwF' : 'throwB');
  if (kind !== 'hit') return;
  const m = M && M.blast ? 'blast' : att.move, n = att.combo;
  if (m === 'punch' || m === 'lungePunch') tutMark('punch');
  if (m === 'kick' || m === 'lungeKick') tutMark('kick');
  if (m === 'uppercut' || m === 'sweep' || m === 'airPunch' || m === 'blast') tutMark(m);
  if (m === 'hook' && n >= 3) tutMark('streetRush');
  if (m === 'roundhouse' && n >= 3) tutMark('alleySpin');
  const launcher = m === 'riser' || m === 'updraftRiser';
  if (launcher) tut.launched = true;
  else if (tut.launched && n >= 4) tutMark('updraft');
  if (n <= 1 && !launcher) tut.launched = false;
  if (m === 'fieryRush') { tutMark('rush'); if (n >= 2) tutMark('cancel'); }
}

// the dummy's "keys": still, unless the first task not done yet needs it to attack you
function tutDummyInput(d, me) {
  const none = {held: {}, press: []};
  const task = tutTasks().find(t => !tut.done.has(t.id));
  if (!task || !task.dummy || tut.clearT || !d.onGround || !ACTIONABLE.has(d.state)) return none;
  const dist = Math.abs(me.x - d.x), toward = me.x > d.x ? 'right' : 'left';
  const near = task.dummy === 'grab' ? 62 : 86;
  if (dist > near + 4) { tut.dT = 0; return {held: {[toward]: true}, press: []}; }      // walk up to you
  if (++tut.dT < (task.dummy === 'grab' ? 80 : 60)) return none;      // wait a moment, so you can get ready
  tut.dT = 0;
  if (task.dummy === 'jab') return {held: {}, press: ['punch']};
  if (task.dummy === 'sweep') return {held: {down: true}, press: ['kick']};
  return {held: {}, press: ['punch', 'kick']};      // grab
}

// every frame (from step)
function tutTick() {
  if (G.mode !== 'tutorial' || !G.fighters) return;
  const [me, d] = G.fighters;
  // tasks you just do, no dummy needed
  if (me.state === 'walk') tutMark('walk');
  if (me.state === 'jump') tutMark('jump');
  if (me.state === 'crouch') tutMark('crouch');
  if (me.state === 'dashf' || me.state === 'dashb') tutMark('dash');
  // crouched under the dummy's grab: its throw ran out without catching you
  if (d.state === 'attack' && d.move === 'throw' && d.t === MOVES.throw.startup + MOVES.throw.active && !d.moveHit && isLow(me)) tutMark('escape');
  // your health refills too (nobody loses in the tutorial)
  tut.meIdle = me.onGround && ACTIONABLE.has(me.state) && me.hp < 100 ? tut.meIdle + 1 : 0;
  if (tut.meIdle >= DUMMY_REFILL) { me.hp = me.trail = 100; tut.meIdle = 0; }
  if (tut.msgT > 0 && --tut.msgT === 0) setMsg('');
  if (tut.clearT > 0 && --tut.clearT === 0) goStep(tut.step + 1);
}

// the panel
function tutRender() {
  const s = TUT_STEPS[tut.step], first = s.tasks.find(t => !tut.done.has(t.id));
  let h = '<div class="tstep">Step ' + (tut.step + 1) + ' of ' + TUT_STEPS.length + '</div><h3>' + s.title + '</h3><p>' + s.info() + '</p>';
  if (s.tasks.length) h += '<ul>' + s.tasks.map(t => '<li class="' + (tut.done.has(t.id) ? 'done' + (tut.just === t.id ? ' just' : '') : t === first ? 'cur' : '') + '">' + t.text() + '</li>').join('') + '</ul>';
  h += '<div class="tbtns">';
  if (s.end) h += '<button data-go="moves">Move list</button><button data-go="practice">Practice</button><button data-go="1p">Fight the computer</button><button data-go="help">Start over</button>';
  else {
    if (tut.step > 0) h += '<button data-tut="-1">◀ Back</button>';
    h += '<button data-tut="1">Skip step ▶</button>';
  }
  h += '<button data-go="title">Quit</button></div>';
  $('tutPanel').innerHTML = h;
}
$('tutPanel').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  b.blur();      // so game keys don't press it again
  if (b.dataset.tut) { SFX_RAW.select(); goStep(tut.step + +b.dataset.tut); }
});
