'use strict';
// Fatal Fists - game state, fighter moves, hits, blasts
// ===== Game state =====
const G = {
  screen: 'title', mode: '1p', level: settings.level, picks: [0, 1], picker: 0, cursor: 0,
  fighters: null, wins: [0, 0], round: 1, phase: 'none', pt: 0, timer: 60, tick: 0,
  paused: false, hitstop: 0, shake: 0, slow: 0, msg: '', sub: '', msgT: 0, winner: -1,
  projectiles: [], parts: [], embers: [], frame: 0,
};
// online play: role 'host' (runs the fight, is the left fighter) or 'guest' (right fighter), or null
let NET = {role: null, rheld: {}, rpress: []};

function makeFighter(def, side) {
  return {def, side, x: 0, y: GROUND, vx: 0, vy: 0, face: 1, hp: 100, trail: 100, state: 'idle', t: 0,
    move: null, moveHit: false, onGround: true, airAttacked: false, cd: 0, stun: 0, flash: 0,
    combo: 0, comboShow: 0, walkPhase: 0, blockLow: false, buf: {}, held: {}, dirs: [], ai: {q: []}};
}
function resetFighter(f) {
  Object.assign(f, {x: f.side ? 660 : 300, y: GROUND, vx: 0, vy: 0, face: f.side ? -1 : 1, hp: 100, trail: 100,
    state: 'idle', t: 0, move: null, moveHit: false, onGround: true, airAttacked: false, cd: 0, stun: 0, flash: 0,
    combo: 0, comboShow: 0, buf: {}, held: {}, dirs: [], ai: {q: []}});
}

function startMatch() {
  G.fighters = [makeFighter(FIGHTERS[G.picks[0]], 0), makeFighter(FIGHTERS[G.picks[1]], 1)];
  G.wins = [0, 0];
  G.round = 1;
  practiceReset();
  clearDemo();      // practice: no combo demonstration left over (combos.js)
  startRound();
  tutReset();      // tutorial: set up its current step (skips the ROUND 1 intro)
  show('game');
}
function startRound() {
  G.fighters.forEach(resetFighter);
  G.projectiles = []; G.parts = [];
  G.phase = 'intro'; G.pt = 0; G.timer = 60; G.tick = 0;
  G.hitstop = 0; G.slow = 0; G.shake = 0; G.winner = -1;
  setMsg('');
}
function setMsg(t, sub = '') { G.msg = t; G.sub = sub; G.msgT = 0; }

function endRound(timeout) {
  const [a, b] = G.fighters;
  G.phase = 'ko'; G.pt = 0;
  let w = -1;
  if (a.hp > b.hp) w = 0; else if (b.hp > a.hp) w = 1;
  G.winner = w;
  if (w >= 0) G.wins[w]++;
  if (timeout) setMsg('TIME');
  else { setMsg('K.O.'); G.slow = 50; SFX.ko(); }
}

// ===== Fighter logic =====
const ACTIONABLE = new Set(['idle', 'walk', 'crouch', 'block', 'cblock']);
const FLOORED = new Set(['knockdown', 'ko', 'down']);
const clampF = k => Math.max(0, Math.min(1, k));
const JUGGLE_MAX = 5;      // 'juggle' = launched into the air and still hittable (see applyHit)
// Combo damage scaling: the first COMBO_FULL hits of a combo do full damage, then each later hit does
// COMBO_STEP less, never below COMBO_MIN (juggle hits count as part of the same combo).
// Stronger since 2026-11-22 (Rick: "less damage the more hits"): step 0.1 -> 0.15, floor 0.5 -> 0.3.
const COMBO_FULL = 2, COMBO_STEP = 0.15, COMBO_MIN = 0.3;
// Relaunching (a launcher hitting someone already juggled) only works this close to a wall (walls at 36 / W - 36)
const CORNER_RANGE = 140;
const inCorner = f => f.x < 36 + CORNER_RANGE || f.x > W - 36 - CORNER_RANGE;
// Mid-screen it takes a dash-in string whose first hit catches them this low (px above the floor; they fall ~10 px a
// frame there, so about a 3-4 frame window). Rick 2026-11-22: "precise timing, dash forward after the launch".
const RELAUNCH_LOW = 36;
const comboScale = n => Math.max(COMBO_MIN, 1 - COMBO_STEP * Math.max(0, n - COMBO_FULL));
function setState(f, s) {
  if (s !== 'jump') f.flip = 0;      // an air attack or a hit ends the jump's flip (the rest of the jump is just the tuck)
  f.state = s; f.t = 0; if (s !== 'attack') f.move = null;
}
function keep(f, s) { if (f.state !== s) setState(f, s); }
function want(f, b) { if (f.buf[b] > 0) { f.buf[b] = 0; return true; } return false; }
function canThrow(f) { return f.onGround && (ACTIONABLE.has(f.state) || f.state === 'attack' || f.state === 'charging'); }

function startMove(f, m, chain = null) {
  const fromDash = f.state === 'dashf';
  setState(f, 'attack');
  f.move = m; f.moveHit = false; f.pendSpecial = null;
  f.blockedExtra = 0;      // extra recovery frames if this move gets blocked (BLOCK_PUNISH)
  f.moveBlocked = false;   // this move was blocked (a special cancelled out of it gets a slower start, see control)
  f.hold = 0;              // frames the start of this move is held back (updateFighter doesn't count f.t meanwhile)
  f.hitN = 0; f.lastHitT = 0;      // multi-hit moves: hits so far, and when the last one was
  practiceMove(f, m);      // practice mode: frame data card for this move
  f.chain = chain;      // buttons pressed so far in a combo string (only set for plain punch/kick and string moves)
  // a new move that isn't the next hit of a string: note whether it came out of a forward dash (mid-screen relaunch,
  // see applyHit), and forget any relaunch earned by the last string
  if (!(chain && chain.length > 1)) { f.dashString = fromDash; f.relaunchOK = false; }
  if (f.onGround) f.vx = 0;
  if (!MOVES[m].projectile) SFX.whoosh();
}

