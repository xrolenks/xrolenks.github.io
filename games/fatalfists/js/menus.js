'use strict';
// Fatal Fists - menu screens, fighter select, buttons, keys, touch
// ===== Screens =====
const SCREENS = ['title', 'level', 'select', 'moves', 'controls', 'online', 'pause', 'end', 'combos'];
function show(name) {
  G.screen = name === 'pause' ? 'game' : name;
  G.paused = name === 'pause';
  for (const s of SCREENS) $('s-' + s).classList.toggle('on', s === name);
  document.body.classList.toggle('practice', G.mode === 'practice');      // shows the on-screen dummy buttons (practice.js)
  document.body.classList.toggle('tutorial', G.mode === 'tutorial');      // shows the tutorial panel (tutorial.js)
  document.body.classList.toggle('playing', name === 'game');
  for (const k in keys) keys[k] = false;
  if (name === 'select') buildSelect();
  if (name === 'moves') buildMoves();
  if (name === 'controls') buildControls();
  if (name === 'combos') buildCombos();
  if (name === 'pause') $('pauseCombos').hidden = G.mode !== 'practice';      // combo list: practice only
  if (name === 'title') clearDemo();
  // difficulty cards: mark (and start on) the level used last
  if (name === 'level') document.querySelectorAll('#s-level [data-level]').forEach(b => b.classList.toggle('cur', +b.dataset.level === G.level));
  const first = name !== 'game' && ($('s-' + name).querySelector('.mode.cur') || $('s-' + name).querySelector('button'));
  if (first && !document.body.classList.contains('touch')) first.focus();
}
function showEnd() {
  G.phase = 'over';
  const w = G.wins[0] >= 2 ? 0 : 1, l = 1 - w;
  const wf = G.fighters[w], lf = G.fighters[l];
  if (G.mode === '1p') $('endTitle').textContent = w === 0 ? 'You win!' : 'You lose';
  else if (G.mode === 'online') $('endTitle').textContent = w === NET.side ? 'You win!' : 'You lose';
  else $('endTitle').textContent = 'Player ' + (w + 1) + ' wins!';
  $('endSub').textContent = wf.def.name + ' beat ' + lf.def.name + ', ' + G.wins[w] + '–' + G.wins[l] + ' in rounds.';
  show('end');
}
function togglePause() {
  if (G.screen !== 'game' || !G.fighters || G.phase === 'over') return;
  if (NET.role === 'guest') return netSend({t: 'pause', v: !G.paused});      // the host pauses for both
  show(G.paused ? 'game' : 'pause');
}

