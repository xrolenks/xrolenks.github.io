'use strict';
// Fatal Fists - basics, fighters, moves, poses, settings
// ===== Basics =====
const W = 960, H = 540, GROUND = 470, GRAV = 0.8;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let S = 1;
const $ = id => document.getElementById(id);
const rnd = n => Math.floor(Math.random() * n);
const ease = k => k * k * (3 - 2 * k);

// ===== Fighters (our own characters) =====
// Every energy blast is down, forward + punch (Rick 2026-11-21; it was back, forward + punch, but walking back then
// forward + punch, e.g. to punish a missed attack, kept firing the blast by accident).
const DOWN_FWD_PUNCH = {dirs: ['down', 'fwd'], btn: 'punch'};
const FIGHTERS = [
  {id: 'kade', name: 'Kade', title: 'Street brawler', desc: 'Balanced and steady.',
   shirt: '#d8382c', pants: '#2a2a33', skin: '#e2a77c', hair: 'spiky', hairCol: '#24130d', band: '#f4f0e8', glove: '#8f1d16',
   speed: 3.4, power: 1.0, jump: 18,
   throwFx: '#ffa030',      // his hands light up in this colour while throwing (Rick 2026-11-21)
   // throwStyle: 'slam' (grab high, hoist overhead, slam into the floor) was his until Rick 2026-11-22 asked for a real
   // toss forward / behind instead; the slam code is kept in fight.js / draw.js in case it comes back.
   throwStyle: 'heave',     // arms round the waist, up onto the shoulder, heaved off forward / over behind (Rick 2026-11-22)
   throwReach: 14,          // his throw reaches this many px further (arms stretch further out, Rick 2026-11-22)
   fwdPunch: 'lungePunch',  // toward + punch = this move instead of the jab (Rick 2026-11-21); others: still the jab
   fwdKick: 'lungeKick',    // toward + kick = this move instead of the front kick; it can start a string ('fwdKick')
   backCharge: 'furnaceFist',      // back + HOLD punch = charge this move, let go to swing (a quick tap = jab)
   special: {name: 'Ember Shot', type: 'flame', color: '#ffb030', speed: 9, dmg: 9, seq: DOWN_FWD_PUNCH},
   // extra special moves (Rick 2026-11-21): done by a sequence like the blast, but each is a move in MOVES
   extras: [{name: 'Fiery Rush', move: 'fieryRush', seq: {dirs: ['down', 'fwd'], btn: 'kick'},
     desc: 'Rushes forward, leg out and on fire. Knocks down'},
    // Blaze Wheel: back, forward + kick since Rick 2026-11-22 (was down, back + kick, which now does Cinder Slide)
    {name: 'Blaze Wheel', move: 'blazeWheel', seq: {dirs: ['back', 'fwd'], btn: 'kick'},
     desc: 'Hops up and spins forward with a burning kick, up to 3 hits. Last hit knocks down'},
    {name: 'Cinder Slide', move: 'cinderSlide', seq: {dirs: ['down', 'back'], btn: 'kick'},
     desc: 'Slides low along the floor, under and past them to their other side. Knocks down'}]},
  {id: 'vex', name: 'Vex', title: 'Storm caller', desc: 'Slow, heavy energy blast.',
   shirt: '#7b4bd6', pants: '#1e1630', skin: '#c98d6a', hair: 'long', hairCol: '#e8e0ff', band: '#c7ff5a', glove: '#3a2466',
   speed: 3.1, power: 1.0, jump: 17.5,
   special: {name: 'Volt Orb', type: 'orb', color: '#c7ff5a', speed: 6.5, dmg: 11, seq: DOWN_FWD_PUNCH}},
  {id: 'rook', name: 'Rook', title: 'Mountain wrestler', desc: 'Slow, but hits hardest.',
   shirt: '#6b5a48', pants: '#3a3027', skin: '#8a5a3c', hair: 'bald', hairCol: '#1b120c', band: '#d9a441', glove: '#d9a441',
   speed: 2.7, power: 1.22, jump: 17,
   special: {name: 'Rock Toss', type: 'rock', color: '#b7a38a', speed: 8, dmg: 10, seq: DOWN_FWD_PUNCH}},
  {id: 'juno', name: 'Juno', title: 'Swift kicker', desc: 'Fast and light.',
   shirt: '#1fb5a3', pants: '#123a40', skin: '#f1c7a3', hair: 'tail', hairCol: '#ff6fa8', band: '#ff6fa8', glove: '#0e5f58',
   speed: 4.1, power: 0.88, jump: 19,
   special: {name: 'Tide Ring', type: 'ring', color: '#7ff4ff', speed: 11, dmg: 7, seq: DOWN_FWD_PUNCH}},
];
// special.seq = the input sequence that fires the special, e.g. {dirs: ['down', 'fwd'], btn: 'punch'}
// (directions: 'up', 'down', 'fwd' = toward the rival, 'back' = away; btn: 'punch' or 'kick'). null = no sequence yet.
// The directions must all be pointed within SEQ_WINDOW frames before the button is pressed.
const SEQ_WINDOW = 24;

