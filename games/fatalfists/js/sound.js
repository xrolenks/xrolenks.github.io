'use strict';
// Fatal Fists - sounds made in code
// ===== Sound (made in code, no files) =====
// Volume (Rick 2026-11-23: "too loud, hurts my ears"): every sound goes through OUT = a master gain (SFX_VOLUME)
// and a compressor/limiter, so peaks can't get painful. allowSound() also caps how many sound pieces can start at
// once (a burst of many hits in the same instant, e.g. a fast-forwarded test, used to stack into one loud blast).
const SFX_VOLUME = 0.4, BURST_WINDOW = 0.05, BURST_MAX = 6;
let AC = null, NB = null, OUT = null, burstT = -1, burstN = 0;
function ac() {
  if (settings.muted) return null;
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const d = NB.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const lim = AC.createDynamicsCompressor();
      lim.threshold.value = -18; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.15;
      OUT = AC.createGain(); OUT.gain.value = SFX_VOLUME;
      OUT.connect(lim).connect(AC.destination);
    } catch (e) { AC = null; return null; }
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function allowSound(a) {
  if (a.currentTime - burstT > BURST_WINDOW) { burstT = a.currentTime; burstN = 0; }
  return ++burstN <= BURST_MAX;
}
function tone(f0, dur, type, vol, f1, delay = 0) {
  const a = ac(); if (!a || !allowSound(a)) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(OUT); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, type = 'lowpass') {
  const a = ac(); if (!a || !allowSound(a)) return;
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
  s.buffer = NB; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(OUT); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
const SFX_RAW = {
  hit(heavy) { noise(heavy ? 0.2 : 0.12, 0.55, heavy ? 900 : 1800); tone(heavy ? 95 : 150, heavy ? 0.2 : 0.12, 'sine', 0.55, 40); },
  block() { tone(1100, 0.05, 'square', 0.08); noise(0.06, 0.25, 4000, 'highpass'); },
  whoosh() { noise(0.09, 0.12, 2400, 'bandpass'); },
  jump() { tone(240, 0.12, 'sine', 0.08, 420); },
  special() { tone(180, 0.35, 'sawtooth', 0.12, 720); noise(0.25, 0.12, 1500, 'bandpass'); },
  grab() { tone(260, 0.08, 'square', 0.08, 180); noise(0.07, 0.2, 900); },
  flame() { noise(0.45, 0.3, 700); tone(110, 0.4, 'sawtooth', 0.08, 260); },      // Fiery Rush roar
  thunder() { noise(0.5, 0.55, 1200); tone(60, 0.6, 'sawtooth', 0.18, 30); noise(0.12, 0.35, 5000, 'highpass'); },      // Vex's Smite strike
  zapUp() { tone(320, 0.16, 'sawtooth', 0.07, 1400); noise(0.14, 0.18, 4000, 'highpass'); },      // Vex's Sky Bolt
  crackle() { noise(0.08, 0.08, 6000, 'highpass'); },      // Smite's warning on the ground
  thud() { tone(70, 0.18, 'sine', 0.45, 35); noise(0.12, 0.2, 400); },
  // round start / K.O. sounds turned down further (Rick 2026-11-23: loud when the match loads)
  ko() { tone(140, 1.1, 'sawtooth', 0.14, 30); noise(0.8, 0.22, 500); },
  gong() { tone(196, 1.4, 'sine', 0.16); tone(294, 1.1, 'sine', 0.07); tone(392, 0.8, 'triangle', 0.04); },
  fight() { tone(392, 0.12, 'square', 0.06); tone(523, 0.12, 'square', 0.06, null, 0.1); tone(784, 0.3, 'square', 0.06, null, 0.2); },
  select() { tone(620, 0.06, 'square', 0.06); },
  move() { tone(420, 0.04, 'square', 0.04); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, null, i * 0.12)); },
};
// SFX.x() plays a sound; when hosting online, fight sounds are also sent to the other player
const SFX = {};
for (const k in SFX_RAW) SFX[k] = (...a) => { SFX_RAW[k](...a); netEvent(['s', k, a]); };