// ===== Special move sequences (directions, then punch or kick) =====
// Each frame we note which way the stick points, *relative to the rival*: up, down, fwd (toward them), back.
// A diagonal counts as both (down + fwd). f.dirs keeps the last few changes as {up, down, fwd, back, t}.
function recordDirs(f, foe) {
  const h = f.held, toward = foe.x >= f.x ? 'right' : 'left', away = toward === 'right' ? 'left' : 'right';
  const d = {up: !!h.up, down: !!h.down, fwd: !!h[toward], back: !!h[away]};
  const last = f.dirs[f.dirs.length - 1];
  if (last && last.up === d.up && last.down === d.down && last.fwd === d.fwd && last.back === d.back) return;
  d.t = G.frame;
  f.dirs.push(d);
  if (f.dirs.length > 12) f.dirs.shift();
}
// Did the fighter just point these directions, in this order, within SEQ_WINDOW frames?
// seq = e.g. ['down', 'fwd']. Each step must be a separate change of direction (a diagonal in between is fine).
// Returns when the motion started (the frame of its first direction; the latest match is used), or -1 if it wasn't done.
function seqStart(f, seq) {
  if (!f.dirs.length) return -1;      // just used up by another special this frame (was a crash, fixed 2026-11-22)
  const from = G.frame - SEQ_WINDOW;
  let start = f.dirs.length - 1;
  while (start > 0 && f.dirs[start].t > from) start--;      // include the direction that was held when the window began
  let k = seq.length - 1;
  for (let i = f.dirs.length - 1; i >= start && k >= 0; i--) if (f.dirs[i][seq[k]] && --k < 0) return f.dirs[i].t;
  return -1;
}
function seqDone(f, seq) { return seqStart(f, seq) >= 0; }
// Punch or kick was pressed: if it finishes one of this fighter's special sequences, do that special.
// When two motions both fit (e.g. down, back, forward), the one started most recently wins.
// Which special (if any) does pressing btn now finish? Returns the move name or null.
function pickSpecial(f, btn) {
  const opts = [];
  const s = f.def.special.seq;
  // (one of each on screen: a Ground Pulse travelling doesn't stop Vex casting Smite, and the other way round)
  if (s && s.btn === btn && f.cd <= 0 && !G.projectiles.some(p => p.owner === f && p.s === f.def.special)) opts.push({move: 'special', t: seqStart(f, s.dirs)});
  for (const x of f.def.extras || []) {
    if (x.seq.btn !== btn) continue;
    if (MOVES[x.move].pulse && G.projectiles.some(p => p.owner === f && p.s.type === 'pulse')) continue;
    opts.push({move: x.move, t: seqStart(f, x.seq.dirs)});
  }
  // the button has to come after the motion started: a punch pressed before it (e.g. the 2nd J of J, J, down,
  // forward + K, still in the input buffer) can't finish it (2026-11-22, for special cancels after strings)
  const pt = f.pressAt && f.pressAt[btn];
  const best = opts.filter(o => o.t >= 0 && (pt == null || pt >= o.t)).sort((a, b) => b.t - a.t)[0];
  return best ? best.move : null;
}
function doSpecial(f, m) {
  f.dirs = [];          // used up, so the same motion can't fire twice
  startMove(f, m);
  if (MOVES[m].fire) SFX.flame();
}
function trySpecial(f, btn) {
  const m = pickSpecial(f, btn);
  if (m) doSpecial(f, m);
  return !!m;
}
// A special cancelled out of a blocked hit comes out this many frames after the blocker is free again (jab startup 4,
// so a jab pressed on their first free frame hits first; Rick 2026-11-22)
const SPECIAL_GAP = 7;
// How long a special typed in during an attack is remembered, waiting for that attack to hit (input buffering)
const SPECIAL_BUFFER = 30;

function control(f, foe) {
  const h = f.held;
  if (f.onGround && ACTIONABLE.has(f.state)) {
    if (Math.abs(foe.x - f.x) > 2) f.face = foe.x > f.x ? 1 : -1;
    // punch + kick together = throw (the specials' motions come first)
    if (f.buf.punch > 0 && f.buf.kick > 0 && !pickSpecial(f, 'punch') && !pickSpecial(f, 'kick')) {
      f.buf.punch = f.buf.kick = 0;
      return startThrow(f);
    }
    // just landed from an air punch that connected: it counts as a string's first punch, so the next press goes
    // straight to that string's 2nd move (e.g. jump-in punch, punch, punch = cross, hook). Specials still win.
    if (f.airStringUntil && G.frame <= f.airStringUntil) {
      for (const b of ['punch', 'kick']) {
        if (!(f.buf[b] > 0) || pickSpecial(f, b)) continue;
        f.chain = ['punch'];
        const next = nextInString(f, b);
        if (!next) continue;
        f.buf[b] = 0; f.airStringUntil = 0;
        return startMove(f, next, ['punch', b]);
      }
    }
    if (want(f, 'punch')) {
      if (trySpecial(f, 'punch')) return;
      if (h.down) return startMove(f, 'uppercut');
      const fwd = f.face > 0 ? 'right' : 'left', back = f.face > 0 ? 'left' : 'right';
      if (h[fwd] && f.def.fwdPunch) return startMove(f, f.def.fwdPunch);      // toward + punch = forward punch
      if (h[back] && f.def.backCharge) { setState(f, 'charging'); f.vx = 0; f.charge = 0; f.heat = 0; return; }      // back + hold punch = charge
      return startMove(f, 'punch', ['punch']);
    }
    if (want(f, 'kick')) {
      if (trySpecial(f, 'kick')) return;
      if (h.down) return startMove(f, 'sweep');
      const fwd = f.face > 0 ? 'right' : 'left';
      if (h[fwd] && f.def.fwdKick) return startMove(f, f.def.fwdKick, ['fwdKick']);      // toward + kick = forward kick
      return startMove(f, 'kick', ['kick']);
    }
    // double-tap left or right = a short dash (toward the rival = forward dash, away = back dash)
    for (const d of ['left', 'right']) {
      if (!want(f, d)) continue;
      const s = d === 'right' ? 1 : -1;
      if (f.lastTap && f.lastTap.s === s && G.frame - f.lastTap.t <= DASH_TAP) { f.lastTap = null; return startDash(f, s); }
      f.lastTap = {s, t: G.frame};
    }
    if (h.up) {
      const jd = (h.right ? 1 : 0) - (h.left ? 1 : 0);
      // straight up is lower than a jump in a direction (Rick 2026-11-21): STRAIGHT_JUMP of the take-off speed
      f.onGround = false; f.vy = f.jumpV = -f.def.jump * (jd ? 1 : STRAIGHT_JUMP);      // jumpV: for jumpPose
      f.vx = jd * JUMP_FWD;
      f.flip = jd * f.face;      // 1 = jumping toward the rival (forward flip), -1 = away (back flip), 0 = straight up
      setState(f, 'jump'); f.airAttacked = false; f.airPunchHit = false; f.airStringUntil = 0;
      SFX.jump();
      return;
    }
    if (h.block) { keep(f, h.down ? 'cblock' : 'block'); f.vx = 0; return; }
    if (h.down) { keep(f, 'crouch'); f.vx = 0; return; }
    const dir = (h.right ? 1 : 0) - (h.left ? 1 : 0);
    if (dir) { keep(f, 'walk'); f.vx = dir * f.def.speed * (dir === f.face ? 1 : 0.75); return; }
    keep(f, 'idle'); f.vx = 0;
  } else if (f.state === 'attack' && f.onGround && f.t <= THROW_TOGETHER && !f.moveHit &&
             ((f.move === 'punch' && f.buf.kick > 0) || (f.move === 'kick' && f.buf.punch > 0))) {
    // the other button came a frame or two after the first: still counts as pressed together, so turn it into a throw
    f.buf.punch = f.buf.kick = 0;
    return startThrow(f);
  } else if (f.state === 'attack' && f.onGround && canCancel(f.move)) {
    // special cancel (Rick 2026-11-21): a normal attack that hit or was blocked can go straight into a special,
    // e.g. punch, punch, then down, forward + kick = Kade's Fiery Rush. Checked before strings, so the motion wins.
    // Input buffering: the special can be typed in any time during the attack, even before it lands; it's kept
    // in f.pendSpecial and fires the moment the attack connects (dropped if the attack misses).
    // (the button pressed last goes first: J, J, then down, forward + K is Fiery Rush, not the blast from the 2nd J)
    for (const b of (f.buf.kick || 0) > (f.buf.punch || 0) ? ['kick', 'punch'] : ['punch', 'kick']) {
      if (!(f.buf[b] > 0)) continue;
      const m = pickSpecial(f, b);
      if (m) { f.buf[b] = 0; f.dirs = []; f.pendSpecial = {move: m, t: G.frame}; }
    }
    if (!f.moveHit) return;
    const ps = f.pendSpecial;
    // (a blocked finisher / special can't cancel its way out of being punished)
    if (ps && G.frame - ps.t <= SPECIAL_BUFFER && !f.blockedExtra) {
      const blocked = f.moveBlocked;
      doSpecial(f, ps.move);
      // Cancelled out of a BLOCKED hit (Rick 2026-11-22): the special starts slower, so it lands only after the
      // blocker's blockstun ends + SPECIAL_GAP frames. A jab (startup 4) pressed as soon as they're free hits first,
      // so a string -> special on a blocking rival can be punished. On hit, specials still combo as before.
      // (M.stringEnder, Kade's Flaming Flurry: made to end a block string, so it skips this slower start; Rick 2026-11-23)
      if (blocked && !MOVES[ps.move].stringEnder) {
        const foe = G.fighters[1 - f.side];
        const left = foe.state === 'blockstun' ? Math.max(0, foe.stun - foe.t) : 0;
        f.hold = Math.max(0, left + SPECIAL_GAP - MOVES[ps.move].startup);
      }
      return;
    }
    if (!f.chain) return;
    // combo string: the last hit connected, so the next button in a string goes straight into its next move
    for (const b of ['punch', 'kick']) {
      if (!(f.buf[b] > 0)) continue;
      const next = nextInString(f, b);
      if (!next) continue;
      f.buf[b] = 0;
      return startMove(f, next, f.chain.concat(b));
    }
  } else if (f.state === 'jump' && !f.airAttacked) {
    if (want(f, 'punch')) { f.airAttacked = true; startMove(f, 'airPunch'); }
    else if (want(f, 'kick')) { f.airAttacked = true; startMove(f, 'airKick'); }
  } else if ((f.state === 'dashf' || f.state === 'dashb') && f.t >= DASH_CANCEL) {
    // a dash can be cut short by an attack (dash in and punch)
    if (want(f, 'punch')) return f.held.down ? startMove(f, 'uppercut') : startMove(f, 'punch', ['punch']);
    if (want(f, 'kick')) return f.held.down ? startMove(f, 'sweep') : startMove(f, 'kick', ['kick']);
  }
}

