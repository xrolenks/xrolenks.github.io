'use strict';
// Fatal Fists - practice mode (Rick 2026-11-21; replaces the 2 Players button for now).
// You (left) vs a test dummy (right) with unlimited health: it can't go below 1, and its bar refills once it's been
// left alone for a moment. No timer, no K.O. Top left: hits and total damage of your current / last combo.
// Bottom right: frame data of your last move (startup, active, recovery, and the measured advantage when it hit or
// was blocked), or Knockdown / Throw / Missed. Dummy settings (Rick 2026-11-21): on-screen buttons in the top right
// (#dummyPanel, only while playing practice): stance standing / crouching, blocking off / on.
const DUMMY_REFILL = 50;      // frames left alone before the dummy's health refills
const PRAC = {stance: 'stand', block: false, hits: 0, dmg: 0, blocked: false, fd: null, idleT: 0};
// (the tutorial, tutorial.js, works like practice: dummy, no clock, no K.O.)
const isPractice = () => G.mode === 'practice' || G.mode === 'tutorial';

function practiceReset() { PRAC.hits = 0; PRAC.dmg = 0; PRAC.blocked = false; PRAC.fd = null; PRAC.idleT = 0; }
// the dummy's "keys", from the chosen dummy mode
function dummyInput() {
  return {held: {block: PRAC.block, down: PRAC.stance === 'crouch'}, press: []};
}
// the on-screen dummy buttons: data-stance="stand|crouch", data-block="0|1"
function updateDummyPanel() {
  document.querySelectorAll('#dummyPanel [data-stance]').forEach(b => b.classList.toggle('cur', b.dataset.stance === PRAC.stance));
  document.querySelectorAll('#dummyPanel [data-block]').forEach(b => b.classList.toggle('cur', (b.dataset.block === '1') === PRAC.block));
}
document.querySelectorAll('#dummyPanel button').forEach(b => {
  b.addEventListener('click', () => {
    if (b.dataset.stance) PRAC.stance = b.dataset.stance;
    if (b.dataset.block) PRAC.block = b.dataset.block === '1';
    updateDummyPanel();
    SFX_RAW.select();
    b.blur();      // so game keys aren't caught by the button
  });
});
updateDummyPanel();
// take d health off a fighter; in practice the dummy never drops below 1 (so it never gets knocked out)
function lowerHp(def, d) {
  // (in the tutorial you can't be knocked out either)
  return Math.max(isPractice() && (def.side === 1 || G.mode === 'tutorial') ? 1 : 0, def.hp - d);
}

// ----- what the player does to the dummy -----
// a move started (startMove): new frame data card
function practiceMove(f, m) {
  if (!isPractice() || f.side !== 0) return;
  const M = MOVES[m];
  let name = MOVE_NAMES[m] || (m === 'special' ? f.def.special.name : m === 'punch' ? 'Jab' : m === 'kick' ? 'Front kick' : m);
  name = name.replace(/ \(.*\)$/, '');      // drop "(knocks down)" etc.
  PRAC.fd = {name, startup: M.startup, active: M.active, recovery: M.recovery, contact: null, hitT: null,
    adv: null, aFree: null, bFree: null, charge: m === f.def.backCharge ? f.charge : null};
}
// it touched the dummy: kind = 'hit', 'block' or 'throw'; d = damage done; M = the move (if known)
function practiceContact(att, kind, d, M) {
  tutContact(att, kind, M);      // tutorial tasks (tutorial.js)
  if (!isPractice() || att.side !== 0) return;
  if (kind === 'block') { PRAC.hits = 0; PRAC.dmg = d; PRAC.blocked = true; }
  else {
    if (att.combo <= 1 || PRAC.blocked) { PRAC.hits = 0; PRAC.dmg = 0; }
    PRAC.blocked = false;
    PRAC.hits = Math.max(1, att.combo); PRAC.dmg += d;
  }
  const fd = PRAC.fd;
  if (fd) { fd.contact = kind; fd.hitT = fd.hitT == null ? att.t : fd.hitT; fd.adv = null; fd.aFree = fd.bFree = null; }
}
// every frame (from step): refill the dummy, and measure frame advantage after a hit / block
function practiceTick() {
  if (!isPractice() || !G.fighters) return;
  const [me, dummy] = G.fighters;
  const free = f => f.onGround && ACTIONABLE.has(f.state);
  PRAC.idleT = free(dummy) && dummy.hp < 100 ? PRAC.idleT + 1 : 0;
  if (PRAC.idleT >= DUMMY_REFILL) { dummy.hp = dummy.trail = 100; PRAC.idleT = 0; }
  const fd = PRAC.fd;
  if (!fd || fd.adv !== null) return;
  if (!fd.contact) {      // never touched the dummy and the move is over: a miss
    if (me.state !== 'attack' && me.state !== 'charging' && me.state !== 'throwing') fd.adv = 'miss';
    return;
  }
  if (FLOORED.has(dummy.state) || dummy.state === 'juggle' || dummy.state === 'held') { fd.adv = fd.contact === 'throw' ? 'throw' : 'KD'; return; }
  if (fd.aFree === null && free(me)) fd.aFree = G.frame;
  if (fd.bFree === null && free(dummy)) fd.bFree = G.frame;
  if (fd.aFree !== null && fd.bFree !== null) fd.adv = fd.bFree - fd.aFree;      // + = you can act first
}