// ===== Moves (frames at 60 per second; hit box relative to the feet, facing right) =====
const MOVES = {
  // recovery raised 2026-11-21 (Rick: attacks felt too spammable), so a missed attack leaves you open for longer.
  // Combo strings still flow, because a hit that connects cancels straight into the next move of the string.
  // level (Rick 2026-11-21): 'high' = crouching ducks it, standing block blocks it; 'low' = only a crouching block
  // blocks it; no level = mid, blocked standing or crouching. See levelOf / checkHit / applyHit in fight.js.
  // jab and cross: active 3 -> 5 and more hitstun (Rick 2026-11-21: more time to type a special after them)
  // blockstun on the plain hits (Rick 2026-11-21): about even when blocked (-1 / -2), so only finishers and specials
  // (BLOCK_PUNISH) can be punished. Without it the default 12 left these -6 or worse.
  // jab recovery 14 -> 20 + poke (arm can be hit while out), Rick 2026-11-21: a whiffed string starter can be punished
  // by walking back and using your own string. Blockstun / hitstun raised the same, so block / hit advantage is unchanged.
  punch:    {startup: 4, active: 5, recovery: 20, dmg: 5,  hitstun: 31, blockstun: 23, push: 3, poke: true, level: 'high', hit: {x: 24, y: -126, w: 52, h: 22}},
  // forward punch (toward + punch, FIGHTERS[].fwdPunch): Kade's lunge punch steps in and reaches ~25 px further than
  // the jab, but is slower to come out and to recover (-9 on block). Not a string starter; can special-cancel.
  // Poke (Rick 2026-11-21): about -2 on block (blockstun ≈ recovery), a little plus on hit, but a long recovery on a
  // miss, so a rival who back-dashes out of reach can dash back in and hit it before it recovers (whiff punish).
  // poke: true = the arm can be hit while it's out (hurtbox in fight.js)
  lungePunch: {startup: 8, active: 4, recovery: 28, dmg: 7, hitstun: 33, blockstun: 30, push: 6, poke: true, lunge: 3, level: 'high', wind: 'punchWind', hit: {x: 40, y: -128, w: 64, h: 24}},
  // forward kick (toward + kick, FIGHTERS[].fwdKick): Kade's lunge kick, like the lunge punch but slower. Starts the
  // Ashfall string (forward kick, kick, kick = lunge kick, low kick, axe kick).
  // same idea as the lunge punch, slower: about -2 on block, long recovery on a miss
  lungeKick:  {startup: 11, active: 4, recovery: 32, dmg: 8, hitstun: 37, blockstun: 34, push: 4, poke: true, lunge: 3, wind: 'chamber', hit: {x: 40, y: -112, w: 76, h: 30}},
  kick:     {startup: 7, active: 4, recovery: 21, dmg: 8,  hitstun: 26, blockstun: 22, push: 5, poke: true, hit: {x: 30, y: -110, w: 66, h: 26}},
  uppercut: {startup: 5, active: 4, recovery: 32, dmg: 12, knockdown: true, launch: -12, kb: 5, heavy: true, hit: {x: 16, y: -190, w: 44, h: 110}},
  // sweep: a full spin on the floor (spin: the body turns around once during startup, leg out).
  // startup 10 -> 16 (Rick 2026-11-21: spin was too fast; it now stays turned around longer)
  sweep:    {startup: 16, active: 5, recovery: 28, dmg: 7,  knockdown: true, launch: -5, kb: 2, spin: true, level: 'low', hit: {x: 20, y: -30, w: 84, h: 28}},
  // air punch (Rick 2026-11-21): an overhead (only a standing block stops it), and if it hits or is blocked, the first
  // press after landing continues any string that starts with a punch (AIR_STRING in fight.js). Hitstun 14 -> 24 so
  // that follow-up combos after landing.
  airPunch: {startup: 3, active: 8, recovery: 10, dmg: 6,  hitstun: 24, blockstun: 18, push: 3, air: true, level: 'overhead', hit: {x: 14, y: -112, w: 56, h: 58}},      // angled down, so it hits on the way down
  airKick:  {startup: 4, active: 12, recovery: 10, dmg: 9, hitstun: 20, push: 5, air: true, hit: {x: 22, y: -78, w: 82, h: 36}},      // leg stretched far out (Rick 2026-11-21)
  // throw (punch + kick together, Rick 2026-11-21): reaching grab; if it catches, both go into the throw animation
  // (states 'throwing' / 'held', THROW timings in fight.js). Missing it leaves you open (recovery).
  // Can't be blocked, but it's high (crouching ducks it), and the rival can break it (tech) with punch + kick.
  throw:    {startup: 4, active: 3, recovery: 24, dmg: 12, throw: true, heavy: true, level: 'high', hit: {x: 0, y: -140, w: 54, h: 120}},
  special:  {startup: 12, active: 1, recovery: 26, projectile: true, level: 'high'},
  // follow-up hits, only reachable inside a combo string (see STRINGS). lunge = steps forward this fast during startup.
  cross:      {startup: 4, active: 5, recovery: 15, dmg: 6,  hitstun: 28, blockstun: 18, push: 2, poke: true, lunge: 3, level: 'high', hit: {x: 26, y: -128, w: 56, h: 22}},
  lowKick:    {startup: 5, active: 3, recovery: 16, dmg: 6,  hitstun: 22, blockstun: 16, push: 2, lunge: 3, level: 'low', hit: {x: 24, y: -52, w: 62, h: 30}},
  knee:       {startup: 5, active: 3, recovery: 17, dmg: 7,  hitstun: 24, blockstun: 17, push: 2, lunge: 4, hit: {x: 10, y: -112, w: 50, h: 44}},
  hook:       {startup: 7, active: 3, recovery: 24, dmg: 10, hitstun: 28, push: 9, lunge: 2, heavy: true, level: 'high', wind: 'hookWind', hit: {x: 20, y: -146, w: 58, h: 34}},
  backfist:   {startup: 6, active: 3, recovery: 23, dmg: 9,  hitstun: 26, push: 8, lunge: 2, heavy: true, level: 'high', wind: 'spinWind', hit: {x: 24, y: -140, w: 62, h: 26}},
  roundhouse: {startup: 9, active: 4, recovery: 27, dmg: 11, knockdown: true, launch: -8, kb: 6, lunge: 2, heavy: true, level: 'high', wind: 'chamber', hit: {x: 26, y: -164, w: 74, h: 44}},
  // launchers: end a string by knocking the rival up into the air for a juggle (juggle: true, launch = how hard)
  riser:      {startup: 8, active: 4, recovery: 12, dmg: 8, juggle: true, launch: -13, kb: 0.4, lunge: 3, heavy: true, wind: 'crouch', hit: {x: 14, y: -190, w: 52, h: 112}},
  skyKick:    {startup: 9, active: 4, recovery: 12, dmg: 8, juggle: true, launch: -13, kb: 0.4, lunge: 3, heavy: true, wind: 'chamber', hit: {x: 16, y: -176, w: 62, h: 100}},
  // Kade's Fiery Rush (special, down, forward + kick since 2026-11-21; was + punch): rush = slides forward this fast from just before the hit until
  // it connects or ends; fire = flames on the front leg (drawLegFire) + a trail of flames (flames in update.js)
  // rush 9.5 -> 12, active 16 -> 18 (Rick 2026-11-21: travel farther, ~250 px if it doesn't hit)
  fieryRush:  {startup: 9, active: 18, recovery: 24, dmg: 11, knockdown: true, launch: -7, kb: 6, rush: 12, fire: true, heavy: true, wind: 'crouch', hit: {x: 30, y: -120, w: 76, h: 48}},
  // Kade's Cinder Slide (special, down, back + kick, Rick 2026-11-22): slides along the floor (rush) leg first with a
  // burning foot. through = keeps sliding after it hits, right under and past them, so he ends up on their other side
  // (separate() lets him pass while sliding). Low: only a crouching block stops it; blocked = stops at their guard and
  // is punishable. Knocks down with almost no push, so the slide carries on past the fallen rival. Ducks highs (isLow).
  cinderSlide: {startup: 8, active: 22, recovery: 18, dmg: 9, knockdown: true, launch: -4, kb: 0.5, rush: 11, through: true,
    fire: true, fireY: 10, heavy: true, level: 'low', wind: 'crouch', hit: {x: 20, y: -44, w: 66, h: 44}},
  // Kade's Blaze Wheel (special, back, forward + kick since 2026-11-22; first down, back + kick, Rick 2026-11-21): hops up and spins spinN times while gliding
  // forward (rush), burning leg out; up to `hits` hits, hitEvery frames apart, only the last knocks down. High, so
  // crouching ducks it. Punishable on block (BLOCK_PUNISH).
  blazeWheel: {startup: 10, active: 24, recovery: 18, dmg: 5, knockdown: true, launch: -7, kb: 5, rush: 6, hits: 3, hitEvery: 8,
    spinN: 3, fire: true, fireY: 108, heavy: true, level: 'high', wind: 'crouch', hit: {x: 8, y: -134, w: 84, h: 52}},
  // Kade's Furnace Fist (Rick 2026-11-21): back + hold punch charges (state 'charging', CHARGE_* in fight.js), letting
  // go swings this. f.charge 0..1 adds dmgCharge damage and kbCharge knockback. Can be hit all through the charge and
  // the long recovery, but a block shoves the rival far away (blockPush), so it's hard to punish when blocked.
  furnaceFist: {startup: 6, active: 4, recovery: 34, dmg: 12, dmgCharge: 12, knockdown: true, launch: -6, kb: 8, kbCharge: 6,
    blockstun: 20, blockPush: 22, lunge: 7, heavy: true, basePose: 'furnaceWind', heat: true, hit: {x: 44, y: -128, w: 68, h: 30}},
  // axe kick (end of Ashfall): leg swung up over their head, then chopped down onto it. Overhead (Rick 2026-11-21):
  // hits crouching fighters and goes through a crouching block; only a standing block stops it. Knocks down.
  axeKick:    {startup: 12, active: 4, recovery: 26, dmg: 11, knockdown: true, launch: -5, kb: 4, lunge: 2, heavy: true, level: 'overhead', wind: 'axeUp', hit: {x: 22, y: -172, w: 70, h: 92}},
  hammer:     {startup: 10, active: 3, recovery: 29, dmg: 12, knockdown: true, launch: -4, kb: 3, lunge: 2, heavy: true, wind: 'hammerUp', hit: {x: 18, y: -150, w: 58, h: 80}},
};
// Punishable on block (Rick 2026-11-21): when one of these moves is blocked, its recovery gets this many extra frames,
// so the defender has time to hit back. Combo finishers, launchers and specials. A blocked one also can't be
// special-cancelled to escape. (Throws can't be blocked; the energy blast is thrown from far away.)
const BLOCK_PUNISH = {hook: 12, backfist: 12, roundhouse: 14, hammer: 14, riser: 18, skyKick: 18, fieryRush: 12, blazeWheel: 14,
  axeKick: 14, cinderSlide: 14};