// ===== Charge attacks (Kade's Furnace Fist, Rick 2026-11-21) =====
// back + punch with FIGHTERS[].backCharge puts the fighter in state 'charging' (can be hit, can't move) while punch
// stays held. Let go before CHARGE_TAP frames = it was just a tap: a normal jab. Otherwise the charged move swings,
// with f.charge 0..1 (how long it was held, up to CHARGE_MAX frames, where it swings by itself).
const CHARGE_TAP = 6, CHARGE_MAX = 60;
function updateCharge(f) {
  f.vx = 0;
  const t = f.t;
  f.heat = clampF(t / CHARGE_MAX);      // fists glow hotter the longer it's held (drawn in draw.js)
  if (f.def.throwFx && t % 4 === 0 && t > CHARGE_TAP) flames(f.x - f.face * 26, f.y - 96, -f.face);      // sparks off the fists
  if (f.held.punch && t < CHARGE_MAX) return;
  if (t < CHARGE_TAP) return startMove(f, 'punch', ['punch']);
  const m = f.def.backCharge;
  f.charge = clampF((t - CHARGE_TAP) / (CHARGE_MAX - CHARGE_TAP));      // (set before startMove, which logs it in practice)
  startMove(f, m);
  f.heat = Math.max(0.3, f.charge);
  if (MOVES[m].heat) SFX.flame();
}
// ===== Throws (Rick 2026-11-21) =====
// Punch + kick pressed together (up to THROW_TOGETHER frames apart) = throw. Holding away from the rival
// tosses them backward (over your head, behind you); otherwise forward. If the grab catches them, the thrower goes
// into state 'throwing' and the rival into 'held' (can't be hit, follows the thrower's hands) until THROW.release,
// when they fly off and land in a knockdown. Fighters with def.throwFx (Kade) get glowing hands.
const THROW_TOGETHER = 2;
const THROW = {lift: 6, release: 28, end: 42};
// Throw break (tech): the rival presses punch + kick (their throw input) any time from when the throw starts
// until TECH_LATE frames into being held (= the throw's startup and first few active frames). Both get pushed apart.
const TECH_LATE = 4;
function startThrow(f) {
  const away = f.face > 0 ? 'left' : 'right';
  startMove(f, 'throw');
  f.throwDir = f.held[away] ? -1 : 1;
  f.throwStart = G.frame;
  f.throwInputAt = G.frame;      // starting your own throw also counts as the throw input (for breaking theirs)
}
// Called from step() for every punch / kick press: was the other button pressed within THROW_TOGETHER frames?
function noteThrowInput(f, b) {
  if (!f.pressAt) f.pressAt = {};
  f.pressAt[b] = G.frame;
  const other = f.pressAt[b === 'punch' ? 'kick' : 'punch'];
  if (other != null && G.frame - other <= THROW_TOGETHER) f.throwInputAt = G.frame;
}
const techInput = (att, def) => def.throwInputAt != null && def.throwInputAt >= att.throwStart - THROW_TOGETHER;
function grab(att, def) {
  if (techInput(att, def)) return techThrow(att, def);
  setState(att, 'throwing'); att.vx = 0;
  // how far out the rival was grabbed, past where the grip starts (toss: 48 px in front / back toss 60; heave: their
  // waist at 46): throwGrip pulls them in from there, so a long-reach grab doesn't make them jump closer
  const style = att.def.throwStyle, start = style === 'heave' ? 46 : att.throwDir > 0 ? 48 : 60;
  att.throwPull = style === 'slam' ? 0 : Math.max(0, Math.abs(def.x - att.x) - start);
  setState(def, 'held'); def.vx = 0; def.vy = 0; def.onGround = true;
  def.throwDir = att.throwDir;
  def.face = -att.face;
  G.hitstop = 5;
  SFX.grab();
}
function techThrow(att, def) {
  for (const f of [att, def]) {
    setState(f, 'blockstun'); f.stun = 18; f.blockLow = false;
    f.y = GROUND; f.onGround = true; f.vy = 0;
    f.vx = f === att ? -att.face * 6 : att.face * 6;      // pushed apart
  }
  def.note = 'THROW BREAK'; def.noteShow = 70;
  if (def.side === 0) tutMark('escape');      // tutorial task: you broke the dummy's throw
  G.hitstop = 6;
  SFX.block();
  spark((att.x + def.x) / 2, GROUND - 120, '#ffffff', 12);
}
// Where the thrower's hands are at frame t, in the thrower's own drawing space (facing right, feet at 0,0).
// The hands hold the middle of the rival's body, so the arms (poseFor) and the rival (carry) both use this.
// style 'slam' (Kade): grab high, hoist them overhead, then slam them down into the floor in front or behind.
// reach (f.throwPull, set in grab): grabbed this much further out, then pulled in over the first frames.
function throwGrip(style, dir, t, reach = 0) {
  const c01 = k => Math.max(0, Math.min(1, k));
  const lift = ease(c01(t / THROW.lift));
  const pull = reach * (1 - ease(c01(t / 10)));
  if (style === 'heave') {      // hands round the waist: hoist onto the shoulder, then heave off it
    const up = ease(c01((t - 4) / 12)), h = ease(c01((t - 16) / (THROW.release - 16)));
    const gx = 46 + pull, x = gx + (16 - gx) * up, y = -72 - 60 * up;      // waist height -> on top of the front shoulder
    // (Rick 2026-11-22: arms end up stretched right out toward where they're thrown)
    return dir > 0 ? [x + 76 * h, y + 10 * h]      // hurled out in front
                   : [x - 86 * h, y + 50 * h * h];      // over the shoulder and down behind
  }
  if (style === 'slam') {
    const up = ease(c01((t - 4) / 12)), s = c01((t - 16) / (THROW.release - 16)), down = s * s;      // speeds up into the slam
    if (dir > 0) {      // up overhead, then down in front, well out ahead (Rick 2026-11-21: a little more forward)
      const x = 36 - 22 * up, y = -100 - 25 * lift - 50 * up;      // overhead, but still within arm's reach
      return [x + (74 - x) * down, y + (-45 - y) * down];
    }
    // overhead, then over the top in an arc (centre 0,-100, radius 78) and down behind, further back than before
    const a0 = 1.41, a = a0 + (4.05 - a0) * down, r = 78;
    const ox = 36 - 25 * up, oy = -100 - 25 * lift - 51 * up;      // on the way up
    const ax = r * Math.cos(a), ay = -100 - r * Math.sin(a);
    return s > 0 ? [ax, ay] : [ox, oy];
  }
  if (dir > 0) {      // toss forward: hoist them up in front, then heave them forward
    const up = ease(c01((t - 4) / 12)), push = ease(c01((t - 18) / 10));
    return [40 + pull + 34 * push, -100 - 10 * lift - 44 * up + 14 * push];
  }
  // toss backward: swing them round in a half circle over the head (within arm's reach) and down behind
  const a = Math.PI * ease(c01((t - 4) / (THROW.release - 4)));
  return [52 * Math.cos(a) + pull, -100 - 22 * lift - 52 * Math.sin(a)];
}
// Put the held rival so the middle of their body (their spin point, 8 px in front and 100 up) sits in the grip
function carry(att, def, t) {
  const [gx, gy] = throwGrip(att.def.throwStyle, att.throwDir, t, att.throwPull || 0);
  if (att.def.throwStyle === 'heave') {      // the grip is their waist (hip, 28 px below the spin point), not their middle
    const a = heldRot('heave', att.throwDir, t), c = Math.cos(a), s = Math.sin(a);
    const vx = -8 * c - 28 * s, vy = -8 * s + 28 * c;      // spin point -> hip, turned with them (they face the other way)
    def.x = att.x + att.face * (gx + vx + 8);
    def.y = GROUND + gy - vy + 100;
    return;
  }
  def.x = att.x + att.face * (gx + 8);
  def.y = GROUND + gy + 100;
}
// How far a held rival is turned at frame t (draw.js turns them by this; the heave also places them with it).
// heave: tipped over the shoulder (a quarter turn, head hanging behind the thrower), then forward = swung back out
// legs first, back = carried on over and flipped round as they go down behind.
function heldRot(style, dir, t) {
  const c01 = k => Math.max(0, Math.min(1, k)), R = THROW.release;
  if (style === 'heave') {
    const up = ease(c01((t - 4) / 12)), h = ease(c01((t - 16) / (R - 16)));
    return Math.PI / 2 * up + (dir > 0 ? -2 * h : Math.PI * 1.5 * h);
  }
  if (style === 'slam') {      // upright while hoisted, then turned to land flat on their back
    const s = c01((t - 16) / (R - 16));
    return (dir > 0 ? -Math.PI / 2 : Math.PI * 1.5) * s * s;
  }
  return dir > 0 ? -0.6 * ease(c01((t - 18) / 10)) : Math.PI * 2 * ease(c01((t - 4) / (R - 4)));
}
// how fast a slammed rival skids away along the floor (Rick 2026-11-22: "too short"; was fwd 4 / back 16, which
// ended ~100 px ahead / ~120 px behind; now ~180 / ~220). They slow to a stop (x0.8 a frame), so skid ≈ speed x 5.
let SLAM_SKID = {fwd: 20, back: 36};
function releaseThrow(att, def) {
  const dir = att.face * att.throwDir;      // the way they go, on screen
  const dmg = Math.round(MOVES.throw.dmg * att.def.power);
  def.hp = lowerHp(def, dmg); def.flash = 6;
  att.combo = 1;
  practiceContact(att, 'throw', dmg);
  if (att.def.throwStyle === 'slam') {      // straight into the floor: lying down at once, big shake and dust
    setState(def, def.hp <= 0 ? 'ko' : 'down');
    // the slam skids them on: forward 4; backward 16 (Rick 2026-11-21: reverse throw goes further, ~130 px behind)
    def.onGround = true; def.y = GROUND; def.vy = 0; def.vx = dir * (att.throwDir > 0 ? SLAM_SKID.fwd : SLAM_SKID.back);
    if (att.throwDir < 0) dust(def.x - dir * 30, 10);      // a trail of dust as they skid away
    G.hitstop = 10; G.shake = Math.max(G.shake, 16);
    SFX.hit(true); SFX.thud();
    dust(def.x, 18);
    spark(def.x, GROUND - 20, att.def.throwFx || '#fff2b0', 16);
    return;
  }
  setState(def, def.hp <= 0 ? 'ko' : 'knockdown');
  // backward toss flies higher and further than before (was vy -6, vx 7), as far as a forward one or more
  def.onGround = false; def.vy = -8; def.vx = dir * (att.throwDir > 0 ? 7 : 9);
  G.hitstop = 8; G.shake = Math.max(G.shake, 10);
  SFX.hit(true);
  spark(def.x, def.y - 80, att.def.throwFx || '#fff2b0', 14);
}
function updateThrow(f) {
  const def = G.fighters[1 - f.side];
  f.vx = 0;
  if (def.state === 'held' && f.t <= TECH_LATE && techInput(f, def)) return techThrow(f, def);
  if (def.state === 'held') {
    carry(f, def, f.t);
    if (f.def.throwFx && f.t % 3 === 0 && f.t < THROW.release) flames(def.x - f.face * 6, def.y - 96, -f.face);      // embers off the glowing hands
    if (f.t >= THROW.release) releaseThrow(f, def);
  }
  if (f.t >= THROW.end) setState(f, 'idle');
}
// Moves that can be cancelled into a special: every ground normal and string move, but not specials themselves or throws
function canCancel(m) {
  const M = MOVES[m];
  return !M.air && !M.throw && !M.projectile && !FIGHTERS.some(d => (d.extras || []).some(x => x.move === m));
}
// Which move comes next if this fighter presses button b now? (null = b doesn't continue any of their strings)
function nextInString(f, b) {
  const n = f.chain.length;
  for (const s of STRINGS[f.def.id] || []) {
    if (s.btns.length > n && s.btns[n] === b && f.chain.every((x, i) => s.btns[i] === x)) return s.moves[n];
  }
  return null;
}

