'use strict';
// Fatal Fists - start-up and the frame loop
// ===== Start =====
// Draw at the size the game really shows on screen (in real screen pixels), so big or
// high-res monitors get a sharp picture instead of a small 960x540 one stretched up.
// Capped at 3x (2880x1620) to keep it smooth; rounded to 1/4 steps so dragging the
// window doesn't rebuild the background every pixel.
const stageEl = $('stage');
function resize() {
  const shown = (stageEl.clientWidth || W) * (window.devicePixelRatio || 1);
  const s = Math.min(3, Math.max(1, Math.round(shown / W * 4) / 4));
  if (s !== S || !bg.width) { S = s; cv.width = W * S; cv.height = H * S; buildBg(); }
}
addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(stageEl);
resize();
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { step(); acc -= 1000 / 60; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