// character select
const roster = $('roster');
// speed / power bars on the fighter cards: hidden for now (Rick 2026-11-22); set true to bring them back
const SHOW_STATS = false;
function buildSelect() {
  roster.innerHTML = '';
  FIGHTERS.forEach((d, i) => {
    const b = document.createElement('button');
    b.className = 'fcard'; b.style.setProperty('--c', d.shirt);
    b.innerHTML = '<canvas width="220" height="280"></canvas><b>' + d.name + '</b><small>' + d.title + '<br>' + d.desc + '</small>' +
      (SHOW_STATS ? '<div class="stat"><span>Speed</span><i><em style="width:' + Math.round(d.speed / 4.2 * 100) + '%"></em></i></div>' +
      '<div class="stat"><span>Power</span><i><em style="width:' + Math.round(d.power / 1.25 * 100) + '%"></em></i></div>' : '');
    const pc = b.querySelector('canvas').getContext('2d');
    pc.setTransform(2, 0, 0, 2, 0, 0);
    drawFighter(pc, d, P.idle, 52, 136, 1, 0.74, false);      // (0.82 -> 0.74: Kade's tall hair fits, Rick 2026-11-22)
    b.onclick = () => pick(i);
    b.onmouseenter = () => { G.cursor = i; markSelect(); };
    roster.appendChild(b);
  });
  markSelect();
}
function markSelect() {
  [...roster.children].forEach((b, i) => {
    b.classList.toggle('cur', i === G.cursor);
    const old = b.querySelector('.badge'); if (old) old.remove();
    if ((G.mode === '2p' || G.mode === 'practice') && G.picker === 1 && i === G.picks[0]) {
      const s = document.createElement('span'); s.className = 'badge'; s.textContent = G.mode === 'practice' ? 'YOU' : 'P1'; b.appendChild(s);
    }
  });
  if (G.mode === 'online') {
    const mine = NET.picked[NET.side], theirs = NET.picked[1 - NET.side];
    $('pickWho').textContent = mine ? 'Waiting for your friend to pick…' : theirs ? 'Your friend has picked. Your turn!' : 'Pick your fighter';
  } else if (G.mode === 'practice') $('pickWho').textContent = G.picker === 0 ? 'Practice: pick your fighter' : 'Pick the test dummy';
  else $('pickWho').textContent = G.mode === '1p' ? 'Pick your fighter' : (G.picker === 0 ? 'Player 1, pick a fighter' : 'Player 2, pick a fighter');
  $('selHint').textContent = document.body.classList.contains('touch') ? 'Tap a fighter.' :
    (G.picker === 0 || G.mode === 'practice' ? 'A / D to choose, J or Enter to pick.' : '← / → to choose, Numpad 1 or Enter to pick.');
}
function pick(i) {
  if (G.mode === 'online') {
    if (NET.picked[NET.side]) return;
    SFX_RAW.select();
    G.picks[NET.side] = i; G.cursor = i;
    NET.picked[NET.side] = true;
    netSend({t: 'pick', i});
    markSelect();
    netTryStart();
    return;
  }
  SFX.select();
  G.picks[G.picker] = i;
  if (G.mode === '1p') {
    let o; do { o = rnd(FIGHTERS.length); } while (o === i);
    G.picks[1] = o;
    startMatch();
  } else if (G.picker === 0) {
    G.picker = 1; markSelect();
  } else startMatch();
}