// Jump sideways speed (Rick 2026-11-21: jumps go higher and farther; a fighter's height comes from FIGHTERS[].jump)
const JUMP_FWD = 5.6;
const STRAIGHT_JUMP = 0.82;      // 0.82 x speed = about two-thirds of the height (~130 px instead of ~195)
// Dash: DASH_FRAMES long; forward is faster than backward. While dashing you can still be hit.
const DASH_TAP = 14, DASH_FRAMES = 14, DASH_CANCEL = 5, DASH_SPEED = 9.5, DASH_BACK = 7.5;
function startDash(f, s) {
  setState(f, s === f.face ? 'dashf' : 'dashb');
  f.dashDir = s;
  SFX.whoosh();
  dust(f.x - s * 16, 4);
}

function updateFighter(f) {
  if (f.state === 'attack' && f.hold > 0) f.hold--;      // slow start (special cancelled out of a blocked hit)
  else f.t++;
  if (f.cd > 0) f.cd--;
  if (f.flash > 0) f.flash--;
  if (f.comboShow > 0) f.comboShow--;
  if (f.noteShow > 0) f.noteShow--;      // short HUD note, e.g. THROW BREAK
  f.trail += (f.hp - f.trail) * (f.trail > f.hp + 0.2 ? 0.04 : 1);

  if (f.state === 'attack') {
    const M = MOVES[f.move];
    if (M.projectile && f.t === M.startup) spawnProjectile(f);
    if (M.pulse && f.t === M.startup) spawnPulse(f);      // Vex's Ground Pulse: the fist hits the floor
    if (M.trap && f.t === M.startup) spawnTrap(f);        // Vex's Static Orb is left floating
    if (M.fistFire && f.t === 2) SFX.flame();      // Flaming Flurry: fists catch fire
    if (M.bolts && f.t === M.startup) { SFX.zapUp(); spark(f.x, f.y - 190, f.def.special.color, 8); }      // Sky Bolt fires
    if (M.shock && f.t === M.startup) { SFX.crackle(); SFX.whoosh(); spark(f.x + f.face * 70, f.y - 110, f.def.special.color, 8); }      // Shockwave bursts
    if (M.spin && (f.t === 3 || f.t === M.startup)) dust(f.x + f.face * 30, 6);      // spinning sweep kicks up dust
    if (f.onGround && M.rush) {
      // rushing move: slide forward until it connects or ends, then skid to a stop. If it's blocked, keep sliding
      // into their guard until right up against them (so they can punish it).
      const foe = G.fighters[1 - f.side];
      // (multi-hit moves keep travelling through their hits, carrying the rival along)
      const going = f.t >= M.startup - 3 && f.t < M.startup + M.active &&
        (!f.moveHit || M.hits || (M.through && !f.blockedExtra) || (f.blockedExtra && Math.abs(foe.x - f.x) > 58));
      f.vx = going ? f.face * M.rush : f.vx * 0.75;
      if (M.through && going && f.t % 3 === 0) dust(f.x, 3);      // a slide kicks up dust
      if (M.fire && going) {
        // flames off the burning foot (for a spinning move, wherever the foot is in its turn)
        const sx = M.spinN ? Math.cos(Math.PI * 2 * M.spinN * clampF((f.t - M.startup) / M.active)) : 1;
        flames(f.x + f.face * 70 * sx, f.y - (M.fireY || 96), f.face);
      }
      if (M.spinN && f.t >= M.startup && (f.t - M.startup) % Math.round(M.active / M.spinN) === 0 && f.t < M.startup + M.active) SFX.whoosh();
    } else if (f.onGround) f.vx = M.lunge && f.t < M.startup ? f.face * M.lunge : 0;
    if (f.t >= M.startup + M.active + M.recovery + (f.blockedExtra || 0)) setState(f, f.onGround ? 'idle' : 'jump');
  }
  if (f.state === 'blockstun' && f.held.block) f.blockLow = !!f.held.down;      // you can switch high/low guard while blocking
  if (f.state === 'throwing') updateThrow(f);
  if (f.state === 'charging') updateCharge(f);
  // the thrower got knocked out of the throw (e.g. by a blast already flying): drop the held fighter
  if (f.state === 'held' && G.fighters[1 - f.side].state !== 'throwing') { setState(f, 'knockdown'); f.onGround = false; f.vy = -3; }
  if ((f.state === 'hitstun' || f.state === 'blockstun') && f.t >= f.stun) setState(f, f.onGround ? freeState(f) : 'jump');
  if (f.state === 'dashf' || f.state === 'dashb') {
    const top = f.state === 'dashf' ? DASH_SPEED : DASH_BACK;
    f.vx = f.dashDir * top * (f.t < DASH_FRAMES * 0.6 ? 1 : 0.45);
    if (f.t >= DASH_FRAMES) { setState(f, freeState(f)); f.vx = 0; }
  }
  if (f.state === 'down' && f.t >= 36) setState(f, 'getup');
  if (f.state === 'getup' && f.t >= 20) setState(f, freeState(f));
  if (f.state === 'walk') f.walkPhase += Math.abs(f.vx) * 0.11 * (f.vx * f.face > 0 ? 1 : -1);

  if (!f.onGround && f.hang > 0) {
    f.hang--;      // held in the air (Vex's Sky Bolt): floats in place, then the launch takes over
  } else if (!f.onGround) {
    f.vy += GRAV; f.x += f.vx; f.y += f.vy;
    if (f.y >= GROUND) { f.y = GROUND; f.vy = 0; f.onGround = true; land(f); }
  } else {
    f.x += f.vx;
    if (!ACTIONABLE.has(f.state)) f.vx *= 0.8;
  }
  f.x = Math.max(36, Math.min(W - 36, f.x));
}

