'use strict';
// Fatal Fists - drawing: arena, fighters, blasts, HUD
// ===== Drawing: background (drawn once) =====
const bg = document.createElement('canvas');
function seeded(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
function buildBg() {
  bg.width = W * S; bg.height = H * S;
  const c = bg.getContext('2d');
  c.setTransform(S, 0, 0, S, 0, 0);
  const g = c.createLinearGradient(0, 0, 0, 420);
  g.addColorStop(0, '#12030a'); g.addColorStop(0.6, '#3d0b0e'); g.addColorStop(1, '#6a1a12');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = seeded(7);
  c.fillStyle = '#ffd9c8';
  for (let i = 0; i < 70; i++) { c.globalAlpha = 0.2 + r() * 0.6; c.fillRect(r() * W, r() * 260, 1.5, 1.5); }
  c.globalAlpha = 1;
  // moon
  const mg = c.createRadialGradient(640, 150, 40, 640, 150, 200);
  mg.addColorStop(0, 'rgba(255,120,80,.45)'); mg.addColorStop(1, 'rgba(255,120,80,0)');
  c.fillStyle = mg; c.fillRect(400, 0, 480, 360);
  c.fillStyle = '#ff9a6a'; c.beginPath(); c.arc(640, 150, 70, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(180,60,40,.35)';
  [[620, 130, 14], [665, 170, 10], [650, 120, 6], [610, 175, 8]].forEach(([x, y, rr]) => { c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.fill(); });
  // far mountains
  c.fillStyle = '#2a0a0e';
  c.beginPath(); c.moveTo(0, 360);
  const r2 = seeded(3);
  for (let x = 0; x <= W; x += 40) c.lineTo(x, 280 + r2() * 70);
  c.lineTo(W, 420); c.lineTo(0, 420); c.fill();
  c.fillStyle = '#1c0609';
  c.beginPath(); c.moveTo(0, 380);
  for (let x = 0; x <= W; x += 60) c.lineTo(x, 330 + r2() * 50);
  c.lineTo(W, 420); c.lineTo(0, 420); c.fill();
  // arena wall with battlements
  c.fillStyle = '#24100f'; c.fillRect(0, 372, W, 60);
  for (let x = 0; x < W; x += 48) c.fillRect(x, 358, 28, 16);
  c.strokeStyle = '#1a0a09'; c.lineWidth = 2;
  for (let y = 388; y < 432; y += 15) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  for (let y = 372, row = 0; y < 432; y += 15, row++) for (let x = row % 2 ? 0 : 24; x < W; x += 48) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 15); c.stroke(); }
  // banners with our fist emblem
  [250, 710].forEach(x => {
    c.fillStyle = '#7a1612';
    c.beginPath(); c.moveTo(x - 26, 300); c.lineTo(x + 26, 300); c.lineTo(x + 26, 400); c.lineTo(x, 386); c.lineTo(x - 26, 400); c.fill();
    c.fillStyle = '#4a0c0a'; c.fillRect(x - 30, 296, 60, 6);
    c.fillStyle = '#ffcf5a';
    c.beginPath(); c.arc(x, 340, 15, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a1612';
    c.fillRect(x - 8, 333, 16, 12); c.fillRect(x - 8, 345, 9, 4);
    c.fillStyle = '#ffcf5a';
    for (let i = 0; i < 3; i++) c.fillRect(x - 6, 336 + i * 3, 12, 1.2);
  });
  // floor
  const fg = c.createLinearGradient(0, 432, 0, H);
  fg.addColorStop(0, '#3a1c16'); fg.addColorStop(1, '#140807');
  c.fillStyle = fg; c.fillRect(0, 432, W, H - 432);
  c.save(); c.beginPath(); c.rect(0, 432, W, H - 432); c.clip();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5;
  for (let i = -12; i <= 12; i++) { c.beginPath(); c.moveTo(480 + i * 40, 432); c.lineTo(480 + i * 160, H); c.stroke(); }
  [440, 452, 470, 494, 524].forEach(y => { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); });
  c.restore();
  c.fillStyle = 'rgba(255,140,90,.08)'; c.fillRect(0, 432, W, 3);
  // stone pillars with fire bowls
  [82, 878].forEach(x => {
    c.fillStyle = '#3a2420'; c.fillRect(x - 22, 252, 44, 220);
    c.fillStyle = '#4c302a'; c.fillRect(x - 22, 252, 8, 220);
    c.fillStyle = '#2a1815'; c.fillRect(x + 14, 252, 8, 220);
    c.fillStyle = '#4c302a'; c.fillRect(x - 28, 460, 56, 12); c.fillRect(x - 28, 252, 56, 10);
    c.fillStyle = '#2a1815';
    c.beginPath(); c.moveTo(x - 30, 236); c.lineTo(x + 30, 236); c.lineTo(x + 20, 252); c.lineTo(x - 20, 252); c.fill();
  });
}

