'use strict';
// Fatal Fists - the computer fighter
// ===== Computer fighter =====
const AI_LEVELS = [
  {react: 30, block: 0.2, dodge: 0.2, anti: 0.15, aggr: 0.35, spec: 0.15},
  {react: 16, block: 0.5, dodge: 0.5, anti: 0.45, aggr: 0.5, spec: 0.3},
  {react: 7, block: 0.8, dodge: 0.85, anti: 0.8, aggr: 0.62, spec: 0.35},
];
// energy blast: this fighter's own motion, like a player has to do it (F/B = the key toward / away from the rival)
function blastMotion(me, F, B, think) { return seqMotion(me.def.special.seq, F, B, think); }
// any special sequence, e.g. {dirs: ['down', 'fwd'], btn: 'punch'}: each direction held 3 frames, then the button
function seqMotion(seq, F, B, think) {
  const key = d => d === 'fwd' ? F : d === 'back' ? B : d;
  const steps = seq.dirs.map(d => ({h: {[key(d)]: true}, d: 3}));
  steps.push({h: {[key(seq.dirs[seq.dirs.length - 1])]: true}, p: seq.btn, d: 40}, {d: think});
  return steps;
}
function aiPlan(me, foe, dist, F, B, L) {
  const r = Math.random();
  const think = L.react + rnd(L.react);
  // rival launched into the air: Normal / Hard keep hitting them (punches, then an uppercut)
  if (foe.state === 'juggle' && G.level > 0 && dist < 170) {
    // an extend-juggle special (Vex's Sky Bolt) pops them back up
    const ext = (me.def.extras || []).find(x => MOVES[x.move].extend);
    if (ext && dist < 110 && r < 0.35) return seqMotion(ext.seq, F, B, 6);
    if (r < 0.5) return [{h: {[F]: dist > 60}, d: 3}, {p: 'punch', d: 12}];
    return [{h: {[F]: dist > 60}, d: 3}, {h: {down: true}, p: 'punch', d: 14}];
  }
  if (FLOORED.has(foe.state) || foe.state === 'juggle' || foe.state === 'getup') return [{h: {[F]: dist > 120}, d: 10}, {d: 8}];
  if (dist > 300) {
    if (me.cd <= 0 && r < L.spec) return blastMotion(me, F, B, think);
    return [{h: {[F]: true}, d: 20 + rnd(25)}];
  }
  if (dist > 110) {
    // Vex (zoner) also calls down Smite from mid range, not only from far away (else his Ground Pulse crowds it out)
    if (me.def.special.type === 'smite' && me.cd <= 0 && Math.random() < L.spec * 0.5) return blastMotion(me, F, B, think);
    // extra specials (Kade's Fiery Rush / Blaze Wheel, Vex's Ground Pulse) from a short way off
    // (not close-range ones like Vex's Shockwave, which would just miss from here)
    const exs = (me.def.extras || []).filter(x => !MOVES[x.move].close && !MOVES[x.move].antiAir), ex = exs[rnd(exs.length)];      // one of this fighter's extra specials
    if (ex && G.level > 0 && dist < 330 && Math.random() < 0.18) return seqMotion(ex.seq, F, B, think);
    // charge move (Kade's Furnace Fist): back + hold punch for a while, then let go
    if (me.def.backCharge && G.level > 0 && dist < 170 && Math.random() < 0.2)
      return [{h: {[B]: true, punch: true}, p: 'punch', d: 3}, {h: {punch: true}, d: 12 + rnd(45)}, {d: think}];
    // just outside jab range: forward punch (Kade's lunge punch reaches further)
    if (me.def.fwdPunch && dist < 135 && Math.random() < 0.35) return [{h: {[F]: true}, p: 'punch', d: 34}, {d: think}];
    if (me.def.fwdKick && dist < 150 && Math.random() < 0.25) return [{h: {[F]: true}, p: 'kick', d: 42}, {d: think}];
    if (r < L.aggr * 0.35) {
      // jump in: Normal / Hard sometimes air punch (overhead) and carry on with a string as they land
      if (G.level > 0 && Math.random() < 0.5) return [{h: {up: true, [F]: true}, d: 2}, {d: 22 + rnd(6)}, {p: 'punch', d: 12}, {p: 'punch', d: 9}, {p: 'punch', d: 30}];
      return [{h: {up: true, [F]: true}, d: 2}, {d: 18 + rnd(8)}, {p: 'kick', d: 30}];
    }
    if (me.cd <= 0 && r < L.aggr * 0.35 + L.spec * 0.5) return blastMotion(me, F, B, think);
    // dash in and punch (double tap toward the rival)
    if (G.level > 0 && dist < 200 && r < 0.62) return [{p: F, d: 3}, {p: F, d: 7}, {p: 'punch', d: 22}, {d: think}];
    if (r < 0.8) return [{h: {[F]: true}, d: 15 + rnd(20)}];
    if (r < 0.9) return [{h: {[B]: true}, d: 12 + rnd(12)}];
    return [{d: think}];
  }
  // rival right in our face: a close-range "get off me" special (Vex's Shockwave) pushes them back out
  const away = (me.def.extras || []).find(x => MOVES[x.move].close);
  if (away && G.level > 0 && dist < 100 && Math.random() < (G.level === 2 ? 0.3 : 0.18)) return seqMotion(away.seq, F, B, think);
  const crouching = foe.state === 'crouch' || foe.state === 'cblock';
  // rival standing and blocking: a sweep (low) gets under their guard
  if (foe.state === 'block' && r < L.aggr) return [{h: {down: true}, p: 'kick', d: 50}, {d: think}];
  if (r < L.aggr) {
    const c = Math.random();
    // Normal / Hard: sometimes go for one of this fighter's combo strings
    const strs = STRINGS[me.def.id];
    // Normal / Hard: sometimes punch, punch, then cancel into an extra special (Kade: Fiery Rush)
    const exs = me.def.extras || [], ex = exs[rnd(exs.length)];
    if (ex && G.level > 0 && Math.random() < (G.level === 2 ? 0.2 : 0.1)) {
      return [{p: 'punch', d: 8}, {p: 'punch', d: 3}].concat(seqMotion(ex.seq, F, B, think));
    }
    if (G.level > 0 && strs && Math.random() < (G.level === 2 ? 0.4 : 0.22)) {
      const s = strs[rnd(strs.length)];
      // 'fwdKick' = hold toward + kick; later presses come 12 frames apart (the slow forward kick needs time to land)
      const gap = s.btns[0] === 'fwdKick' ? 14 : 8;
      return s.btns.map((b, i) => ({h: b === 'fwdKick' ? {[F]: true} : {}, p: b === 'fwdKick' ? 'kick' : b,
        d: i === s.btns.length - 1 ? 40 : gap})).concat([{d: think}]);
    }
    if (crouching) return c < 0.5 ? [{p: 'kick', d: 24}, {d: think}] : [{h: {down: true}, p: 'kick', d: 30}, {d: think}];
    if (c < 0.3) {
      if (G.level === 2 && Math.random() < 0.5) return [{p: 'punch', d: 9}, {p: 'punch', d: 9}, {h: {down: true}, p: 'punch', d: 32}];
      return [{p: 'punch', d: 14}, {d: think}];
    }
    if (c < 0.55) return [{p: 'kick', d: 24}, {d: think}];
    if (c < 0.7) return [{h: {down: true}, p: 'kick', d: 30}, {d: think}];
    // throw: punch + kick together; sometimes holding away for a backward toss
    if (c < 0.82 && dist < 78) return [{h: {[B]: Math.random() < 0.4}, p: ['punch', 'kick'], d: 50}];
    return [{h: {down: true}, p: 'punch', d: 32}];
  }
  if (r < L.aggr + 0.15) return [{h: {block: true}, d: 20 + rnd(20)}];
  if (r < L.aggr + 0.22 && G.level > 0) return [{p: B, d: 3}, {p: B, d: 18}];      // back dash out of range
  if (r < L.aggr + 0.3) return [{h: {[B]: true}, d: 15 + rnd(15)}];
  return [{d: think}];
}
function aiThink(me, foe) {
  const L = AI_LEVELS[G.level], A = me.ai;
  const dist = Math.abs(foe.x - me.x);
  const F = foe.x > me.x ? 'right' : 'left', B = F === 'right' ? 'left' : 'right';
  if (!A.react && me.onGround) {
    const M = foe.state === 'attack' ? MOVES[foe.move] : null;
    // rival stuck recovering from a blocked finisher / special (BLOCK_PUNISH): Normal / Hard hit back
    if (M && foe.blockedExtra && foe.t >= M.startup + M.active && dist < 120 && G.level > 0 &&
        ACTIONABLE.has(me.state) && Math.random() < L.block * 0.5) {
      A.q = Math.random() < 0.5 ? [{h: {[F]: dist > 80}, p: 'punch', d: 7}, {p: 'punch', d: 30}, {d: L.react}]
        : [{h: {down: true, [F]: false}, p: 'punch', d: 38}, {d: L.react}];
      A.react = true;
    }
    // rival's poke missed (M.poke, past its active frames without touching us): step in and jab before it recovers
    if (!A.react && M && M.poke && !foe.moveHit && foe.t >= M.startup + M.active && dist < 190 && G.level > 0 &&
        ACTIONABLE.has(me.state) && Math.random() < L.block * 0.5) {
      A.q = [{h: {[F]: true}, d: Math.max(0, Math.ceil((dist - 100) / me.def.speed))}, {p: 'punch', d: 7}, {p: 'punch', d: 30}, {d: L.react}];
      A.react = true;
    }
    // rival charging up (can be hit the whole time): Normal / Hard rush in and hit them first
    if (!A.react && foe.state === 'charging' && dist < 150 && G.level > 0 && ACTIONABLE.has(me.state) && Math.random() < L.block * 0.15) {
      A.q = [{h: {[F]: true}, d: Math.max(0, Math.ceil((dist - 90) / me.def.speed))}, {p: 'punch', d: 7}, {p: 'punch', d: 30}, {d: L.react}];
      A.react = true;
    }
    // rival going for a throw: break it with punch + kick, or duck under it (throws are high)
    if (!A.react && M && M.throw && dist < 110 && Math.random() < L.block * 0.18) {
      A.q = Math.random() < 0.6 ? [{p: ['punch', 'kick'], d: 16}] : [{h: {down: true}, d: 20}];
      A.react = true;
    }
    if (!A.react && M && !M.projectile && !M.throw && dist < 160 && foe.t <= M.startup && Math.random() < L.block * 0.3) {
      // low attacks need a crouching block; high ones can also just be ducked
      const lv = levelOf(M);
      A.q = lv === 'high' && Math.random() < 0.4 ? [{h: {down: true}, d: 16 + rnd(10)}]
        : [{h: {block: true, down: lv === 'low'}, d: 16 + rnd(10)}];
      A.react = true;
    }
    // Vex's Smite marked under us (fight.js): stand-block it (overhead, so not crouching) or back-dash out of the spot
    const sm = G.projectiles.find(p => p.owner === foe && p.s.type === 'smite' && p.t < SMITE_WARN && Math.abs(me.x - p.x) < SMITE_HALF + 40);
    if (!A.react && sm && Math.random() < L.dodge * 0.3) {
      A.q = Math.random() < 0.5 ? [{h: {block: true}, d: SMITE_WARN - sm.t + SMITE_ACTIVE + 4}] : [{p: B, d: 3}, {p: B, d: 18}];
      A.react = true;
    }
    const pr = G.projectiles.find(p => p.owner === foe && p.s.type !== 'smite' && Math.sign(me.x - p.x) === Math.sign(p.vx) && Math.abs(me.x - p.x) < 200);
    if (!A.react && pr && Math.random() < L.dodge * 0.12) {
      // Vex's Ground Pulse is low: crouch-block it or jump over it (just ducking doesn't help)
      if (pr.s.type === 'pulse') A.q = Math.random() < 0.6 ? [{h: {block: true, down: true}, d: 30}] : [{h: {up: true}, d: 3}, {d: 30}];
      else A.q = Math.random() < 0.6 ? [{h: {down: true}, d: 30}] : [{h: {up: true, [F]: true}, d: 3}, {d: 20}];
      A.react = true;
    }
    // an anti-air special (Vex's Sky Bolt): start the motion a little early, it takes a few frames to type
    const ax = (me.def.extras || []).find(x => MOVES[x.move].antiAir);
    if (!A.react && ax && !foe.onGround && foe.state === 'jump' && foe.vy > -6 && dist < 170 && Math.random() < L.anti * 0.2) {
      A.q = seqMotion(ax.seq, F, B, 10); A.react = true;
    }
    if (!A.react && !foe.onGround && foe.state === 'jump' && foe.vy > -2 && dist < 120 && Math.random() < L.anti * 0.15) {
      A.q = [{h: {down: true}, p: 'punch', d: 22}]; A.react = true;
    }
  }
  if (!A.q.length) { A.react = false; A.q = aiPlan(me, foe, dist, F, B, L); }
  const s = A.q[0];
  const out = {held: Object.assign({}, s.h || {}), press: []};
  if (!s.started) { s.started = true; if (s.p) out.press.push(...[].concat(s.p)); }      // p can be a list (punch + kick)
  if (--s.d <= 0) A.q.shift();
  return out;
}