function land(f) {
  if (f.state === 'knockdown' || f.state === 'juggle') { setState(f, 'down'); f.vx *= 0.3; SFX.thud(); G.shake = Math.max(G.shake, 5); dust(f.x, 10); }
  else if (f.state === 'ko') { f.vx *= 0.3; SFX.thud(); G.shake = Math.max(G.shake, 7); dust(f.x, 14); }
  else if (f.state === 'attack' || f.state === 'jump' || f.state === 'hitstun' || f.state === 'blockstun') {
    setState(f, 'idle'); f.vx = 0; dust(f.x, 4);
  }
  // the air punch connected: for a moment after landing, the next press carries on a string (see control)
  if (f.airPunchHit && f.state === 'idle') f.airStringUntil = G.frame + AIR_STRING;
  f.airAttacked = false; f.airPunchHit = false;
}
// frames after landing in which the next punch / kick continues a string started by the air punch
const AIR_STRING = 12;

// down low: crouching, crouch-blocking or sweeping (high attacks go over them)
function isLow(f) {
  return f.onGround && (f.state === 'crouch' || f.state === 'cblock' || (f.state === 'blockstun' && f.blockLow) ||
    (f.state === 'attack' && (f.move === 'sweep' || (f.move === 'cinderSlide' && f.t >= MOVES.cinderSlide.startup))));      // slide: once he's down
}
// sliding past someone (MOVES[].through, e.g. Cinder Slide): no pushing apart until the slide is over
const sliding = f => f.state === 'attack' && MOVES[f.move].through && f.t < MOVES[f.move].startup + MOVES[f.move].active;
// full = ignore crouching (mid and low ground attacks always reach a crouching fighter)
function hurtbox(f, full) {
  if (FLOORED.has(f.state) || f.state === 'getup' || f.state === 'held') return null;
  const h = isLow(f) && !full ? 96 : 150;
  const box = {x: f.x - 24, y: f.y - h, w: 48, h};
  // pokes (M.poke): the stretched-out arm / leg can be hit from when it comes out until it's pulled back in
  // (the first 2/3 of the recovery), so a rival who stays just out of reach can hit it (whiff punish)
  const M = f.state === 'attack' && MOVES[f.move];
  if (M && M.poke && f.t >= M.startup && f.t < M.startup + M.active + M.recovery * 2 / 3) {
    const reach = M.hit.x + M.hit.w * 0.8 - 24;      // from the body's front edge to near the fist / foot
    box.w += reach;
    if (f.face < 0) box.x -= reach;
  }
  return box;
}
function hitRect(f) {
  const M = MOVES[f.move], b = M.hit;
  const w = b.w + (M.throw && f.def.throwReach || 0);      // longer-armed throw (Kade)
  return {x: f.face > 0 ? f.x + b.x : f.x - b.x - w, y: f.y + b.y, w, h: b.h};
}
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
// The state a fighter goes into when getting up / hitstun / blockstun / a dash ends: straight into their block if
// they're holding it (Rick 2026-11-23). Before, they went to 'idle' after this frame's controls had already run, so
// for that one frame they could be hit while holding block (found testing Furnace Fist on wake-up).
function freeState(f) { return f.held.block ? (f.held.down ? 'cblock' : 'block') : 'idle'; }
function isBlocking(f) {
  return f.onGround && (f.state === 'block' || f.state === 'cblock' || (f.state === 'blockstun' && f.held.block));
}
function blockingLow(f) { return f.state === 'cblock' || (f.state === 'blockstun' && !!f.held.down); }
// Does this block stop an attack of this level? Low attacks need a crouching block, overheads a standing block;
// high and mid are fine either way (a high one never reaches a crouching fighter anyway).
function blocks(def, M) {
  const lv = levelOf(M);
  return isBlocking(def) && (lv === 'low' ? blockingLow(def) : lv === 'overhead' ? !blockingLow(def) : true);
}