// ===== Drawing: fighters =====
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
}
function ik(a, b, l1, l2, s) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 0.001;
  const ux = dx / len, uy = dy / len;
  const d = Math.min(len, l1 + l2 - 0.5);
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const hgt = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  return [[a[0] + ux * along - s * uy * hgt, a[1] + uy * along + s * ux * hgt], [a[0] + ux * d, a[1] + uy * d]];
}
function seg(c, pts, w, color, outline = true) {
  const path = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); };
  if (outline) { c.strokeStyle = '#0a0405'; c.lineWidth = w + 5; path(); c.stroke(); }
  c.strokeStyle = color; c.lineWidth = w; path(); c.stroke();
}
function dot(c, p, r, color) {
  c.fillStyle = '#0a0405'; c.beginPath(); c.arc(p[0], p[1], r + 2.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = color; c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fill();
}
function drawHead(c, d, h, white) {
  const [x, y] = h;
  const hair = white ? '#ffffff' : d.hairCol;
  // hair behind the head
  c.fillStyle = hair;
  if (d.hair === 'long') {
    c.fillStyle = '#0a0405'; c.beginPath(); c.roundRect(x - 19, y - 8, 15, 36, 6); c.fill();
    c.fillStyle = hair; c.beginPath(); c.roundRect(x - 17, y - 6, 11, 32, 5); c.fill();
  } else if (d.hair === 'tail') {
    c.fillStyle = '#0a0405'; c.beginPath(); c.ellipse(x - 20, y + 4, 9, 15, 0.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = hair; c.beginPath(); c.ellipse(x - 20, y + 4, 6.5, 12.5, 0.5, 0, Math.PI * 2); c.fill();
  }
  dot(c, h, 14, white ? '#ffffff' : d.skin);
  c.fillStyle = hair;
  if (d.hair === 'spiky') {
    c.beginPath(); c.moveTo(x - 15, y - 1);
    [[-20, -12], [-10, -12], [-10, -24], [-2, -15], [4, -25], [8, -14], [16, -16], [14, -6]].forEach(([px, py]) => c.lineTo(x + px, y + py));
    c.closePath(); c.fill();
  } else if (d.hair === 'blaze') {
    // Kade (Rick 2026-11-22): tall spikes swept back, bright colour fading to the tips, dark outline so it stands out
    c.beginPath(); c.moveTo(x - 14, y + 1);
    [[-27, -6], [-17, -11], [-27, -22], [-11, -18], [-14, -34], [-2, -20], [3, -37], [8, -19], [17, -29], [14, -14],
      [21, -13], [14, -5]].forEach(([px, py]) => c.lineTo(x + px, y + py));
    c.closePath();
    c.strokeStyle = '#0a0405'; c.lineWidth = 4.5; c.stroke();
    if (!white) {
      const g = c.createLinearGradient(x, y - 4, x - 6, y - 36);
      g.addColorStop(0, d.hairCol); g.addColorStop(1, d.hairTip || d.hairCol);
      c.fillStyle = g;
    }
    c.fill();
  } else if (d.hair === 'long' || d.hair === 'tail') {
    c.beginPath(); c.arc(x, y, 15, Math.PI * 0.95, Math.PI * 2.02); c.closePath(); c.fill();
  } else if (d.hair === 'bald') {
    c.beginPath(); c.arc(x + 3, y + 5, 11, 0.1, Math.PI - 0.4); c.closePath(); c.fill();
  }
  // headband with tails
  c.strokeStyle = white ? '#ffffff' : d.band; c.lineWidth = 4;
  c.beginPath(); c.moveTo(x - 14, y - 6); c.lineTo(x + 14, y - 8); c.stroke();
  c.lineWidth = 3;
  c.beginPath(); c.moveTo(x - 14, y - 6); c.quadraticCurveTo(x - 24, y - 6, x - 30, y + 2); c.stroke();
  // eye
  c.fillStyle = '#111'; c.fillRect(x + 6, y - 3, 4, 3);
}
function drawFighter(c, d, pose, x, y, face, sc, white) {
  c.save();
  // sx < 1 = turning (spins). Never squash below 0.2 wide, or the fighter vanishes for a frame when exactly side-on.
  const sxRaw = pose.sx == null ? 1 : pose.sx, sxDraw = (sxRaw < 0 ? -1 : 1) * Math.max(0.2, Math.abs(sxRaw));
  c.translate(x, y); c.scale(face * sc * sxDraw, sc);
  if (pose.rot) { c.translate(8, -100); c.rotate(pose.rot); c.translate(-8, 100); }      // jump flip, around the tucked body's middle
  c.lineCap = 'round'; c.lineJoin = 'round';
  const W_ = '#ffffff';
  const col = k => white ? W_ : d[k];
  const dark = k => white ? '#dddddd' : shade(d[k], 0.68);
  const n = pose.neck, hp = pose.hip;
  const shF = [n[0] + 3, n[1] + 8], shB = [n[0] - 3, n[1] + 8];
  const [eF, hF] = ik(shF, pose.hF, 30, 30, 1), [eB, hB] = ik(shB, pose.hB, 30, 30, 1);
  const hiF = [hp[0] + 4, hp[1]], hiB = [hp[0] - 4, hp[1]];
  const [kF, fF] = ik(hiF, pose.fF, 40, 40, -1), [kB, fB] = ik(hiB, pose.fB, 40, 40, -1);
  const arm = (sh, el, hd, back) => {
    seg(c, [sh, el], 11, back ? dark('shirt') : col('shirt'));
    seg(c, [el, hd], 10, back ? dark('skin') : col('skin'));
    dot(c, hd, 7.5, back ? dark('glove') : col('glove'));
  };
  const leg = (hi, kn, ft, back) => {
    seg(c, [hi, kn, ft], 14, back ? dark('pants') : col('pants'));
    if (d.pantsFlames && !white) drawPantsFlames(c, hi, kn, ft, back);
    seg(c, [ft, [ft[0] + 9, ft[1] + 1]], 8, white ? W_ : '#1a1210');
  };
  arm(shB, eB, hB, true);
  leg(hiB, kB, fB, true);
  seg(c, [hp, n], 26, col('shirt'));
  // belt
  const bx = n[0] - hp[0], by = n[1] - hp[1], bl = Math.hypot(bx, by) || 1;
  seg(c, [hp, [hp[0] + bx / bl * 6, hp[1] + by / bl * 6]], 27, col('band'), false);
  if (pose.fire > 0) drawLegFire(c, kF, fF, pose.fire, false);      // flames behind the leg, so the leg still shows
  leg(hiF, kF, fF, false);
  if (pose.fire > 0) drawLegFire(c, kF, fF, pose.fire, true);       // small hot licks on top, round the foot
  seg(c, [n, pose.head], 9, col('skin'));
  drawHead(c, d, pose.head, white);
  arm(shF, eF, hF, false);
  if (pose.glow > 0 && d.throwFx) { drawHandGlow(c, hF, d.throwFx, pose.glow); drawHandGlow(c, hB, d.throwFx, pose.glow); }
  if (pose.zap > 0 && !white) { drawHandSparks(c, hF, d.special.color, pose.zap); drawHandSparks(c, hB, d.special.color, pose.zap * 0.6); }      // Smite
  if (pose.upBolt > 0 && !white) drawSkyBolts(c, hF, hB, d.special.color, pose.upBolt);      // Sky Bolt
  // Shockwave: the ball sits just in front of the two fists; the burst comes out of the same spot
  if ((pose.ball > 0 || pose.shock > 0) && !white) {
    const o = [(hF[0] + hB[0]) / 2 + 10, (hF[1] + hB[1]) / 2];
    if (pose.ball > 0) drawShockBall(c, o, d.special.color, pose.ball);
    if (pose.shock > 0) drawShockBurst(c, o, d.special.color, pose.shock);
  }
  if (pose.heat > 0) { drawFistFlame(c, hF, pose.heat, pose.flameLean || 0); drawFistHeat(c, hF, pose.heat); }      // only the punching fist
  if (pose.heat > 0 && pose.heatBoth) { drawFistFlame(c, hB, pose.heat, pose.flameLean || 0); drawFistHeat(c, hB, pose.heat); }      // Flaming Flurry: both
  c.restore();
}
// Hot rod flames printed on the pants (Kade, Rick 2026-11-22: "longer, more branching, like a hot rod pattern").
// Long wavy tongues of different lengths rise from the ankle, the longest past the knee up the thigh, with smaller
// licks branching off their sides. Flat orange with a yellow inside, no outline, so it reads as a print on the pants. Coordinates: a = distance up the leg from the ankle (foot -> knee -> hip), s = sideways across the leg,
// kept inside the leg's width. back = the far leg, drawn darker like the rest of it.
// Simplified the same day (Rick: "too detailed, not like a design on pants"): fewer, bolder tongues, gentle curves,
// two flat colours.
const PANTS_FLAMES = [      // a0 = where it starts up the leg, h = length (both x leg length), s0 = across, sway = S-bend, w = base half-width
  {a0: 0, h: 0.46, s0: -3.4, sway: 1.6, w: 3.6}, {a0: 0, h: 0.74, s0: 0.4, sway: -2, w: 4.2},
  {a0: 0, h: 0.34, s0: 4.2, sway: 1.2, w: 3},
  // one simple branch off the long middle tongue
  {a0: 0.36, h: 0.22, s0: 2.2, sway: 2.2, w: 2.2}];
function drawPantsFlames(c, hi, kn, ft, back) {
  const L1 = Math.hypot(kn[0] - ft[0], kn[1] - ft[1]) || 1, L2 = Math.hypot(hi[0] - kn[0], hi[1] - kn[1]) || 1, LT = L1 + L2;
  const at = (a, s) => {      // a point on the leg: a up from the ankle, s across (clamped inside the leg)
    const [p, q, k] = a <= L1 ? [ft, kn, a / L1] : [kn, hi, Math.min(1, (a - L1) / L2)];
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, sc = Math.max(-6.2, Math.min(6.2, s));
    return [p[0] + dx * k - dy / l * sc, p[1] + dy * k + dx / l * sc];
  };
  const shape = (hk, wk) => {      // all tongues as one path; hk / wk shrink length / width for the inner layers
    c.beginPath();
    const b0 = at(0, -6.2), b1 = at(0, 6.2), b2 = at(5, 6.2), b3 = at(5, -6.2);      // solid band at the ankle
    // (same winding direction as the tongues below, so overlaps fill instead of leaving holes)
    c.moveTo(b0[0], b0[1]); c.lineTo(b3[0], b3[1]); c.lineTo(b2[0], b2[1]); c.lineTo(b1[0], b1[1]); c.closePath();
    for (const t of PANTS_FLAMES) {
      const a0 = t.a0 * LT, h = t.h * LT * hk, N = 12, left = [], right = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, a = a0 + h * u, mid = t.s0 + t.sway * Math.sin(u * Math.PI) * u, w = t.w * wk * Math.pow(1 - u, 0.8);
        left.push(at(a, mid - w)); right.push(at(a, mid + w));
      }
      const pts = left.concat(right.reverse());
      c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]); c.closePath();
    }
  };
  c.save();
  c.lineJoin = 'round';
  shape(1, 1); c.fillStyle = back ? '#b04a12' : '#ff7a18'; c.fill();      // flat orange (no outline: reads as a print)
  shape(0.5, 0.45); c.fillStyle = back ? '#b8962a' : '#ffd23a'; c.fill();      // flat yellow inside
  c.restore();
}
// Heating fists (charge moves): k 0..1. Dark red embers at first, then orange, then a white-hot core and a big glow.
function drawFistHeat(c, h, k) {
  const mix = (a, b, s) => a.map((v, i) => Math.round(v + (b[i] - v) * s));
  const col = k < 0.5 ? mix([150, 20, 10], [255, 120, 20], k * 2) : mix([255, 120, 20], [255, 240, 190], (k - 0.5) * 2);
  const r = (10 + 22 * k) * (1 + Math.sin(G.frame * 0.9 + h[0]) * 0.08);
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(h[0], h[1], 1, h[0], h[1], r);
  g.addColorStop(0, 'rgba(' + mix(col, [255, 255, 255], k * 0.6) + ',' + (0.5 + 0.5 * k) + ')');
  g.addColorStop(0.4, 'rgba(' + col + ',' + (0.35 + 0.45 * k) + ')');
  g.addColorStop(1, 'rgba(' + col + ',0)');
  c.fillStyle = g; c.beginPath(); c.arc(h[0], h[1], r, 0, Math.PI * 2); c.fill();
  c.restore();
}
// Fire round a charging fist (Rick 2026-11-22): flickering tongues that grow from a small flicker to a big blaze as
// k goes 0..1. lean tilts them (negative = trailing back, used while the punch flies forward).
function drawFistFlame(c, h, k, lean) {
  if (k < 0.03) return;
  const tongue = (x, w, hgt, col) => {      // a teardrop flame standing on the fist, tip blown sideways by lean
    const y = h[1] + w * 0.6, tx = x + lean * hgt, ty = y - hgt;
    c.fillStyle = col; c.beginPath(); c.moveTo(x - w, y);
    c.quadraticCurveTo(x - w * 1.1, y - hgt * 0.55, tx, ty);
    c.quadraticCurveTo(x + w * 1.1, y - hgt * 0.55, x + w, y);
    c.arc(x, y, w, 0, Math.PI); c.fill();
  };
  c.save();
  c.globalCompositeOperation = 'lighter';
  const size = 0.25 + 0.75 * k;      // overall scale: grows with the charge
  for (let i = 0; i < 3; i++) {      // three tongues side by side, each flickering on its own
    const fl = 1 + 0.18 * Math.sin(G.frame * (0.7 + i * 0.23) + i * 2), x = h[0] + (i - 1) * 6 * size;
    const hgt = (18 + 46 * k) * size * fl * (i === 1 ? 1 : 0.72), w = (5 + 6 * k) * size * (i === 1 ? 1 : 0.75);
    tongue(x, w * 1.35, hgt, 'rgba(220,50,15,0.5)');
    tongue(x, w, hgt * 0.75, 'rgba(255,140,30,0.6)');
    tongue(x, w * 0.55, hgt * 0.45, 'rgba(255,235,150,' + (0.4 + 0.5 * k) + ')');
  }
  c.restore();
}
// glowing hand (Kade's throw): a soft flickering light round the glove, in the fighter's throwFx colour
function drawHandGlow(c, h, col, amt) {
  const r = (20 + Math.sin(G.frame * 0.8 + h[0]) * 3) * amt;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(h[0], h[1], 1, h[0], h[1], r);
  g.addColorStop(0, 'rgba(255,245,200,' + 0.9 * amt + ')');
  g.addColorStop(0.35, col);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = 0.85;
  c.fillStyle = g; c.beginPath(); c.arc(h[0], h[1], r, 0, Math.PI * 2); c.fill();
  c.restore();
}
// Flames wrapped round the shin and foot (knee kn -> foot ft, in the fighter's own drawing space, so "back" is -x).
// amt 0..1 = how strong. Flickers with G.frame; tongues lick backwards and up, like the leg is moving through the air.
function drawLegFire(c, kn, ft, amt, front) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  if (front) {      // a few small bright tongues round the foot, drawn over the leg
    for (let i = 0; i < 3; i++) {
      const fl = Math.sin(G.frame * 1.1 + i * 2.1), r = (4 + fl * 1.5) * amt;
      c.fillStyle = i ? 'rgba(255,170,40,0.55)' : 'rgba(255,240,150,0.7)';
      c.beginPath(); c.ellipse(ft[0] - 4 - i * 7, ft[1] - 6 - i * 2, r * 1.8, r, -0.4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    return;
  }
  const n = 6;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), x = kn[0] + (ft[0] - kn[0]) * k, y = kn[1] + (ft[1] - kn[1]) * k;
    const fl = Math.sin(G.frame * 0.9 + i * 1.7), r = (6 + 6 * k + fl * 2) * amt;
    const len = r * (2 + 0.6 * Math.sin(G.frame * 0.6 + i));
    c.fillStyle = 'rgba(255,80,20,0.45)';      // outer tongue, trailing back and up
    c.beginPath(); c.ellipse(x - len * 0.7, y - r * 0.9, len, r * 0.85, -0.35, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,180,50,0.55)';
    c.beginPath(); c.ellipse(x - len * 0.3, y - r * 0.5, len * 0.55, r * 0.6, -0.3, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}
const clamp01 = k => Math.max(0, Math.min(1, k));
// Jump: stretch on take-off, curl into a tuck near the top, open up again before landing.
// Jumping toward or away from the rival also does one full flip while curled.
function jumpPose(f) {
  // 0 = take-off, 1 = landing (a straight-up jump starts slower, so scale by its own take-off speed)
  const j = -(f.jumpV || -f.def.jump), ph = clamp01(((f.vy || 0) + j) / (2 * j));
  // knees tuck in early (Rick 2026-11-21: sooner), fully curled by a quarter of the way up, open again before landing
  const w = ph < 0.4 ? ease(clamp01((ph - 0.03) / 0.2)) : 1 - ease(clamp01((ph - 0.76) / 0.16));
  const p = lerpPose(P.jump, P.tuck, w);
  if (f.flip) p.rot = f.flip * Math.PI * 2 * ease(clamp01((ph - 0.14) / 0.64));
  return p;
}
// Spinning sweep: drop low with the leg out, turn all the way round once (squash the drawing sideways,
// so the leg swings behind and back to the front), and hit when it comes back round. Then get up slowly.
// The turn is fast while side-on and slows right down while the back faces the rival (Rick 2026-11-21: stay
// turned around longer, smoother): turn = a + c/(2π)·sin(2πa) has speed 1 + c·cos(2πa), so 1.75x at the start
// and end, 0.25x halfway round, with no sudden stops.
function spinPose(f, M, base) {
  const t = f.t, k = ease(clamp01(t / 4));
  if (t < M.startup + M.active) {
    const p = lerpPose(base, P.sweep, k);
    const a = clamp01(t / M.startup), turn = a + 0.75 / (2 * Math.PI) * Math.sin(2 * Math.PI * a);
    p.sx = Math.cos(Math.PI * 2 * turn);
    return p;
  }
  return lerpPose(base, P.sweep, ease(clamp01(1 - (t - M.startup - M.active) / M.recovery)));
}
function poseFor(f) {
  const t = f.t;
  switch (f.state) {
    case 'idle': {
      const b = Math.sin(G.frame * 0.08 + f.side * 2) * 2;
      const p = clonePose(P.idle);
      p.hip[1] += b * 0.6; p.neck[1] += b; p.head[1] += b; p.hF[1] += b * 1.3; p.hB[1] += b * 1.3;
      return p;
    }
    case 'walk': {
      const ph = f.walkPhase, p = clonePose(P.idle);
      p.fF = [18 + Math.sin(ph) * 16, -Math.max(0, Math.cos(ph)) * 10];
      p.fB = [-18 - Math.sin(ph) * 16, -Math.max(0, -Math.cos(ph)) * 10];
      const b = -Math.abs(Math.sin(ph)) * 3;
      for (const k of ['hip', 'neck', 'head', 'hF', 'hB']) p[k][1] += b;
      return p;
    }
    case 'crouch': return P.crouch;
    case 'block': return P.block;
    case 'cblock': return P.cblock;
    case 'blockstun': return f.blockLow ? P.cblock : P.block;
    case 'hitstun': return P.hit;
    case 'jump': return jumpPose(f);
    case 'dashf': case 'dashb': return lerpPose(P.idle, P[f.state], ease(Math.min(1, t / 3)));
    case 'knockdown': case 'juggle': return P.fall;
    case 'down': return P.lie;
    case 'getup': return lerpPose(P.lie, P.crouch, ease(Math.min(1, t / 20)));
    case 'ko': return f.onGround ? P.lie : P.fall;
    case 'win': return lerpPose(P.idle, P.win, ease(Math.min(1, t / 12)));
    case 'charging': {      // winding up a charge move: pull back, then tremble harder the hotter it gets
      const p = lerpPose(P.idle, P.furnaceWind, ease(clamp01(t / 6)));
      const shake = f.heat > 0.4 ? (f.heat - 0.4) * 3 : 0;
      if (shake) for (const k of ['neck', 'head', 'hF', 'hB']) { p[k][0] += Math.sin(G.frame * 2.1) * shake; p[k][1] += Math.cos(G.frame * 2.7) * shake * 0.6; }
      p.heat = f.heat || 0;
      return p;
    }
    case 'throwing': {      // grab -> lift -> heave forward (or swing over the head backward) -> back to standing
      const fwd = f.throwDir > 0, slam = f.def.throwStyle === 'slam', R = THROW.release;
      const top = slam ? 16 : fwd ? 18 : 16;
      const toss = slam ? (fwd ? P.slam : P.slamBack) : fwd ? P.throwToss : P.throwBack;
      let p;
      const grabP = f.def.throwReach ? P.throwFar : P.throw;
      if (f.def.throwStyle === 'heave') {      // arms round the waist, stand up with them on the shoulder, heave
        const heave = fwd ? P.heaveFwd : P.heaveBack;
        if (t < 4) p = lerpPose(grabP, P.heaveGrab, ease(t / 4));
        else if (t < 16) p = lerpPose(P.heaveGrab, P.heaveLift, ease((t - 4) / 12));
        else if (t < R) p = lerpPose(P.heaveLift, heave, ease((t - 16) / (R - 16)));
        else p = lerpPose(heave, P.idle, ease(clamp01((t - R - 6) / (THROW.end - R - 6))));      // arms stay out a moment
      }
      else if (t < THROW.lift) p = clonePose(grabP);
      else if (t < top) p = lerpPose(grabP, P.throwLift, ease((t - THROW.lift) / (top - THROW.lift)));
      else if (t < R) { const s = (t - top) / (R - top); p = lerpPose(P.throwLift, toss, slam ? s * s : ease(s)); }      // a slam speeds up
      else p = lerpPose(toss, P.idle, ease(clamp01((t - R - (slam ? 4 : 0)) / (THROW.end - R - (slam ? 4 : 0)))));      // a slam holds a moment
      if (t < R) {      // hands stay on the rival the whole time they're held
        const [gx, gy] = throwGrip(f.def.throwStyle, f.throwDir, t, f.throwPull || 0);
        p.hF = [gx, gy]; p.hB = [gx - 6, gy + 8];
      }
      if (f.def.throwFx) p.glow = t < R ? 1 : clamp01(1 - (t - R) / 8);
      return p;
    }
    case 'held': {          // being thrown: limp, then flipped over (backward toss) or bent back (forward toss)
      const style = G.fighters[1 - f.side].def.throwStyle;
      let p;
      if (style === 'heave') {      // stunned -> bent over the shoulder -> flung (the falling pose by release)
        const up = ease(clamp01((t - 4) / 12)), h = ease(clamp01((t - 16) / (THROW.release - 16)));
        p = lerpPose(lerpPose(P.hit, P.draped, up), P.fall, h);
      } else p = lerpPose(P.hit, P.fall, ease(clamp01(t / 10)));
      // how far they're turned (heldRot in fight.js: slam = flat on their back, heave = over the shoulder, toss = flip)
      p.rot = heldRot(style, f.throwDir, t);
      return p;
    }
    case 'attack': {
      if (f.move === 'special' && f.def.special.type === 'smite') return smitePose(t);
      const M = MOVES[f.move];
      const base = M.basePose ? P[M.basePose] : M.air ? P.jump : (f.move === 'sweep' || f.move === 'uppercut') ? P.crouch : P.idle;
      if (M.spin) return spinPose(f, M, base);
      let k, p;
      if (M.wind && t < M.startup) {      // two-part swing: wind up for the first half, then strike
        const half = M.startup / 2;
        p = t < half ? lerpPose(base, P[M.wind], ease(t / half)) : lerpPose(P[M.wind], P[f.move], ease((t - half) / half));
      } else {
        if (t < M.startup) k = t / M.startup;
        else if (t < M.startup + M.active) k = 1;
        else k = 1 - (t - M.startup - M.active) / (M.recovery + (f.blockedExtra || 0));      // blocked: slower recovery
        const to = M.throw && f.def.throwReach ? P.throwFar : P[f.move];      // long reach for the throw (Kade)
        p = lerpPose(base, to, ease(Math.max(0, Math.min(1, k))));
      }
      // spinning move (Blaze Wheel): turns all the way round spinN times while active (squashing the drawing sideways)
      if (M.spinN && t >= M.startup && t < M.startup + M.active) p.sx = Math.cos(Math.PI * 2 * M.spinN * (t - M.startup) / M.active);
      if (M.throw && f.def.throwFx) p.glow = clamp01(t / 3);
      // charged punch: fists stay as hot as the charge through the swing, then cool off during the recovery
      if (M.heat) { const end = M.startup + M.active; p.heat = (f.heat || 0) * (t < end ? 1 : clamp01(1 - (t - end) / 14)); p.flameLean = -0.9; }      // flames trail back as the fist flies
      // burning leg: flares up just before the rush, dies down in the first frames of recovery
      if (M.fire) {
        const end = M.startup + M.active;
        p.fire = t < end ? clamp01((t - M.startup + 5) / 5) : clamp01(1 - (t - end) / 10);
      }
      // electric hands (Vex's Ground Pulse): sparks build while the fist goes up, flare as it hits the floor, then fade
      if (M.zap) { const end = M.startup + M.active; p.zap = t < M.startup ? t / M.startup : t < end + 4 ? 1.6 : 1.6 * clamp01(1 - (t - end - 4) / 8); }
      // Flaming Flurry: alternate fists every 2 frames while active; both fists burn (flames trail back)
      if (M.flurry && t >= M.startup && t < M.startup + M.active) {
        const alt = Math.floor((t - M.startup) / 2) % 2;
        const sx = p.sx; p = clonePose(alt ? P.flurryB : P.flurryA); if (sx != null) p.sx = sx;
      }
      if (M.fistFire) { const end = M.startup + M.active; p.heat = t < end ? 0.55 * clamp01(t / 3) : 0.55 * clamp01(1 - (t - end) / 8); p.heatBoth = true; p.flameLean = -0.8; }
      // Sky Bolt: lightning shoots up out of the raised hands while active, fading in the first frames of recovery
      if (M.bolts) { const s = M.startup; p.upBolt = t >= s - 1 && t < s + M.active + 6 ? 1 - Math.max(0, t - s - M.active) / 6 : 0; }
      // Shockwave: an electric ball grows between the fists during startup, then bursts forward from the hands
      if (M.shock) {
        const end = M.startup + M.active;
        p.ball = t < M.startup ? clamp01(t / M.startup) : 0;
        p.shock = t >= M.startup && t < end + 6 ? (t - M.startup + 1) / (M.active + 6) : 0;
        if (p.zap) p.zap *= 0.5;      // the ball is the main show: softer sparks on the hands
      }
      return p;
    }
  }
  return P.idle;
}

// ===== Drawing: blasts, particles, fire =====
function drawProjectile(c, p) {
  if (p.s.type === 'smite') return drawSmite(c, p);
  if (p.s.type === 'pulse') return drawPulse(c, p);
  if (p.s.type === 'trap') return drawTrap(c, p);
  const s = p.s, col = s.color;
  c.save(); c.translate(p.x, p.y);
  const glow = c.createRadialGradient(0, 0, 2, 0, 0, p.r * 2.4);
  glow.addColorStop(0, col); glow.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = 0.55; c.fillStyle = glow; c.beginPath(); c.arc(0, 0, p.r * 2.4, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 1;
  if (s.type === 'flame') {
    c.scale(Math.sign(p.vx), 1);
    c.fillStyle = col;
    c.beginPath(); c.moveTo(16, 0);
    for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 + (i / 8) * Math.PI; const rr = 12 + Math.sin(G.frame * 0.6 + i * 2) * 4 + (i % 2 ? 10 : 0); c.lineTo(Math.cos(a) * rr - 4, Math.sin(a) * 12); }
    c.closePath(); c.fill();
    c.fillStyle = '#fff3c0'; c.beginPath(); c.arc(4, 0, 7, 0, Math.PI * 2); c.fill();
  } else if (s.type === 'orb') {
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, p.r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, p.r * 0.45, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      c.beginPath(); c.moveTo(Math.cos(a) * p.r, Math.sin(a) * p.r);
      c.lineTo(Math.cos(a + 0.3) * (p.r + 10), Math.sin(a + 0.3) * (p.r + 10)); c.lineTo(Math.cos(a) * (p.r + 18), Math.sin(a) * (p.r + 18)); c.stroke();
    }
  } else if (s.type === 'rock') {
    c.rotate(p.t * 0.25 * Math.sign(p.vx));
    c.fillStyle = '#0a0405';
    c.beginPath(); [[-15, -8], [-4, -16], [12, -11], [16, 4], [6, 15], [-11, 12]].forEach(([x, y], i) => i ? c.lineTo(x * 1.12, y * 1.12) : c.moveTo(x * 1.12, y * 1.12)); c.fill();
    c.fillStyle = col;
    c.beginPath(); [[-15, -8], [-4, -16], [12, -11], [16, 4], [6, 15], [-11, 12]].forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.fill();
    c.fillStyle = shade(col, 0.7); c.beginPath(); c.moveTo(0, 0); c.lineTo(16, 4); c.lineTo(6, 15); c.lineTo(-11, 12); c.fill();
  } else {
    c.scale(0.55 + Math.abs(Math.sin(p.t * 0.25)) * 0.45, 1);
    c.strokeStyle = col; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, p.r, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, p.r - 5, 0, Math.PI * 2); c.stroke();
  }
  c.restore();
}
// Vex's Static Orb (Rick 2026-11-23): a crackling orb gently bobbing in place (blinks in its last 45 frames so you
// can see it's about to fade). Once triggered (p.boom), a bright flash and jagged rings bursting out of it.
function drawTrap(c, p) {
  const col = p.s.color, x = p.x, y = p.y + Math.sin(p.t * 0.12) * 3;
  c.save();
  c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
  if (p.boom) {
    const k = p.boom / TRAP_BOOM;
    c.globalAlpha = Math.max(0, 1 - k * 1.6); c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x, y, 18 + 30 * k, 0, Math.PI * 2); c.fill();
    for (let j = 0; j < 2; j++) {
      const r = 20 + k * (70 + j * 25);
      c.globalAlpha = Math.max(0, 1 - k); c.strokeStyle = j ? col : '#ffffff'; c.lineWidth = j ? 4 : 2.5;
      c.beginPath();
      for (let s = 0; s <= 16; s++) { const a = s / 16 * Math.PI * 2, rr = r + (Math.random() - 0.5) * 10; s ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      c.stroke();
    }
    c.restore(); return;
  }
  const left = p.s.life - p.t;
  const blink = left < 45 && Math.floor(p.t / 4) % 2 === 0 ? 0.35 : 1;
  const grow = Math.min(1, p.t / 8), r = TRAP_R * grow;
  c.globalAlpha = blink;
  const g = c.createRadialGradient(x, y, 2, x, y, r * 2.2);
  g.addColorStop(0, 'rgba(255,255,235,0.9)'); g.addColorStop(0.4, 'rgba(199,255,90,0.55)'); g.addColorStop(1, 'rgba(199,255,90,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.2, 0, Math.PI * 2); c.fill();
  c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * (0.9 + 0.08 * Math.sin(p.t * 0.5)), 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, r * 0.35, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#efffc8'; c.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {      // arcs crawling round it
    const a = Math.random() * Math.PI * 2, b = a + 0.5 + Math.random() * 0.8;
    c.beginPath(); c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    c.lineTo(x + Math.cos((a + b) / 2) * r * 1.4, y + Math.sin((a + b) / 2) * r * 1.4);
    c.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r); c.stroke();
  }
  c.restore();
}
// Vex's Ground Pulse (Rick 2026-11-23): a crackling wave hugging the floor. A glow on the ground, a fading electric
// trail behind it, and a low wall of jagged little arcs (about PULSE_H tall) at the front, redrawn every frame.
function drawPulse(c, p) {
  const col = p.s.color, dir = Math.sign(p.vx) || 1, gy = GROUND, x = p.x;
  c.save();
  c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
  // glow on the floor (stretched backwards along the trail)
  const g = c.createRadialGradient(x, gy, 2, x, gy, 60);
  g.addColorStop(0, 'rgba(240,255,200,0.7)'); g.addColorStop(0.45, 'rgba(199,255,90,0.35)'); g.addColorStop(1, 'rgba(199,255,90,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(x - dir * 14, gy, 64, 16, 0, 0, Math.PI * 2); c.fill();
  // trail: a jagged line along the floor behind it, fading out
  const trail = Math.min(140, p.t * Math.abs(p.vx));
  for (let i = 0; i < 2; i++) {
    c.globalAlpha = i ? 0.9 : 0.35; c.strokeStyle = i ? '#f4ffd6' : col; c.lineWidth = i ? 1.5 : 5;
    c.beginPath(); c.moveTo(x, gy - 3);
    for (let s = 10; s <= trail; s += 10) c.lineTo(x - dir * s, gy - 2 - Math.random() * 6 * (1 - s / trail));
    c.stroke();
  }
  // the wall of arcs at the front
  c.strokeStyle = col; c.lineWidth = 2.5; c.globalAlpha = 0.95;
  for (let i = 0; i < 5; i++) {
    const bx = x - dir * (i * 7) + (Math.random() - 0.5) * 6, h = (PULSE_H - i * 5) * (0.7 + Math.random() * 0.4);
    c.strokeStyle = Math.random() < 0.3 ? '#ffffff' : col;
    c.beginPath(); c.moveTo(bx, gy);
    for (let k = 1; k <= 3; k++) c.lineTo(bx + (Math.random() - 0.5) * 12, gy - h * k / 3);
    c.stroke();
  }
  c.restore();
}
// Vex casting Smite (Rick 2026-11-23), timed off his own move clock t: raise the hand to the sky during startup,
// hold it up (trembling, sparks building) through the warning, slam it down on the frame the bolt lands
// (t = startup + SMITE_WARN), then back to standing. pose.zap = how strong the sparks round his hands are.
function smitePose(t) {
  // the bolt lands on Vex's frame S + SMITE_WARN - 1 (measured); the slam starts SLAM frames before so the hand
  // reaches the bottom on that same frame
  const M = MOVES.special, S = M.startup, HIT = S + SMITE_WARN - 1, SLAM = 3, L = HIT - SLAM, end = S + M.active + M.recovery;
  let p, zap;
  if (t < S) { p = lerpPose(P.idle, P.smiteUp, ease(t / S)); zap = t / S; }
  else if (t < L) {
    p = clonePose(P.smiteUp); zap = 1;
    const sh = 0.8 + 1.6 * (t - S) / (L - S);      // tremble harder as the strike gets close
    p.hF[0] += Math.sin(G.frame * 2.3) * sh; p.hF[1] += Math.cos(G.frame * 1.9) * sh;
  } else if (t < HIT) { const k = (t - L) / SLAM; p = lerpPose(P.smiteUp, P.smiteDown, k * k); zap = 1.2; }      // speeds up
  else if (t < HIT + 3) { p = clonePose(P.smiteDown); zap = 1.6; }      // held a moment as the bolt hits, sparks flare
  else { p = lerpPose(P.smiteDown, P.idle, ease(clamp01((t - HIT - 3) / (end - HIT - 3)))); zap = 1.6 * clamp01(1 - (t - HIT - 3) / 4); }
  p.zap = zap;
  return p;
}
// Vex's Sky Bolt (Rick 2026-11-23): three jagged bolts shooting up out of his raised hands (fanning out a little, up
// past the top of the hit box), with small forks, redrawn every frame so they flicker; k fades them out.
function drawSkyBolts(c, hF, hB, col, k) {
  c.save();
  c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
  const o = [(hF[0] + hB[0]) / 2, Math.min(hF[1], hB[1]) - 4];
  const g = c.createRadialGradient(o[0], o[1], 2, o[0], o[1], 40);
  g.addColorStop(0, 'rgba(255,255,235,' + 0.8 * k + ')'); g.addColorStop(1, 'rgba(199,255,90,0)');
  c.fillStyle = g; c.beginPath(); c.arc(o[0], o[1], 40, 0, Math.PI * 2); c.fill();
  const bolt = (dx, w, colr, a) => {
    c.globalAlpha = a * k; c.strokeStyle = colr; c.lineWidth = w;
    c.beginPath(); c.moveTo(o[0], o[1]);
    const top = -270, n = 7;
    for (let i = 1; i <= n; i++) { const s = i / n; c.lineTo(o[0] + dx * s + (Math.random() - 0.5) * 16, o[1] + (top - o[1]) * s); }
    c.stroke();
  };
  for (const dx of [-26, 4, 30]) { bolt(dx, 9, col, 0.3); bolt(dx, 4, col, 0.85); bolt(dx, 1.6, '#ffffff', 1); }
  c.globalAlpha = 0.7 * k; c.strokeStyle = col; c.lineWidth = 2;      // a couple of forks
  for (let i = 0; i < 2; i++) {
    const y = o[1] - 30 - Math.random() * 60, sd = i ? 1 : -1;
    c.beginPath(); c.moveTo(o[0] + sd * 8, y); c.lineTo(o[0] + sd * (18 + Math.random() * 10), y - 12); c.lineTo(o[0] + sd * (30 + Math.random() * 12), y - 4); c.stroke();
  }
  c.restore();
}
// Vex's Shockwave (Rick 2026-11-23). Ball: a glowing electric orb between his fists, growing with k (0..1) and
// crackling. Burst: crescent waves of jagged lightning rolling forward out of the ball, fading as they go (k 0..1).
// Both drawn in the fighter's own space (+x = toward the rival).
function drawShockBall(c, o, col, k) {
  const r = 4 + 12 * k;
  c.save();
  c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  const g = c.createRadialGradient(o[0], o[1], 1, o[0], o[1], r * 2.2);
  g.addColorStop(0, 'rgba(255,255,240,0.95)'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(199,255,90,0)');
  c.fillStyle = g; c.beginPath(); c.arc(o[0], o[1], r * 2.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(o[0], o[1], r * 0.45, 0, Math.PI * 2); c.fill();
  c.strokeStyle = col; c.lineWidth = 1.6;
  for (let i = 0; i < 2 + Math.round(3 * k); i++) {      // little arcs crawling over the ball
    const a = Math.random() * Math.PI * 2, b = a + 0.6 + Math.random() * 0.8;
    c.beginPath(); c.moveTo(o[0] + Math.cos(a) * r, o[1] + Math.sin(a) * r);
    c.lineTo(o[0] + Math.cos((a + b) / 2) * r * 1.35, o[1] + Math.sin((a + b) / 2) * r * 1.35);
    c.lineTo(o[0] + Math.cos(b) * r, o[1] + Math.sin(b) * r); c.stroke();
  }
  c.restore();
}
function drawShockBurst(c, o, col, k) {
  c.save();
  c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
  if (k < 0.35) {      // flash where the ball was
    c.globalAlpha = 1 - k / 0.35; c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(o[0], o[1], 14 + 20 * k, 0, Math.PI * 2); c.fill();
  }
  for (let j = 0; j < 3; j++) {      // three waves, the later ones a little behind
    const r = 14 + k * 112 - j * 14;      // (reaches about as far as the hit box)
    if (r < 8) continue;
    c.globalAlpha = Math.max(0, (1 - k) * (1 - j * 0.25));
    c.strokeStyle = j === 0 ? '#ffffff' : col; c.lineWidth = j === 0 ? 3 : 4;
    c.beginPath();
    for (let s = 0; s <= 10; s++) {
      const a = -0.95 + 1.9 * s / 10, rr = r + (Math.random() - 0.5) * 8;
      const x = o[0] + Math.cos(a) * rr, y = o[1] + Math.sin(a) * rr * 1.15;
      s ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
  }
  c.restore();
}
// sparks round a hand (Smite): a small glow and a few jagged little arcs, redrawn at random each frame so they crackle
function drawHandSparks(c, h, col, amt) {
  if (amt <= 0) return;
  drawHandGlow(c, h, col, Math.min(1, amt * 0.75));
  c.save();
  c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
  const n = Math.round(2 + 3 * amt);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r0 = 6 + Math.random() * 4, r1 = r0 + 8 + 10 * amt * Math.random();
    c.strokeStyle = Math.random() < 0.35 ? '#ffffff' : col; c.lineWidth = 1.5 + Math.random();
    c.globalAlpha = Math.min(1, 0.6 + 0.4 * amt);
    c.beginPath(); c.moveTo(h[0] + Math.cos(a) * r0, h[1] + Math.sin(a) * r0);
    const mid = a + (Math.random() - 0.5) * 0.9, rm = (r0 + r1) / 2;
    c.lineTo(h[0] + Math.cos(mid) * rm, h[1] + Math.sin(mid) * rm);
    c.lineTo(h[0] + Math.cos(a) * r1, h[1] + Math.sin(a) * r1); c.stroke();
  }
  c.restore();
}
// Vex's Smite (Rick 2026-11-22). Warning (t < SMITE_WARN): a storm cloud gathers at the top, a faint column of light
// and a pulsing, crackling ring mark the spot on the floor. Strike: a jagged flickering bolt with forks and a ground
// flash, fading out by SMITE_END.
function drawSmite(c, p) {
  const col = p.s.color, x = p.x, gy = GROUND;
  const zig = (x0, y0, x1, y1, n, amp) => {      // a jagged line from (x0, y0) to (x1, y1)
    c.beginPath(); c.moveTo(x0, y0);
    for (let i = 1; i < n; i++) { const k = i / n; c.lineTo(x0 + (x1 - x0) * k + (Math.random() - 0.5) * amp * 2, y0 + (y1 - y0) * k); }
    c.lineTo(x1, y1);
  };
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  // storm cloud (both phases, fading out at the end)
  const fade = p.t < SMITE_WARN ? Math.min(1, p.t / 8) : Math.max(0, 1 - (p.t - SMITE_WARN) / (SMITE_END - SMITE_WARN));
  c.globalAlpha = 0.85 * fade;
  c.fillStyle = '#2a1840';
  // (below the health bars, which cover the top ~80 px)
  [[-46, 104, 34, 16], [-14, 96, 38, 20], [24, 104, 36, 16], [0, 112, 52, 14]].forEach(([dx, cy, rx, ry]) => {
    c.beginPath(); c.ellipse(x + dx, cy, rx, ry, 0, 0, Math.PI * 2); c.fill();
  });
  c.globalAlpha = 1;
  if (p.t < SMITE_WARN) {
    const k = p.t / SMITE_WARN, pulse = 0.6 + 0.4 * Math.sin(p.t * 0.9);
    c.globalCompositeOperation = 'lighter';
    // faint column of light where it will strike
    c.fillStyle = 'rgba(199,255,90,' + (0.05 + 0.12 * k) + ')';
    c.fillRect(x - SMITE_HALF, 118, SMITE_HALF * 2, gy - 118);
    // ring on the floor, getting brighter
    c.strokeStyle = col; c.globalAlpha = (0.35 + 0.65 * k) * pulse; c.lineWidth = 3;
    c.beginPath(); c.ellipse(x, gy + 2, SMITE_HALF + 8, 9, 0, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 0.25 + 0.4 * k; c.fillStyle = col;
    c.beginPath(); c.ellipse(x, gy + 2, (SMITE_HALF + 8) * k, 9 * k, 0, 0, Math.PI * 2); c.fill();
    // crackles round the ring, and flickers in the cloud
    c.globalAlpha = 0.9; c.lineWidth = 2; c.strokeStyle = '#efffc8';
    for (let i = 0; i < 2 + Math.round(3 * k); i++) {
      const a = Math.random() * Math.PI * 2, rx = x + Math.cos(a) * (SMITE_HALF + 8), ry = gy + 2 + Math.sin(a) * 9;
      zig(rx, ry, rx + (Math.random() - 0.5) * 16, ry - 8 - Math.random() * 14, 3, 4); c.stroke();
    }
    if (Math.random() < 0.3 + 0.5 * k) { c.strokeStyle = col; zig(x + (Math.random() - 0.5) * 60, 104, x + (Math.random() - 0.5) * 60, 122, 3, 6); c.stroke(); }
  } else if (p.t < SMITE_END) {
    const k = Math.max(0, 1 - (p.t - SMITE_WARN) / (SMITE_END - SMITE_WARN));      // 1 at the strike, fading to 0
    c.globalCompositeOperation = 'lighter';
    // ground flash
    const g = c.createRadialGradient(x, gy, 2, x, gy, 90);
    g.addColorStop(0, 'rgba(255,255,230,' + 0.8 * k + ')'); g.addColorStop(0.4, 'rgba(199,255,90,' + 0.45 * k + ')'); g.addColorStop(1, 'rgba(199,255,90,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, gy, 90, 34, 0, 0, Math.PI * 2); c.fill();
    // the bolt: wide glow, coloured body, white core (redrawn jagged every frame so it flickers), plus two forks
    const bolt = (w, colr, a) => { c.globalAlpha = a; c.strokeStyle = colr; c.lineWidth = w; zig(x + (Math.random() - 0.5) * 10, 110, x, gy, 10, 12); c.stroke(); };
    bolt(22 * k + 4, col, 0.25 * k); bolt(8, col, 0.85 * k); bolt(3, '#ffffff', k);
    c.globalAlpha = 0.7 * k; c.strokeStyle = col; c.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      const fy = 160 + Math.random() * 170, sd = i ? 1 : -1;
      zig(x, fy, x + sd * (30 + Math.random() * 30), fy + 40 + Math.random() * 40, 4, 6); c.stroke();
    }
  }
  c.restore();
}
function drawParts(c) {
  for (const p of G.parts) {
    const k = p.life / p.max;
    c.globalAlpha = Math.max(0, k);
    if (p.kind === 'line') {
      c.strokeStyle = p.color; c.lineWidth = p.size; c.lineCap = 'round';
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); c.stroke();
    } else if (p.kind === 'ring') {
      c.strokeStyle = p.color; c.lineWidth = 3;
      c.beginPath(); c.arc(p.x, p.y, p.r * (1.2 - k), 0, Math.PI * 2); c.stroke();
    } else {
      c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2); c.fill();
    }
  }
  c.globalAlpha = 1;
}
function drawFires(c) {
  for (const x of [82, 878]) {
    const g = c.createRadialGradient(x, 225, 5, x, 225, 120);
    g.addColorStop(0, 'rgba(255,150,60,' + (0.28 + Math.sin(G.frame * 0.3 + x) * 0.05) + ')');
    g.addColorStop(1, 'rgba(255,150,60,0)');
    c.fillStyle = g; c.fillRect(x - 120, 105, 240, 240);
    [['#ff4a1c', 1], ['#ffa53a', 0.7], ['#fff1a8', 0.38]].forEach(([colr, sc]) => {
      c.fillStyle = colr;
      c.beginPath(); c.moveTo(x - 26 * sc, 238);
      for (let i = 0; i <= 6; i++) {
        const px = x - 26 * sc + (52 * sc * i) / 6;
        const tall = (i % 2 ? 46 : 26) * sc + Math.sin(G.frame * 0.35 + i * 1.7 + x) * 8 * sc;
        c.lineTo(px, 238 - tall);
      }
      c.lineTo(x + 26 * sc, 238); c.fill();
    });
  }
  c.fillStyle = '#ffb35a';
  for (const e of G.embers) { c.globalAlpha = Math.min(1, e.life / 60); c.fillRect(e.x, e.y, 2, 2); }
  c.globalAlpha = 1;
}

// ===== Drawing: screen =====
function render() {
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (G.shake > 0.5 && !G.paused) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  ctx.drawImage(bg, 0, 0, W, H);
  drawFires(ctx);
  const showFight = G.fighters && (G.screen === 'game' || G.screen === 'end');
  if (showFight) {
    const [a, b] = G.fighters;
    for (const f of G.fighters) {
      const sc = Math.max(0.4, 1 - (GROUND - f.y) / 300);
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath(); ctx.ellipse(f.x, GROUND + 3, 38 * sc, 8 * sc, 0, 0, Math.PI * 2); ctx.fill();
    }
    let order = b.state === 'attack' && a.state !== 'attack' ? [a, b] : [b, a];
    // someone being heaved over a shoulder goes in front of the thrower, so the carry shows
    const heaved = [a, b].find(f => f.state === 'held' && G.fighters[1 - f.side].def.throwStyle === 'heave');
    if (heaved) order = [G.fighters[1 - heaved.side], heaved];
    for (const f of order) drawFighter(ctx, f.def, poseFor(f), f.x, f.y, f.face, 1, f.flash > 3);
    for (const p of G.projectiles) drawProjectile(ctx, p);
    drawParts(ctx);
  }
  ctx.restore();
  if (showFight) { drawHUD(); drawMsg(); }
}
function drawHUD() {
  const c = ctx, [a, b] = G.fighters;
  const bar = (x, f, right) => {
    const w = 380, y = 22;
    c.fillStyle = '#000'; c.fillRect(x - 3, y - 3, w + 6, 28);
    c.fillStyle = '#3a0d0c'; c.fillRect(x, y, w, 22);
    const tw = w * f.trail / 100, hw = w * f.hp / 100;
    c.fillStyle = '#ff3b2f'; c.fillRect(right ? x + w - tw : x, y, tw, 22);
    const g = c.createLinearGradient(0, y, 0, y + 22);
    g.addColorStop(0, '#fff09a'); g.addColorStop(0.5, '#ffcf3a'); g.addColorStop(1, '#d49a10');
    c.fillStyle = g; c.fillRect(right ? x + w - hw : x, y, hw, 22);
    // special meter
    const ready = f.cd <= 0;
    c.fillStyle = '#000'; c.fillRect(right ? x + w - 152 : x - 2, y + 28, 154, 9);
    c.fillStyle = '#2a0d0c'; c.fillRect(right ? x + w - 150 : x, y + 30, 150, 5);
    const sw = 150 * (1 - f.cd / SPECIAL_WAIT);
    c.fillStyle = ready ? f.def.special.color : shade(f.def.special.color, 0.5);
    c.fillRect(right ? x + w - sw : x, y + 30, sw, 5);
    // name + label
    c.font = 'italic 800 20px system-ui, sans-serif';
    c.textAlign = right ? 'right' : 'left'; c.textBaseline = 'top';
    const label = G.mode === 'online' ? (f.side === NET.side ? 'YOU' : 'RIVAL') :
      f.side === 0 ? (G.mode === '2p' ? 'P1' : 'YOU') : (G.mode === '2p' ? 'P2' : isPractice() ? 'DUMMY' : 'CPU');
    const nx = right ? x + w : x;
    c.lineWidth = 4; c.strokeStyle = '#000';
    c.strokeText(f.def.name.toUpperCase(), nx, y + 42); c.fillStyle = '#fff'; c.fillText(f.def.name.toUpperCase(), nx, y + 42);
    const nw = c.measureText(f.def.name.toUpperCase() + ' ').width;
    c.font = '700 12px system-ui, sans-serif'; c.fillStyle = f.def.shirt;
    c.fillText(label, right ? nx - nw : nx + nw, y + 49);
    // round wins (none in practice)
    for (let i = 0; i < (isPractice() ? 0 : 2); i++) {
      const px = right ? x + 14 + i * 22 : x + w - 14 - i * 22;
      c.beginPath(); c.arc(px, y + 54, 7, 0, Math.PI * 2);
      c.fillStyle = G.wins[f.side] > i ? '#ffcf5a' : '#2a0d0c'; c.fill();
      c.lineWidth = 2; c.strokeStyle = '#000'; c.stroke();
    }
    // combo (practice mode has its own hits / damage box instead)
    if (f.comboShow > 0 && G.mode !== 'practice') {
      c.globalAlpha = Math.min(1, f.comboShow / 20);
      c.font = 'italic 900 34px system-ui, sans-serif';
      c.textAlign = right ? 'right' : 'left';
      const cx = right ? W - 40 : 40;
      c.lineWidth = 6; c.strokeStyle = '#000'; c.strokeText(f.combo + ' HITS', cx, 120);
      c.fillStyle = '#ffcf5a'; c.fillText(f.combo + ' HITS', cx, 120);
      c.font = '800 14px system-ui, sans-serif'; c.fillStyle = '#fff';
      c.fillText('COMBO', cx, 156);
      c.globalAlpha = 1;
    }
    if (f.noteShow > 0) {      // e.g. THROW BREAK
      c.globalAlpha = Math.min(1, f.noteShow / 20);
      c.font = 'italic 900 26px system-ui, sans-serif';
      c.textAlign = right ? 'right' : 'left';
      const cx = right ? W - 40 : 40;
      c.lineWidth = 6; c.strokeStyle = '#000'; c.strokeText(f.note, cx, 196);
      c.fillStyle = '#9fe3ff'; c.fillText(f.note, cx, 196);
      c.globalAlpha = 1;
    }
  };
  bar(40, a, false);
  bar(540, b, true);
  c.fillStyle = '#000'; c.fillRect(448, 14, 64, 46);
  c.fillStyle = '#2a0d0c'; c.fillRect(451, 17, 58, 40);
  c.font = '900 30px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = G.timer <= 10 ? '#ff5a4d' : '#fff';
  c.fillText(isPractice() ? '∞' : String(G.timer).padStart(2, '0'), 480, 38);
  if (G.mode === 'practice') drawPracticeHUD(c);      // (the tutorial has its own HTML panel instead)
}
function drawMsg() {
  if (!G.msg) return;
  const c = ctx, k = Math.min(1, G.msgT / 8);
  c.save();
  c.translate(480, 230);
  const sc = 1.6 - 0.6 * ease(k);
  c.scale(sc, sc);
  c.globalAlpha = k;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = 'italic 900 84px system-ui, sans-serif';
  const g = c.createLinearGradient(0, -40, 0, 40);
  g.addColorStop(0, '#fff3a8'); g.addColorStop(0.5, '#ffb030'); g.addColorStop(1, '#ff3b2f');
  c.lineWidth = 12; c.strokeStyle = '#000'; c.lineJoin = 'round';
  c.strokeText(G.msg, 0, 0); c.fillStyle = g; c.fillText(G.msg, 0, 0);
  if (G.sub) {
    c.font = 'italic 900 38px system-ui, sans-serif';
    c.lineWidth = 8; c.strokeText(G.sub, 0, 70); c.fillStyle = '#ffffff'; c.fillText(G.sub, 0, 70);
  }
  c.restore();
}