// move list (from the title menu or the pause menu)
let movesFrom = 'title', movesFighter = 0, movesPlayer = 0;      // movesPlayer = whose keys the list shows
const ARROW = {down: '↓', up: '↑', fwd: '→', back: '←'};
function openMoves() {
  movesFrom = G.screen === 'game' && G.paused ? 'pause' : 'title';
  if (movesFrom === 'pause') movesFighter = G.picks[G.mode === 'online' ? NET.side : 0];      // start on your own fighter
  if (G.mode !== '2p') movesPlayer = 0;      // 1 player and online use Player 1's keys
  show('moves');
  // show() focuses the first button, now the top Back button; start on the fighter tabs instead, as before
  if (!document.body.classList.contains('touch')) $('mtabs').querySelector('.cur').focus();
}
function buildMoves() {
  const tabs = $('mtabs');
  tabs.innerHTML = '';
  FIGHTERS.forEach((d, i) => {
    const b = document.createElement('button');
    b.textContent = d.name; b.style.setProperty('--c', d.shirt);
    b.classList.toggle('cur', i === movesFighter);
    b.onclick = () => { movesFighter = i; SFX_RAW.move(); buildMoves(); $('mtabs').children[i].focus(); };
    tabs.appendChild(b);
  });
  // Player 1 / Player 2 keys switch
  const ptabs = $('mplayer');
  ptabs.innerHTML = '';
  [0, 1].forEach(p => {
    const b = document.createElement('button');
    b.textContent = 'Player ' + (p + 1) + ' keys'; b.style.setProperty('--c', '#ffcf5a');
    b.classList.toggle('cur', p === movesPlayer);
    b.onclick = () => { movesPlayer = p; SFX_RAW.move(); buildMoves(); $('mplayer').children[p].focus(); };
    ptabs.appendChild(b);
  });
  const K = b => '<kbd>' + keyName(KEYMAP[movesPlayer][b][0]) + '</kbd>';      // the key this player uses for b
  const d = FIGHTERS[movesFighter], sp = d.special;
  const keysOf = btns => btns.map(b => b === 'fwdKick' ? '<b>→</b>+' + K('kick') : K(b)).join(' ');      // fwdKick = toward + kick
  const row = (name, how, note) => '<p class="mv"><b>' + name + '</b><span>' + how + '</span>' + (note ? '<small>' + note + '</small>' : '') + '</p>';
  const seqHow = s => s.dirs.map(x => '<b>' + ARROW[x] + '</b>').join(' ') + ' + ' + K(s.btn);
  const spHow = seqHow(sp.seq);
  $('movesKeyHint').innerHTML = '<b>→</b> means toward your rival, <b>←</b> away. ' + K('punch') + ' punch, ' + K('kick') + ' kick.';
  const lvTag = l => ' <em class="lv ' + l + '">' + l + '</em>';
  const lv = m => lvTag(levelOf(MOVES[m]));      // high / mid / low tag
  const spLv = lvTag(sp.level || levelOf(MOVES.special));      // a special can have its own level (Vex's Smite: overhead)
  const strs = (STRINGS[d.id] || []).map(s => row(s.name, keysOf(s.btns), s.moves.map(m => (MOVE_NAMES[m] || m) + lv(m)).join(' → '))).join('');
  $('movelist').innerHTML =
    // (descriptions condensed, Rick 2026-11-22)
    // heading was "Name – title"; the tab already shows the name (Rick 2026-11-23)
    '<div class="wide"><h3>Special moves</h3>' + row(sp.name, spHow, (sp.desc || 'Energy blast, short recharge') + spLv) +
    (d.extras || []).map(x => row(x.name, seqHow(x.seq), x.desc + lv(x.move))).join('') +
    (d.fwdPunch ? row(MOVE_NAMES[d.fwdPunch], '<b>→</b> + ' + K('punch'), 'Long poke. Open if it misses' + lv(d.fwdPunch)) : '') +
    (d.fwdKick ? row(MOVE_NAMES[d.fwdKick], '<b>→</b> + ' + K('kick'), 'Slower, longer poke. Starts a string' + lv(d.fwdKick)) : '') +
    (d.backCharge ? row(MOVE_NAMES[d.backCharge], '<b>←</b> + hold ' + K('punch') + ', let go', 'Hold for more damage. Open while charging' + lv(d.backCharge)) : '') + '</div>' +
    '<div><h3>Combo strings</h3>' + (strs || '<p>None yet</p>') +
    '<p class="hint">Each hit must land or be blocked to continue. <i>Launches</i> = juggle them in the air. Launching again only works in the corner, or by dashing in and catching them just before they land. Any hit can cancel into a special.</p></div>' +
    '<div><h3>Everyone</h3>' +
    row('Jab', K('punch'), lv('punch')) + row('Front kick', K('kick'), lv('kick')) +
    row('Uppercut', '<b>↓</b> + ' + K('punch'), 'Knocks down' + lv('uppercut')) + row('Leg sweep', '<b>↓</b> + ' + K('kick'), 'Knocks down' + lv('sweep')) +
    row('Throw', K('punch') + ' + ' + K('kick'), 'Beats blocks. Hold <b>←</b> to throw behind. Break: ' + K('punch') + ' + ' + K('kick') + lv('throw')) + row('Air punch', 'Jump + ' + K('punch'), 'Lands into a ' + K('punch') + ' string' + lv('airPunch')) +
    row('Air kick', 'Jump + ' + K('kick'), 'Long reach' + lv('airKick')) +
    row('Dash', '<b>→ →</b> or <b>← ←</b>', 'Attack during it to dash in') + row('Block', 'Hold ' + K('block')) +
    '<p class="hint"><em class="lv high">high</em> stand-block or duck · <em class="lv mid">mid</em> block either way · <em class="lv low">low</em> crouch-block only · <em class="lv overhead">overhead</em> stand-block only</p></div>';
}