function checkHit(att, def) {
  if (att.state !== 'attack') return;
  let M = MOVES[att.move];
  // multi-hit moves (M.hits, e.g. Blaze Wheel): can hit again every M.hitEvery frames, up to M.hits times
  const again = M.hits && att.moveHit && att.hitN < M.hits && att.t - att.lastHitT >= M.hitEvery;
  if (att.moveHit && !again) return;
  if (!M.hit || att.t < M.startup || att.t >= M.startup + M.active) return;
  // ground attacks: the level decides. High ones miss a crouching fighter; mid and low ones always reach them.
  const ground = !M.air && !M.throw;
  if (!M.air && levelOf(M) === 'high' && isLow(def)) return;      // includes throws: crouching ducks them
  // (an overhead from the air also reaches a crouching fighter's head, so it hits through a crouching block)
  const hb = hurtbox(def, ground || levelOf(M) === 'overhead');
  if (!hb) return;
  if (M.throw && !canThrow(def)) return;
  const r = hitRect(att);
  if (!overlap(r, hb)) return;
  att.moveHit = true;
  if (att.move === 'airPunch') att.airPunchHit = true;      // lets a string carry on after landing
  if (M.hits) {      // only the last hit knocks down; the ones before keep them in a short stun, right in front
    att.hitN = (att.hitN || 0) + 1; att.lastHitT = att.t;
    // (carry: an airborne rival is carried along with the rush so the later hits still reach them, see applyHit)
    // (blockPush 1: blocked early hits barely push, so the later hits still reach; the last hit uses the move's own)
    if (att.hitN < M.hits) M = Object.assign({}, M, {knockdown: false, hitstun: M.hitEvery + 12, push: 1, blockPush: 1, from: att.move, carry: true});
    else M = Object.assign({}, M, {from: att.move});
  }
  // charged moves: more damage and knockback the longer it was charged
  if (M.dmgCharge) M = Object.assign({}, M, {dmg: M.dmg + M.dmgCharge * (att.charge || 0), kb: M.kb + M.kbCharge * (att.charge || 0), from: att.move});
  const sx = att.face > 0 ? Math.max(r.x, hb.x) : Math.min(r.x + r.w, hb.x + hb.w);
  const sy = Math.max(r.y, hb.y) + Math.min(r.h, 20) / 2;
  applyHit(att, def, M, att.face, sx, sy);
}

