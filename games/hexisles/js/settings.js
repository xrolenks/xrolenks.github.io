'use strict';
// Hex Isles - The "Your turn" pop-up and the Settings menu.
// ---------- "Your turn" pop-up and the settings menu (2026-11-19, Rick's request) ----------
// When a turn starts on this screen (same moment as the turn chime: your roll, or your setup placement),
// big "Your turn" text grows in over the page in your colour, stays a moment and fades out (TURNMS).
// Same screen with more than one person: the player's name is shown under it. Never on the first draw or a load.
// The gear button in the header opens #setpop; "Show Your turn" is kept in localStorage key TURNKEY ('0' = off).
const TURNKEY = 'hexisles-turnpop', TURNMS = 2600;
let TURNON = true, TSEEN = null;
try { TURNON = localStorage.getItem(TURNKEY) !== '0'; } catch (e) {}
function turnPop() {
  const s = {id: G.id, turn: G.turn, mine: myTurn(), phase: G.phase};
  const was = TSEEN; TSEEN = s;
  if (!was || was.id !== s.id || !TURNON) return;
  if (!(s.mine && (!was.mine || was.turn !== s.turn) && (G.phase === 'roll' || G.phase === 'setup'))) return;
  const old = $('turnpop'); if (old) old.remove();
  const humans = G.pl.filter(P => !P.bot).length, P = G.pl[G.turn];
  const d = document.createElement('div');
  d.id = 'turnpop'; d.style.setProperty('--c', PCOL[G.turn]);
  d.innerHTML = 'Your turn' + (!NET.role && humans > 1 ? '<small>' + esc(P.name) + '</small>' : '');
  document.body.appendChild(d);
  d.animate([
    {opacity: 0, transform: 'translate(-50%,-50%) scale(.6)'},
    {opacity: 1, transform: 'translate(-50%,-50%) scale(1.08)', offset: .12},
    {opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .2},
    {opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .7},
    {opacity: 0, transform: 'translate(-50%,-58%) scale(1)'}
  ], {duration: TURNMS, easing: 'ease-out', fill: 'both'}).onfinish = () => d.remove();
  setTimeout(() => d.remove(), TURNMS + 300);      // in case the finish event never comes (hidden tab)
}
$('set-turn').checked = TURNON;
$('set-turn').onchange = e => { TURNON = e.target.checked; try { localStorage.setItem(TURNKEY, TURNON ? '1' : '0'); } catch (x) {} if (!TURNON && $('turnpop')) $('turnpop').remove(); };
// (The "Day and night" checkbox was replaced by the Day and Night visual packs, js/packs.js, 2026-11-20.)
try { localStorage.removeItem('hexisles-daynight'); } catch (e) {}
// Graphics: Fast (default) or Fancy (Rick's request, 2026-11-20). Stored in localStorage GFXKEY (board3d.js, which reads
// it when the 3D island starts); D3.gfx switches a running island at once.
function fillGfx() {
  const fancy = gfxFancy();
  $('set-gfx').querySelectorAll('button').forEach(b => { const on = (b.dataset.g === 'fancy') === fancy; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  $('set-gfxhint').textContent = fancy ? 'Shadows, sea reflections and a sharper picture. Needs a strong computer.' : 'Runs smoothly on most computers: no shadows or island reflections.';
}
$('set-gfx').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  try { localStorage.setItem(GFXKEY, b.dataset.g); } catch (x) {}
  fillGfx();
  if (D3.gfx) D3.gfx(b.dataset.g === 'fancy');
};
fillGfx();
// Which graphics chip draws the 3D island (Rick, 2026-11-21: his laptop drew on its built-in chip, not its NVIDIA card).
// Shown under Graphics when the menu opens, with the "Have a gaming graphics card?" steps below it (#set-gpu, index.html).
// Browsers may hide the real name (then nothing is shown). Read from the 3D island's own context, so no extra one is made.
function chipName() {
  try {
    if (!D3.ready || !D3.three) return '';
    const gl = D3.three.R.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info');
    let n = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : '';
    const m = /^ANGLE \([^,]*, (.*)\)$/.exec(n); if (m) n = m[1];      // "ANGLE (AMD, AMD Radeon(TM) Graphics (0x1114) Direct3D11 ..., D3D11)"
    n = n.replace(/^ANGLE \w+ Renderer: /, '');      // (Macs: "ANGLE Metal Renderer: Apple M2, ...")
    return n.replace(/,.*$/, '').replace(/ \(0x[0-9a-f]+\)/i, '').replace(/ (Direct3D|OpenGL|Vulkan|Metal).*$/i, '').replace(/\((TM|R)\)/gi, '').trim();
  } catch (e) { return ''; }
}
function fillChip() {
  const n = chipName(), weak = /intel|uhd|iris|radeon graphics|vega \d|llvmpipe|swiftshader|software/i.test(n) && !/nvidia|geforce|rtx|gtx|radeon rx|arc a/i.test(n);
  $('set-chip').textContent = n ? 'Drawing on: ' + n + (weak ? ' (a built-in chip)' : '') : '';
}
$('setbtn').onclick = () => { const p = $('setpop'); p.hidden = !p.hidden; $('setbtn').setAttribute('aria-expanded', String(!p.hidden)); if (!p.hidden) fillChip(); };
document.addEventListener('pointerdown', e => { if (!e.target.closest('#sets')) { $('setpop').hidden = true; $('setbtn').setAttribute('aria-expanded', 'false'); } }, true);