// Combo strings: press these buttons one after another; each press after the first is only taken while the
// previous hit connects (hits or is blocked), and turns into that string's next move instead of a plain punch/kick.
// btns[0] is a normal standing punch or kick (moves[0] = 'punch' / 'kick'), or 'fwdKick' = toward + kick
// (moves[0] = that fighter's fwdKick move).
const STRINGS = {
  kade: [
    {name: 'Street Rush',   btns: ['punch', 'punch', 'punch'], moves: ['punch', 'cross', 'hook']},
    {name: 'Alley Spin',    btns: ['punch', 'punch', 'kick'],  moves: ['punch', 'cross', 'roundhouse']},
    {name: 'Updraft',       btns: ['punch', 'kick', 'punch'],  moves: ['punch', 'lowKick', 'riser']},
    // starts with the forward kick ('fwdKick' = toward + kick); 2nd hits low, 3rd comes down over the head (high)
    {name: 'Ashfall',       btns: ['fwdKick', 'kick', 'kick'], moves: ['lungeKick', 'lowKick', 'axeKick']},
  ],
  vex: [
    {name: 'Static Burst',  btns: ['punch', 'punch', 'punch'], moves: ['punch', 'cross', 'backfist']},
    {name: 'Low Thunder',   btns: ['punch', 'kick', 'punch'],  moves: ['punch', 'lowKick', 'backfist']},
    {name: 'Thunderhead',   btns: ['punch', 'punch', 'kick'],  moves: ['punch', 'cross', 'skyKick']},
  ],
  rook: [
    {name: 'Landslide',     btns: ['punch', 'punch', 'punch'], moves: ['punch', 'cross', 'hammer']},
    {name: 'Boulder Break', btns: ['punch', 'kick', 'punch'],  moves: ['punch', 'knee', 'hook']},
    {name: 'Eruption',      btns: ['kick', 'punch', 'punch'],  moves: ['kick', 'cross', 'riser']},
  ],
  juno: [
    {name: 'Whirlpool',     btns: ['kick', 'kick', 'kick'],    moves: ['kick', 'lowKick', 'roundhouse']},
    {name: 'Riptide',       btns: ['punch', 'kick', 'kick'],   moves: ['punch', 'knee', 'roundhouse']},
    {name: 'Waterspout',    btns: ['kick', 'punch', 'kick'],   moves: ['kick', 'cross', 'skyKick']},
  ],
};
// Names shown in the move list
const MOVE_NAMES = {punch: 'Jab', kick: 'Front kick', cross: 'Cross', lowKick: 'Low kick', knee: 'Knee',
  hook: 'Hook', backfist: 'Spinning backfist', roundhouse: 'Roundhouse (knocks down)', hammer: 'Hammer fist (knocks down)',
  riser: 'Rising uppercut (launches)', skyKick: 'Sky kick (launches)', fieryRush: 'Fiery Rush', lungePunch: 'Lunge punch', blazeWheel: 'Blaze Wheel', cinderSlide: 'Cinder Slide', lungeKick: 'Lunge kick', furnaceFist: 'Furnace Fist',
  axeKick: 'Axe kick (knocks down)'};
