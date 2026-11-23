'use strict';
// Fatal Fists - combo list + demonstrations in practice mode (Rick 2026-11-23).
// Practice: the "Combos" button (dummy panel, or the pause menu) opens a list of combos for your fighter. "Watch" puts
// both fighters back in place and the game plays the combo for you on the dummy (your fighter is driven by the
// combo's script, the dummy stands still, no blocking). Then the panel at the top stays up with the inputs so you
// can try it yourself, with "Watch again".
//
// A combo's `script` is a list of inputs separated by spaces, each "what:frames" (frames = how long that step lasts
// before the next one; at 60 a second):
//   P / K / PK      press punch / kick / both          f+P, d+K ...  hold a direction while pressing
//   db+K, bf+P ...  a special motion: each direction held 3 frames, then the button (d down, f toward, b away, u up)
//   dash            double-tap toward the rival          walk / back   hold toward / away (no press)
//   wait            do nothing
// `start` = how far apart the two fighters stand at the start (px between their middles).
// `how` (optional) = the inputs shown in the list; otherwise made from the script (wait steps left out).
// Every combo here was checked by playing its script on the practice dummy (2026-11-23); hits / damage measured then.
const COMBOS = {
  kade: [
    // (names = every move in the combo, in order, Rick 2026-11-23)
    {name: 'Jab → Cross → Fiery Rush', start: 90, script: 'P:8 P:6 df+K:60',      // 3 hits, 20
     note: 'Type Fiery Rush while the cross hits. About 20 damage.'},
    {name: 'Updraft → step in → Alley Spin → Blaze Wheel', start: 90, script: 'P:8 K:10 P:28 walk:14 P:8 P:8 K:8 bf+K:50',      // 9 hits, 33
     note: 'Updraft launches. Step in under them, Alley Spin, and cancel its last hit into Blaze Wheel. About 33 damage.'},
    {name: 'Updraft → step in → Jab → Flaming Flurry', start: 90, script: 'P:8 K:10 P:28 walk:14 P:6 bf+P:60',      // 8 hits, 24
     note: 'Less damage than Blaze Wheel, but the Flurry carries them far toward the corner. About 24 damage.'},
  ],
  // Static Orb (Rick asked what it's for): it turns hits that don't launch into a launch
  vex: [
    // (longer version, Rick 2026-11-23; was dash -> Thunderhead only, 5 hits / 29. Sky Bolt timing is tight:
    // a bit late or early still gives 7 hits / 32)
    {name: 'Static Orb → Smite → dash → Static Burst → step in → Sky Bolt → Thunderhead', start: 130, script: 'db+K:40 df+P:58 dash:3 wait:6 P:8 P:8 P:6 walk:8 df+K:40 wait:10 P:8 P:8 K:50',      // 8 hits, 34
     note: 'Smite from where you stand knocks them into the orb, which launches them. Dash in a moment after it pops. About 34 damage.'},
    {name: 'Static Orb → step in → Static Burst → dash → Sky Bolt → Thunderhead', start: 150, script: 'db+K:40 walk:40 P:8 P:8 P:10 dash:3 wait:3 df+K:40 wait:10 P:8 P:8 K:50',      // 8 hits, 28
     note: 'With the orb on them, the first jab of Static Burst pops it and launches them. About 28 damage.'},
    // (Orb + sweep 21 and Orb + Shockwave 15 also work; left out on purpose, Rick 2026-11-23: a few suggestions,
    // the rest is for players to figure out)
  ],
  rook: [
    {name: 'Eruption → step in → Landslide', start: 90, script: 'K:10 P:8 P:30 walk:14 P:8 P:8 P:50',      // 6 hits, 39
     note: 'Eruption launches. Step in and catch them with Landslide on the way down. About 39 damage.'},
  ],
  juno: [
    {name: 'Waterspout → step in → Waterspout', start: 90, script: 'K:10 P:8 K:22 walk:14 K:8 P:8 K:50',      // 6 hits, 29
     note: 'Waterspout launches. Step in and do it again as they come down. About 29 damage.'},
  ],
};

// ----- reading a script -----
const DIR_KEY = {d: 'down', u: 'up', f: 'F', b: 'B'};
const BTN_OF = {P: 'punch', K: 'kick'};
// script text -> input steps like the computer's ({h: held, p: press, d: frames}; 'F' / 'B' = toward / away)
function comboSteps(script) {
  const steps = [];
  for (const tok of script.trim().split(/\s+/)) {
    const [what, n] = tok.split(':'), d = +n || 8;
    if (what === 'wait') steps.push({d});
    else if (what === 'walk') steps.push({h: {F: true}, d});
    else if (what === 'back') steps.push({h: {B: true}, d});
    else if (what === 'dash') steps.push({p: 'F', d: 3}, {p: 'F', d});
    else {
      const [dirs, btns] = what.includes('+') ? what.split('+') : ['', what];
      const press = [...btns].map(c => BTN_OF[c]);
      const keysOf = s => Object.fromEntries([...s].map(c => [DIR_KEY[c], true]));
      // a motion: every direction but the last held 3 frames, then the last one with the button
      for (const c of dirs.slice(0, -1)) steps.push({h: keysOf(c), d: 3});
      steps.push({h: keysOf(dirs.slice(-1)), p: press, d});
    }
  }
  return steps;
}
// the inputs to show for a combo, as HTML (your own keys); K(b) = a <kbd> for button b
function comboHow(c, K) {
  if (c.how) return c.how;
  const ARR = {d: '↓', u: '↑', f: '→', b: '←'};
  const out = [];
  for (const tok of c.script.trim().split(/\s+/)) {
    const what = tok.split(':')[0];
    if (what === 'wait') continue;
    if (what === 'walk') out.push('<b>→</b>');
    else if (what === 'back') out.push('<b>←</b>');
    else if (what === 'dash') out.push('<b>→ →</b>');
    else {
      const [dirs, btns] = what.includes('+') ? what.split('+') : ['', what];
      const keys = [...btns].map(ch => K(BTN_OF[ch])).join(' + ');
      out.push(dirs ? '<b>' + [...dirs].map(ch => ARR[ch]).join(' ') + '</b> + ' + keys : keys);
    }
  }
  return out.join(' <i>,</i> ');
}