// controls: change each player's keys (saved in settings.keymap)
let ctrlFrom = 'title', binding = null;      // binding = {p, b} while waiting for a key press
const ACT_NAMES = {up: 'Jump', down: 'Crouch', left: 'Left', right: 'Right', punch: 'Punch', kick: 'Kick', block: 'Block'};
function openControls() {
  ctrlFrom = G.screen === 'game' && G.paused ? 'pause' : 'title';
  binding = null;
  show('controls');
}
function buildControls() {
  const list = $('bindList');
  list.innerHTML = '';
  [0, 1].forEach(p => {
    const box = document.createElement('div');
    box.innerHTML = '<h3>Player ' + (p + 1) + '</h3>';
    for (const b of REBINDABLE) {
      const row = document.createElement('div'); row.className = 'bind';
      const spare = KEYMAP[p][b].slice(1).map(keyName).join(', ');
      row.innerHTML = '<span>' + ACT_NAMES[b] + (spare ? ' <small class="hint">(also ' + spare + ')</small>' : '') + '</span>';
      const btn = document.createElement('button');
      const waiting = binding && binding.p === p && binding.b === b;
      btn.textContent = waiting ? 'Press a key…' : keyName(KEYMAP[p][b][0]);
      btn.classList.toggle('wait', !!waiting);
      btn.dataset.bind = p + '.' + b;
      btn.onclick = () => { binding = {p, b}; SFX_RAW.select(); buildControls(); $('bindHint').textContent = 'Press a key for Player ' + (p + 1) + ' ' + ACT_NAMES[b].toLowerCase() + ' (Esc to cancel).'; };
      row.appendChild(btn);
      box.appendChild(row);
    }
    list.appendChild(box);
  });
  if (!binding) $('bindHint').textContent = 'Click a key box, then press the key you want to use.';
}
function bindPress(e) {      // a key was pressed while waiting to bind it
  e.preventDefault();
  const {p, b} = binding;
  if (e.code === 'Escape') binding = null;
  else if (NO_BIND.has(e.code)) { $('bindHint').textContent = 'That key is for pausing and menus. Pick another one.'; return; }
  else { bindKey(p, b, e.code); binding = null; SFX_RAW.select(); }
  buildControls();
  const btn = document.querySelector('[data-bind="' + p + '.' + b + '"]');
  if (btn) btn.focus();
}
$('resetKeys').onclick = () => { resetKeys(); binding = null; buildControls(); };

// buttons
document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  const lv = e.target.closest('[data-level]');
  if (lv) { G.level = settings.level = +lv.dataset.level; saveSettings(); SFX.select(); G.picker = 0; show('select'); return; }
  if (!go) return;
  SFX_RAW.select();
  const g = go.dataset.go;
  if (g === 'moves') return openMoves();
  if (g === 'moves-back') return show(movesFrom);
  if (g === 'controls') return openControls();
  if (g === 'controls-back') { binding = null; return show(ctrlFrom); }
  if (g === 'combos') { go.blur(); return openCombos(); }      // practice combo list (combos.js)
  if (g === 'combos-back') return show('game');
  if (G.mode === 'online' && NET.role) {      // online: some buttons act for both players
    if (g === 'resume') return NET.role === 'guest' ? netSend({t: 'pause', v: false}) : show('game');
    if (g === 'restart') return NET.role === 'guest' ? netSend({t: 'rematch'}) : netStart();
    if (g === 'select') { netSend({t: 'select'}); return netToSelect(); }
    if (g === 'back-select' || g === 'title') { netLeave(); G.fighters = null; return show('title'); }
  }
  if (g === 'online') { netMsg(''); show('online'); }
  else if (g === 'leave') { closeNet(); show('title'); }
  else if (g === '1p') { G.mode = '1p'; show('level'); }
  else if (g === '2p') { G.mode = '2p'; G.picker = 0; show('select'); }
  else if (g === 'practice') { G.mode = 'practice'; G.picker = 0; show('select'); }
  else if (g === 'back-select') { if ((G.mode === '2p' || G.mode === 'practice') && G.picker === 1) { G.picker = 0; markSelect(); } else show(G.mode === '1p' ? 'level' : 'title'); }
  else if (g === 'select') { G.picker = 0; show('select'); }
  else if (g === 'resume') show('game');
  else if (g === 'restart') startMatch();
  else if (g === 'title') { G.fighters = null; show('title'); }
  else if (g === 'help') startTutorial();      // "How to play" = the playable tutorial (tutorial.js)
});
function updateMute() { $('muteBtn').textContent = 'Sound: ' + (settings.muted ? 'off' : 'on'); }
$('muteBtn').onclick = () => { settings.muted = !settings.muted; saveSettings(); updateMute(); SFX.select(); };
updateMute();
$('pauseBtn').onclick = () => togglePause();