const SPECIAL_WAIT = 80;
// attack level: 'high', 'mid', 'low' or 'overhead' (energy blasts are high). Overhead = the opposite of low:
// it reaches crouching fighters (like a mid) but only a standing block stops it.
const levelOf = M => M.level || 'mid';

// ===== Poses (facing right, origin at the feet, y up is negative) =====
const P = {
  idle:     {hip: [0, -72], neck: [5, -124], head: [8, -143], hF: [30, -112], hB: [16, -120], fF: [20, 0], fB: [-20, 0]},
  crouch:   {hip: [0, -40], neck: [12, -86], head: [16, -104], hF: [32, -76], hB: [20, -84], fF: [26, 0], fB: [-24, 0]},
  jump:     {hip: [0, -78], neck: [2, -130], head: [4, -149], hF: [26, -128], hB: [-14, -124], fF: [16, -40], fB: [-12, -48]},
  tuck:     {hip: [-2, -92], neck: [12, -128], head: [20, -142], hF: [30, -100], hB: [22, -96], fF: [20, -86], fB: [10, -80]},      // curled up mid-jump
  block:    {hip: [-2, -72], neck: [-2, -124], head: [0, -143], hF: [22, -140], hB: [18, -126], fF: [18, 0], fB: [-24, 0]},
  cblock:   {hip: [0, -40], neck: [8, -86], head: [12, -104], hF: [26, -104], hB: [22, -92], fF: [26, 0], fB: [-24, 0]},
  hit:      {hip: [-4, -72], neck: [-16, -120], head: [-24, -136], hF: [-2, -96], hB: [-14, -100], fF: [16, 0], fB: [-24, 0]},
  fall:     {hip: [0, -60], neck: [-36, -96], head: [-50, -108], hF: [-20, -130], hB: [-40, -120], fF: [30, -90], fB: [24, -70]},
  lie:      {hip: [0, -12], neck: [-52, -14], head: [-70, -16], hF: [-30, -6], hB: [-58, -4], fF: [46, -6], fB: [40, -14]},
  punch:    {hip: [4, -72], neck: [16, -122], head: [20, -140], hF: [68, -118], hB: [10, -114], fF: [30, 0], fB: [-22, 0]},
  kick:     {hip: [-6, -74], neck: [-20, -120], head: [-26, -137], hF: [8, -108], hB: [-6, -112], fF: [78, -100], fB: [-10, 0]},
  uppercut: {hip: [6, -68], neck: [18, -122], head: [22, -141], hF: [34, -178], hB: [0, -104], fF: [28, 0], fB: [-22, 0]},
  sweep:    {hip: [-4, -30], neck: [-26, -66], head: [-36, -80], hF: [-6, -46], hB: [-34, -4], fF: [80, -8], fB: [-14, 0]},
  airPunch: {hip: [0, -80], neck: [12, -128], head: [17, -145], hF: [56, -78], hB: [2, -118], fF: [14, -44], fB: [-14, -50]},      // punching down and forward
  airKick:  {hip: [-6, -82], neck: [-22, -126], head: [-30, -142], hF: [6, -116], hB: [-18, -120], fF: [72, -62], fB: [-14, -50]},
  throw:    {hip: [4, -72], neck: [14, -124], head: [18, -142], hF: [48, -128], hB: [44, -110], fF: [28, 0], fB: [-22, 0]},
  // heave throw (throwStyle 'heave', Kade; Rick 2026-11-22). Hands are put on the rival's waist by throwGrip.
  heaveGrab:  {hip: [10, -62], neck: [32, -106], head: [40, -121], hF: [60, -74], hB: [54, -70], fF: [36, 0], fB: [-26, 0]},      // bent in, arms round the waist
  heaveLift:  {hip: [0, -72], neck: [0, -124], head: [-6, -142], hF: [16, -132], hB: [10, -126], fF: [26, 0], fB: [-26, 0]},      // stood up, rival on the shoulder
  heaveFwd:   {hip: [12, -68], neck: [32, -114], head: [40, -130], hF: [92, -122], hB: [86, -114], fF: [42, 0], fB: [-24, 0]},      // hurling them out in front, arms stretched
  heaveBack:  {hip: [-6, -68], neck: [-22, -114], head: [-30, -130], hF: [-70, -82], hB: [-66, -76], fF: [28, 0], fB: [-30, 0]},      // twisting back over the shoulder, arms stretched
  // the rival during a heave, drawn before it's turned a quarter turn (heldRot): after turning, the legs hang down in
  // front of the thrower and the upper body hangs down his back, bent over the shoulder at the waist
  draped:     {hip: [0, -72], neck: [22, -117], head: [31, -135], hF: [70, -112], hB: [64, -106], fF: [68, -42], fB: [60, -36]},
  // long-armed grab (fighters with throwReach, Kade; Rick 2026-11-22): leaning in, both arms stretched right out
  throwFar: {hip: [10, -70], neck: [26, -120], head: [32, -138], hF: [80, -124], hB: [74, -110], fF: [38, 0], fB: [-24, 0]},
  // throw animation (attacker): lift the rival up, then heave them forward (throwToss) or swing them over the head (throwBack)
  throwLift:  {hip: [0, -70], neck: [-4, -122], head: [-6, -141], hF: [30, -168], hB: [22, -162], fF: [24, 0], fB: [-26, 0]},
  throwToss:  {hip: [10, -68], neck: [30, -114], head: [37, -129], hF: [74, -100], hB: [68, -92], fF: [36, 0], fB: [-22, 0]},
  // Blaze Wheel: off the ground (whole pose ~30 px up), kicking leg straight out at chest height, other leg tucked
  // Cinder Slide: leaning right back, low to the floor, front leg straight out along the ground, back hand trailing
  cinderSlide: {hip: [0, -24], neck: [-36, -52], head: [-48, -66], hF: [-14, -40], hB: [-50, -12], fF: [76, -6], fB: [24, 0]},
  blazeWheel: {hip: [0, -102], neck: [-6, -152], head: [-9, -170], hF: [16, -140], hB: [-18, -136], fF: [78, -108], fB: [-4, -66]},
  // Furnace Fist: wound up in a low, wide stance (Rick 2026-11-22: feet further apart, only the punching fist pulled
  // back to the hip, elbow pointing back, the other one stays up in front as a guard), then a huge straight punch stepping in
  furnaceWind: {hip: [-6, -52], neck: [-10, -102], head: [-14, -120], hF: [-16, -60], hB: [24, -96], fF: [44, 0], fB: [-48, 0]},
  // (Rick 2026-11-22: lunges deeper, front foot further out and the arm reaching ~10 px further)
  furnaceFist: {hip: [22, -62], neck: [46, -106], head: [54, -121], hF: [106, -112], hB: [24, -98], fF: [62, 0], fB: [-30, 0]},
  // lunge kick: leaning back, front leg driven straight out at stomach height
  lungeKick:  {hip: [10, -74], neck: [-6, -120], head: [-13, -136], hF: [18, -108], hB: [-2, -112], fF: [90, -90], fB: [-10, 0]},
  // axe kick: leg raised straight up past the head (axeUp), then brought down in front at head height (axeKick)
  axeUp:      {hip: [-4, -74], neck: [-14, -122], head: [-19, -140], hF: [12, -110], hB: [-8, -114], fF: [24, -152], fB: [-16, 0]},
  axeKick:    {hip: [6, -70], neck: [2, -120], head: [0, -138], hF: [26, -108], hB: [6, -112], fF: [78, -100], fB: [-18, 0]},
  // lunge punch: draw the fist back, then step in with the arm fully stretched out
  punchWind:  {hip: [-4, -72], neck: [-6, -122], head: [-8, -140], hF: [-6, -112], hB: [20, -122], fF: [24, 0], fB: [-22, 0]},
  lungePunch: {hip: [14, -68], neck: [34, -114], head: [41, -130], hF: [94, -122], hB: [12, -110], fF: [48, 0], fB: [-26, 0]},
  // slam throws (throwStyle 'slam'): bent forward over the slam in front, or twisted back over a slam behind
  slam:       {hip: [14, -58], neck: [40, -96], head: [51, -107], hF: [74, -46], hB: [68, -40], fF: [44, 0], fB: [-26, 0]},      // lunging into it
  slamBack:   {hip: [-8, -64], neck: [-30, -106], head: [-42, -116], hF: [-56, -46], hB: [-60, -40], fF: [28, 0], fB: [-30, 0]},
  throwBack:  {hip: [-6, -70], neck: [-22, -120], head: [-28, -137], hF: [-52, -122], hB: [-58, -114], fF: [26, 0], fB: [-28, 0]},
  special:  {hip: [-2, -72], neck: [8, -124], head: [12, -142], hF: [58, -118], hB: [54, -106], fF: [26, 0], fB: [-26, 0]},
  dashf:    {hip: [2, -64], neck: [20, -112], head: [27, -128], hF: [36, -100], hB: [26, -108], fF: [24, -10], fB: [-34, -4]},
  dashb:    {hip: [-2, -66], neck: [-12, -116], head: [-18, -133], hF: [20, -124], hB: [12, -116], fF: [30, -4], fB: [-20, -12]},
  // combo string moves
  cross:      {hip: [8, -72], neck: [22, -122], head: [27, -140], hF: [26, -118], hB: [76, -122], fF: [32, 0], fB: [-16, 0]},
  lowKick:    {hip: [-4, -70], neck: [-10, -122], head: [-14, -140], hF: [22, -114], hB: [8, -118], fF: [74, -26], fB: [-14, 0]},
  knee:       {hip: [6, -76], neck: [14, -126], head: [18, -144], hF: [42, -132], hB: [36, -122], fF: [22, -58], fB: [-18, 0]},
  hook:       {hip: [6, -72], neck: [22, -120], head: [28, -136], hF: [60, -138], hB: [6, -112], fF: [32, 0], fB: [-20, 0]},
  backfist:   {hip: [2, -72], neck: [8, -124], head: [10, -142], hF: [78, -130], hB: [-22, -110], fF: [28, 0], fB: [-26, 0]},
  roundhouse: {hip: [-8, -78], neck: [-26, -118], head: [-34, -134], hF: [-4, -112], hB: [-22, -102], fF: [74, -146], fB: [-10, 0]},
  riser:      {hip: [8, -80], neck: [18, -132], head: [22, -151], hF: [40, -192], hB: [2, -112], fF: [26, -6], fB: [-20, 0]},
  skyKick:    {hip: [-8, -80], neck: [-26, -122], head: [-34, -138], hF: [-4, -110], hB: [-22, -100], fF: [42, -140], fB: [-10, 0]},
  // leaning back, front leg fully straight and raised to about chest height (Rick 2026-11-21: higher, more extended)
  fieryRush:  {hip: [-8, -66], neck: [-34, -110], head: [-45, -123], hF: [-6, -104], hB: [-42, -86], fF: [70, -96], fB: [-30, 0]},
  hammer:     {hip: [6, -64], neck: [26, -110], head: [32, -126], hF: [62, -96], hB: [54, -92], fF: [32, 0], fB: [-24, 0]},
  // wind-ups: a move with wind: 'name' goes idle -> wind-up -> hit pose during its startup
  hookWind:   {hip: [0, -72], neck: [2, -122], head: [4, -140], hF: [-8, -124], hB: [18, -122], fF: [24, 0], fB: [-22, 0]},
  spinWind:   {hip: [0, -72], neck: [-8, -122], head: [-12, -140], hF: [-26, -116], hB: [-32, -106], fF: [22, 0], fB: [-24, 0]},
  chamber:    {hip: [-4, -76], neck: [-12, -124], head: [-16, -142], hF: [12, -110], hB: [-8, -114], fF: [30, -72], fB: [-10, 0]},
  hammerUp:   {hip: [0, -74], neck: [4, -126], head: [6, -145], hF: [16, -192], hB: [8, -186], fF: [24, 0], fB: [-20, 0]},
  win:      {hip: [0, -74], neck: [2, -126], head: [4, -145], hF: [14, -196], hB: [-16, -106], fF: [18, 0], fB: [-18, 0]},
};
function clonePose(p) { const o = {}; for (const k in p) o[k] = [p[k][0], p[k][1]]; return o; }
function lerpPose(a, b, k) {
  const o = {};
  for (const n in a) o[n] = [a[n][0] + (b[n][0] - a[n][0]) * k, a[n][1] + (b[n][1] - a[n][1]) * k];
  return o;
}

// ===== Settings (localStorage key: fatalfists.settings) =====
const SAVEKEY = 'fatalfists.settings';
let settings = {muted: false, level: 1};
try { Object.assign(settings, JSON.parse(localStorage.getItem(SAVEKEY) || '{}')); } catch (e) {}
function saveSettings() { try { localStorage.setItem(SAVEKEY, JSON.stringify(settings)); } catch (e) {} }