// ----- playing a demonstration -----
const DEMO = {combo: null, q: [], on: false, end: 0, saved: null};
// set both fighters up for the combo and start playing it
function startDemo(c) {
  const [me, dummy] = G.fighters;
  G.fighters.forEach(resetFighter);
  me.x = 300; dummy.x = me.x + c.start; me.face = 1; dummy.face = -1;
  G.projectiles = []; G.parts = [];
  G.phase = 'fight'; G.hitstop = 0; G.slow = 0; G.shake = 0;
  setMsg('');
  practiceReset();
  if (!DEMO.saved) DEMO.saved = {stance: PRAC.stance, block: PRAC.block};      // the dummy stands still during it
  PRAC.stance = 'stand'; PRAC.block = false; updateDummyPanel();
  DEMO.combo = c; DEMO.q = comboSteps(c.script); DEMO.on = true; DEMO.end = 0;
  comboPanel();
  show('game');
}
// the demo's "keys" for your fighter this frame (from step, instead of the keyboard)
function demoInput(me, foe) {
  const F = foe.x > me.x ? 'right' : 'left', B = F === 'right' ? 'left' : 'right';
  const dir = k => k === 'F' ? F : k === 'B' ? B : k;
  const s = DEMO.q[0];
  if (!s) {      // script done: hand control back once both fighters have settled
    if (++DEMO.end > 50 || (ACTIONABLE.has(me.state) && ACTIONABLE.has(foe.state) && foe.onGround && DEMO.end > 20)) stopDemo();
    return {held: {}, press: []};
  }
  const held = {};
  for (const k in s.h || {}) held[dir(k)] = s.h[k];
  const out = {held, press: []};
  if (!s.started) { s.started = true; if (s.p) out.press.push(...[].concat(s.p).map(dir)); }
  if (--s.d <= 0) DEMO.q.shift();
  return out;
}
function stopDemo() {
  DEMO.on = false; DEMO.q = [];
  if (DEMO.saved) { PRAC.stance = DEMO.saved.stance; PRAC.block = DEMO.saved.block; DEMO.saved = null; updateDummyPanel(); }
  comboPanel();
}
// leaving practice / restarting: drop the demo and its panel
function clearDemo() { if (DEMO.on) stopDemo(); DEMO.combo = null; comboPanel(); }
const demoActive = () => G.mode === 'practice' && DEMO.on;

// the panel at the top while watching / trying a combo
function comboPanel() {
  const el = $('comboPanel'), c = DEMO.combo;
  document.body.classList.toggle('combo', !!c);
  if (!c) { el.innerHTML = ''; return; }
  const K = b => '<kbd>' + keyName(KEYMAP[0][b][0]) + '</kbd>';
  el.innerHTML = '<div class="tstep">' + (DEMO.on ? 'Watch' : 'Your turn') + '</div><h3>' + c.name + '</h3>' +
    '<p class="how">' + comboHow(c, K) + '</p><p>' + c.note + '</p>' +
    '<div class="tbtns"><button data-combo="again">Watch again</button><button data-combo="list">All combos</button>' +
    '<button data-combo="close">Close</button></div>';
}
$('comboPanel').addEventListener('click', e => {
  const b = e.target.closest('[data-combo]');
  if (!b) return;
  SFX_RAW.select();
  b.blur();      // so game keys aren't caught by the button
  const a = b.dataset.combo;
  if (a === 'again' && DEMO.combo) startDemo(DEMO.combo);
  else if (a === 'list') openCombos();
  else if (a === 'close') clearDemo();
});

// ----- the combo list screen (s-combos) -----
function openCombos() {
  if (G.mode !== 'practice' || !G.fighters) return;
  if (DEMO.on) stopDemo();
  show('combos');
}
function buildCombos() {
  const d = G.fighters[0].def, list = COMBOS[d.id] || [];
  const K = b => '<kbd>' + keyName(KEYMAP[0][b][0]) + '</kbd>';
  $('combosTitle').textContent = d.name + ' combos';
  const box = $('combolist');
  box.innerHTML = list.length ? '' : '<p>None yet.</p>';
  list.forEach((c, i) => {
    const row = document.createElement('div'); row.className = 'crow';
    row.innerHTML = '<div><b>' + c.name + '</b><span class="how">' + comboHow(c, K) + '</span><small>' + c.note + '</small></div>';
    const btn = document.createElement('button'); btn.className = 'btn small'; btn.textContent = 'Watch';
    btn.onclick = () => { SFX_RAW.select(); startDemo(list[i]); };
    row.appendChild(btn);
    box.appendChild(row);
  });
}