// keyboard
const GAMEKEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Quote', 'Slash']);
addEventListener('keydown', e => {
  ac();
  if (G.screen === 'controls' && binding) return bindPress(e);
  if (G.screen === 'controls' && e.code === 'Escape') { e.preventDefault(); return show(ctrlFrom); }
  if (!e.repeat) tapped.add(e.code);
  keys[e.code] = true;
  if (G.screen === 'game') {
    if (GAMEKEYS.has(e.code) || isGameKey(e.code)) e.preventDefault();
    // return straight away, or menuKeys below would see the same Escape on the pause screen and close it again
    if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); togglePause(); return; }
    if (G.paused) menuKeys(e);
    return;
  }
  if (G.screen === 'select') {
    const n = FIGHTERS.length;
    if (['KeyA', 'ArrowLeft', 'KeyW', 'ArrowUp'].includes(e.code)) { G.cursor = (G.cursor + n - 1) % n; markSelect(); SFX.move(); e.preventDefault(); }
    else if (['KeyD', 'ArrowRight', 'KeyS', 'ArrowDown'].includes(e.code)) { G.cursor = (G.cursor + 1) % n; markSelect(); SFX.move(); e.preventDefault(); }
    else if (['KeyJ', 'KeyF', 'Enter', 'Space', 'Numpad1', 'Comma'].includes(e.code)) { e.preventDefault(); pick(G.cursor); }
    else if (e.code === 'Escape') document.querySelector('[data-go="back-select"]').click();
    return;
  }
  if (G.screen === 'moves') {
    const n = FIGHTERS.length, dir = ['KeyA', 'ArrowLeft'].includes(e.code) ? -1 : ['KeyD', 'ArrowRight'].includes(e.code) ? 1 : 0;
    if (dir) { e.preventDefault(); $('mtabs').children[(movesFighter + dir + n) % n].click(); return; }
    if (e.code === 'Escape') { e.preventDefault(); return show(movesFrom); }
  }
  if (G.screen === 'combos' && e.code === 'Escape') { e.preventDefault(); return show('game'); }
  menuKeys(e);
});
function menuKeys(e) {
  if (e.target && e.target.tagName === 'INPUT') return;      // typing a room code
  const scr = document.querySelector('.screen.on');
  if (!scr) return;
  const btns = [...scr.querySelectorAll('button')].filter(b => !b.hidden);      // skip hidden ones (dummy button outside practice)
  const i = btns.indexOf(document.activeElement);
  // (left / right too, since menus have buttons side by side now)
  if (['KeyS', 'ArrowDown', 'KeyD', 'ArrowRight'].includes(e.code)) { e.preventDefault(); btns[(i + 1) % btns.length].focus(); SFX.move(); }
  else if (['KeyW', 'ArrowUp', 'KeyA', 'ArrowLeft'].includes(e.code)) { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); SFX.move(); }
  else if (e.code === 'KeyJ' && i >= 0) { e.preventDefault(); btns[i].click(); }
  else if (e.code === 'Escape') {
    const back = scr.querySelector('[data-go="title"]');
    if (scr.id === 's-pause') show('game'); else if (back && scr.id !== 's-end') back.click();
  }
}
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.screen === 'game' && !G.paused && G.fighters && G.phase !== 'over') togglePause();
});

// touch
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
document.querySelectorAll('#touch [data-k]').forEach(btn => {
  let k = btn.dataset.k;
  const down = e => {
    e.preventDefault(); ac();
    if (btn.dataset.a) k = KEYMAP[0][btn.dataset.a][0];      // touch buttons follow Player 1's chosen keys
    if (btn.setPointerCapture) try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    if (!keys[k]) tapped.add(k);
    keys[k] = true; btn.classList.add('on');
  };
  const up = () => { keys[k] = false; btn.classList.remove('on'); };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('lostpointercapture', up);
  btn.addEventListener('contextmenu', e => e.preventDefault());
});
addEventListener('pointerdown', () => ac(), {once: true});