function applyHit(att, def, M, dir, sx, sy) {
  const pw = att.def.power;
  if (M.throw) return grab(att, def);      // the damage comes when they're tossed (releaseThrow)
  if (blocks(def, M)) {
    const punishable = att.state === 'attack' && (MOVES[att.move] === M || M.from === att.move) && BLOCK_PUNISH[att.move];
    const chip = Math.max(1, Math.round(M.dmg * pw * 0.15));
    def.hp = lowerHp(def, chip);
    practiceContact(att, 'block', chip, M);
    def.blockLow = blockingLow(def);
    setState(def, 'blockstun');
    def.stun = M.blockstun || 12;
    // less push on a punishable block, so the attacker stays in reach; a lot on a heavy one (M.blockPush)
    def.vx = dir * (M.blockPush || (punishable ? 1.5 : 4));
    if (M.blockPush > 4) { G.shake = Math.max(G.shake, 6); dust(def.x, 6); }      // (only a heavy shove shakes)
    G.hitstop = 4;
    SFX.block();
    spark(sx, sy, '#8fd8ff', 6);
    // blocked finisher / special: the attacker is stuck in a longer recovery (punishable)
    if (punishable) att.blockedExtra = punishable;
    if (att.state === 'attack') att.moveBlocked = true;
    if (def.hp <= 0) { setState(def, 'ko'); def.onGround = false; def.vy = -9; def.vx = dir * 5; }
    return;
  }
  // hit back while they're stuck recovering from a blocked finisher / special
  if (def.state === 'attack' && def.blockedExtra) { att.note = 'PUNISH!'; att.noteShow = 70; }
  const juggled = def.state === 'juggle';
  def.hang = 0;      // any new hit ends a Sky Bolt hold; the juggle branch below may start a new one (M.hang)
  // mid-screen relaunch (Rick 2026-11-22): a string started out of a forward dash whose FIRST hit catches the juggled
  // rival low (within RELAUNCH_LOW px of the floor, ~3-4 frames before they land) may relaunch with its launcher
  if (juggled && att.dashString && att.chain && att.chain.length === 1 && GROUND - def.y <= RELAUNCH_LOW) att.relaunchOK = true;
  const comboing = def.state === 'hitstun' || def.state === 'knockdown' || juggled;
  att.combo = comboing ? att.combo + 1 : 1;
  // later hits in a combo do less damage (see comboScale), at least 1
  const d = Math.max(1, Math.round(M.dmg * pw * comboScale(att.combo)));
  if (att.combo >= 2) att.comboShow = 80;
  def.hp = lowerHp(def, d);
  practiceContact(att, 'hit', d, M);
  def.flash = 6;
  if (def.hp <= 0) {
    setState(def, 'ko'); def.onGround = false; def.vy = -9; def.vx = dir * 5;
  } else if (juggled && M.carry) {
    // early hit of a multi-hit rush (Blaze Wheel) on someone in the air (Rick 2026-11-23: its last hit dropped in juggles,
    // because the rush ran underneath them): carry them along at the rush speed with a small float so they stay in the
    // spin. Doesn't count toward JUGGLE_MAX, so the last hit (a knockdown) always gets to land.
    def.vy = -3.5; def.vx = dir * (MOVES[att.move].rush || 1);
    def.t = 0;
  } else if (!(juggled && M.ender) &&      // a combo ender (Flaming Flurry's last hit) knocks a juggled rival down
             !(juggled && M.juggle && !M.extend && !inCorner(def) && !att.relaunchOK) &&
             ((M.juggle && (def.onGround || M.antiAir)) || (juggled && def.juggleN < JUGGLE_MAX))) {
    // (a launcher on someone already in the air only relaunches them in the corner; mid-screen it knocks them down,
    // so launcher strings can't be looped: Rick 2026-11-22. Except a precise dash-in: see RELAUNCH_LOW. M.extend
    // moves (Vex's Sky Bolt) may pop them mid-screen; JUGGLE_MAX still ends it. M.antiAir also launches a jumper.)
    if (juggled && M.juggle && !M.extend && !inCorner(def)) { att.note = 'RELAUNCH!'; att.noteShow = 70; }
    // launcher: knock them up into the air, where they can still be hit (a juggle). Every hit pops them up again,
    // a bit less each time, and after JUGGLE_MAX extra hits the next one just knocks them down.
    def.juggleN = juggled ? def.juggleN + 1 : 0;
    const k = Math.max(0.45, 1 - 0.13 * def.juggleN);
    setState(def, 'juggle'); def.onGround = false;
    def.vy = juggled ? Math.min(-5, (M.launch || -11) * k) : M.launch;
    def.vx = dir * (juggled ? 0.8 : M.kb);
    if (M.hang) def.hang = M.hang;      // Sky Bolt: held in the bolts for a moment before the launch
  } else if (M.knockdown || !def.onGround) {
    setState(def, 'knockdown'); def.onGround = false; def.vy = M.launch || -7; def.vx = dir * (M.kb || 4);
  } else {
    setState(def, 'hitstun'); def.stun = M.hitstun; def.vx = dir * M.push;
  }
  const heavy = M.heavy || d >= 10;
  G.hitstop = heavy ? 9 : 6;
  G.shake = Math.max(G.shake, heavy ? 9 : 4);
  SFX.hit(heavy);
  spark(sx, sy, '#fff2b0', heavy ? 14 : 9);
}