// ----- HUD -----
function drawPracticeHUD(c) {
  c.save();
  c.textBaseline = 'top';
  // top left: hits + damage of the current / last combo
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(36, 92, 220, 74);
  c.textAlign = 'left';
  c.font = '800 13px system-ui, sans-serif'; c.fillStyle = '#ffcf5a';
  c.fillText(PRAC.blocked ? 'BLOCKED' : 'COMBO', 46, 100);
  c.font = 'italic 900 30px system-ui, sans-serif'; c.fillStyle = '#fff';
  c.fillText(PRAC.blocked ? 'chip' : PRAC.hits + (PRAC.hits === 1 ? ' hit' : ' hits'), 46, 118);
  c.textAlign = 'right';
  c.font = '800 13px system-ui, sans-serif'; c.fillStyle = '#ffcf5a'; c.fillText('DAMAGE', 246, 100);
  c.font = 'italic 900 30px system-ui, sans-serif'; c.fillStyle = '#fff'; c.fillText(String(Math.round(PRAC.dmg)), 246, 118);
  // bottom right: frame data of the last move
  const fd = PRAC.fd;
  const x = W - 24, w = 300, y = H - 112;
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - w, y, w + 12, 100);
  c.textAlign = 'right';
  c.font = '800 13px system-ui, sans-serif'; c.fillStyle = '#ffcf5a';
  c.fillText('FRAME DATA', x, y + 8);
  if (!fd) {
    c.font = '700 14px system-ui, sans-serif'; c.fillStyle = '#ddd'; c.fillText('Do a move on the dummy', x, y + 34);
  } else {
    c.font = 'italic 900 20px system-ui, sans-serif'; c.fillStyle = '#fff';
    c.fillText(fd.name + (fd.charge != null ? ' (' + Math.round(fd.charge * 100) + '% charge)' : ''), x, y + 26);
    c.font = '700 14px system-ui, sans-serif'; c.fillStyle = '#ddd';
    c.fillText('Startup ' + fd.startup + '   Active ' + fd.active + '   Recovery ' + fd.recovery, x, y + 54);
    let res = '…', col = '#ddd';
    if (fd.adv === 'miss') { res = 'Missed'; col = '#aaa'; }
    else if (fd.adv === 'KD') res = 'Knockdown on ' + fd.contact;
    else if (fd.adv === 'throw') res = 'Throw';
    else if (fd.adv !== null) {
      res = (fd.contact === 'block' ? 'On block ' : 'On hit ') + (fd.adv > 0 ? '+' : '') + fd.adv;
      col = fd.adv > 0 ? '#7dff8a' : fd.adv < 0 ? '#ff8f7a' : '#fff';
    } else if (fd.contact) res = (fd.contact === 'block' ? 'Blocked' : 'Hit') + '…';
    c.font = '900 16px system-ui, sans-serif'; c.fillStyle = col;
    c.fillText(res + (fd.hitT != null ? '   (touched on frame ' + fd.hitT + ')' : ''), x, y + 76);
  }
  c.restore();
}