// ===== Energy blasts =====
// Vex's Smite (Rick 2026-11-22): not a flying blast. Casting marks the rival's spot on the floor; after SMITE_WARN
// frames of warning a bolt strikes a column SMITE_HALF px either side of it, live for SMITE_ACTIVE frames. Overhead,
// so only a standing block stops it (crouching or jumping doesn't); moving out of the column avoids it (a dash gets
// out in time if you react to the cast; walking out takes most of the warning).
const SMITE_WARN = 20, SMITE_ACTIVE = 5, SMITE_END = 36, SMITE_HALF = 30;
function spawnProjectile(f) {
  const s = f.def.special;
  if (s.type === 'smite') {
    const foe = G.fighters[0] === f ? G.fighters[1] : G.fighters[0];
    G.projectiles.push({x: foe.x, y: GROUND, vx: 0, owner: f, s, t: 0, r: 0, dead: false});
    f.cd = SPECIAL_WAIT;
    SFX.special();
    return;
  }
  G.projectiles.push({x: f.x + f.face * 56, y: f.y - 114, vx: f.face * s.speed, owner: f, s, t: 0,
    r: s.type === 'orb' ? 18 : 14, dead: false});
  f.cd = SPECIAL_WAIT;
  SFX.special();
}
function circleRect(c, r) {
  const nx = Math.max(r.x, Math.min(c.x, r.x + r.w)), ny = Math.max(r.y, Math.min(c.y, r.y + r.h));
  return (c.x - nx) ** 2 + (c.y - ny) ** 2 < c.r * c.r;
}
function updateProjectiles() {
  const live = G.phase === 'fight';
  for (const p of G.projectiles) {
    if (p.s.type === 'smite') { p.t++; updateSmite(p, live); continue; }
    if (p.s.type === 'pulse') { p.x += p.vx; p.t++; updatePulse(p, live); continue; }
    if (p.s.type === 'trap') { p.t++; updateTrap(p, live); continue; }
    p.x += p.vx; p.t++;
    if (p.s.type === 'flame' && p.t % 2 === 0) G.parts.push({x: p.x - Math.sign(p.vx) * 10, y: p.y + (Math.random() - 0.5) * 12,
      vx: -p.vx * 0.15, vy: -0.6, life: 16, max: 16, color: p.s.color, size: 5, kind: 'dot'});
    if (p.x < -60 || p.x > W + 60) { p.dead = true; continue; }
    if (!live) continue;
    const foe = G.fighters[0] === p.owner ? G.fighters[1] : G.fighters[0];
    const hb = hurtbox(foe);
    if (hb && !isLow(foe) && circleRect(p, hb)) {      // blasts are high: crouching ducks them
      p.dead = true;
      applyHit(p.owner, foe, {dmg: p.s.dmg / p.owner.def.power, hitstun: 22, push: 6, blockstun: 14, heavy: true, level: 'high', blast: true},
        Math.sign(p.vx), p.x, p.y);
    }
  }
  const ps = G.projectiles.filter(p => !['smite', 'pulse', 'trap'].includes(p.s.type));      // two flying blasts cancel (Vex's Smite / Ground Pulse / Static Orb never clash)
  if (ps.length === 2 && !ps[0].dead && !ps[1].dead && Math.abs(ps[0].x - ps[1].x) < ps[0].r + ps[1].r) {
    ps[0].dead = ps[1].dead = true;
    spark((ps[0].x + ps[1].x) / 2, ps[0].y, '#ffffff', 16);
    SFX.block();
  }
  G.projectiles = G.projectiles.filter(p => !p.dead);
}
// Vex's Ground Pulse (Rick 2026-11-23): a crackling wave along the floor from his fist, PULSE_H px tall and
// PULSE_HALF px either side of its middle. Low: only a crouching block stops it; jumping clears it.
const PULSE_H = 34, PULSE_HALF = 22;
function spawnPulse(f) {
  const s = f.def.pulse;
  G.projectiles.push({x: f.x + f.face * 50, y: GROUND, vx: f.face * s.speed, owner: f, s, t: 0, r: 0, dead: false});
  SFX.thud(); SFX.crackle();
  G.shake = Math.max(G.shake, 4); spark(f.x + f.face * 50, GROUND - 6, s.color, 10); dust(f.x + f.face * 50, 6);
}
function updatePulse(p, live) {
  if (p.t % 10 === 0) SFX.crackle();
  if (p.x < -60 || p.x > W + 60) { p.dead = true; return; }
  if (!live) return;
  const foe = G.fighters[0] === p.owner ? G.fighters[1] : G.fighters[0];
  const hb = hurtbox(foe, true);      // full height: a low reaches crouching fighters too (only their block stops it)
  if (!hb || !overlap({x: p.x - PULSE_HALF, y: GROUND - PULSE_H, w: PULSE_HALF * 2, h: PULSE_H}, hb)) return;
  p.dead = true;
  applyHit(p.owner, foe, {dmg: p.s.dmg / p.owner.def.power, hitstun: 20, push: 3, blockstun: 14, level: 'low', blast: true},
    Math.sign(p.vx), p.x, GROUND - 16);
}
// Vex's Static Orb (Rick 2026-11-23): floats TRAP_DX in front of him at waist height for trap.life frames. Harmless
// on its own; if the rival touches it while reeling from Vex's hit (hitstun, knocked down or juggled), it zaps them
// (part of the combo), launches them (extend: works mid-screen; antiAir: also from a knockdown) and explodes.
// One at a time: casting again replaces it. p.boom counts the explosion frames.
const TRAP_DX = 130, TRAP_Y = 82, TRAP_R = 22, TRAP_BOOM = 16;
function spawnTrap(f) {
  G.projectiles = G.projectiles.filter(p => !(p.owner === f && p.s.type === 'trap'));
  G.projectiles.push({x: Math.max(40, Math.min(W - 40, f.x + f.face * TRAP_DX)), y: GROUND - TRAP_Y, vx: 0, owner: f, s: f.def.trap,
    t: 0, r: TRAP_R, boom: 0, dead: false});
  SFX.crackle();
}
function updateTrap(p, live) {
  if (p.boom) { if (++p.boom > TRAP_BOOM) p.dead = true; return; }
  if (p.t >= p.s.life) { p.dead = true; return; }
  if (!live) return;
  const foe = G.fighters[0] === p.owner ? G.fighters[1] : G.fighters[0];
  if (!['hitstun', 'knockdown', 'juggle'].includes(foe.state)) return;      // only when Vex knocked them into it
  // (a fighter flying from a knockdown has no hurtbox for normal attacks, so the orb uses a low body box for them)
  const hb = foe.state === 'knockdown' ? {x: foe.x - 32, y: foe.y - 80, w: 64, h: 80} : hurtbox(foe, true);
  if (!hb || !circleRect(p, hb)) return;
  p.boom = 1;
  SFX.thunder(); G.shake = Math.max(G.shake, 7); spark(p.x, p.y, p.s.color, 16);
  applyHit(p.owner, foe, {dmg: p.s.dmg / p.owner.def.power, juggle: true, extend: true, antiAir: true, launch: -13, kb: 1,
    heavy: true, blast: true}, Math.sign(foe.x - p.owner.x) || 1, p.x, p.y);
}
function updateSmite(p, live) {
  if (p.t < SMITE_WARN && p.t % 6 === 1) SFX.crackle();
  if (p.t === SMITE_WARN) { SFX.thunder(); G.shake = Math.max(G.shake, 8); spark(p.x, GROUND - 8, p.s.color, 14); dust(p.x, 8); }
  if (p.t >= SMITE_END) { p.dead = true; return; }
  if (!live || p.hit || p.t < SMITE_WARN || p.t >= SMITE_WARN + SMITE_ACTIVE) return;
  const foe = G.fighters[0] === p.owner ? G.fighters[1] : G.fighters[0];
  const hb = hurtbox(foe, true);      // full height: it comes from above, so crouching doesn't duck it
  if (!hb || !overlap({x: p.x - SMITE_HALF, y: -1000, w: SMITE_HALF * 2, h: 2000}, hb)) return;
  p.hit = true;
  applyHit(p.owner, foe, {dmg: p.s.dmg / p.owner.def.power, hitstun: 24, push: 1, blockstun: 16, heavy: true, level: 'overhead', blast: true},
    Math.sign(foe.x - p.owner.x) || 1, foe.x, hb.y + 24);
}

// ===== Keep fighters apart =====
function separate(a, b) {
  if (FLOORED.has(a.state) || FLOORED.has(b.state) || a.state === 'juggle' || b.state === 'juggle' ||
      a.state === 'held' || b.state === 'held' || sliding(a) || sliding(b)) return;
  if (Math.abs(a.y - b.y) > 110) return;
  const min = 46, dx = b.x - a.x;
  if (Math.abs(dx) >= min) return;
  const s = dx === 0 ? (a.face || 1) : Math.sign(dx);
  const push = (min - Math.abs(dx)) / 2;
  a.x -= s * push; b.x += s * push;
  const clamp = f => { f.x = Math.max(36, Math.min(W - 36, f.x)); };
  clamp(a); clamp(b);
  if (Math.abs(b.x - a.x) < min - 0.5) {
    if (a.x <= 36 || a.x >= W - 36) b.x = a.x + s * min; else a.x = b.x - s * min;
    clamp(a); clamp(b);
  }
}

