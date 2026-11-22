'use strict';
// Fatal Fists - keyboard map
// ===== Keys =====
const keys = {};
const tapped = new Set();
const KEYMAP = [
  {left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
   punch: ['KeyJ', 'KeyF'], kick: ['KeyK', 'KeyG'], block: ['KeyL', 'KeyH']},
  {left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
   punch: ['Numpad1', 'Comma'], kick: ['Numpad2', 'Period'], block: ['Numpad3', 'Slash']},
];
const DEFAULT_KEYMAP = JSON.parse(JSON.stringify(KEYMAP));
const BTNS = ['left', 'right', 'up', 'down', 'punch', 'kick', 'block'];
// Players can change all their keys: moving, punch, kick, block (Controls screen; movement added 2026-11-21,
// Rick's request). The whole map is saved in settings.keymap.
const REBINDABLE = ['up', 'down', 'left', 'right', 'punch', 'kick', 'block'];
const isGameKey = code => KEYMAP.some(m => BTNS.some(b => m[b].includes(code)));
const NO_BIND = new Set(['Escape', 'KeyP', 'Enter', 'Tab', 'Space']);      // pause / menu keys
if (Array.isArray(settings.keymap) && settings.keymap.length === 2) {
  settings.keymap.forEach((m, i) => { for (const b of BTNS) if (Array.isArray(m[b]) && m[b].length) KEYMAP[i][b] = m[b].slice(); });
}
// Put key `code` on player p's action b (as its main key). If another action already uses that key,
// it swaps: that action gets b's old main key (or just loses the key if it was only a spare).
function bindKey(p, b, code) {
  const old = KEYMAP[p][b][0];
  if (old === code) return;
  KEYMAP.forEach((m, i) => {
    for (const a of BTNS) {
      if (i === p && a === b) continue;
      const k = m[a].indexOf(code);
      if (k < 0) continue;
      if (k === 0) m[a][0] = old; else m[a].splice(k, 1);
    }
  });
  const list = KEYMAP[p][b].filter(c => c !== code);
  list[0] = code;
  KEYMAP[p][b] = list;
  saveKeys();
}
function resetKeys() {
  DEFAULT_KEYMAP.forEach((m, i) => { for (const b of BTNS) KEYMAP[i][b] = m[b].slice(); });
  saveKeys();
}
function saveKeys() {
  const same = JSON.stringify(KEYMAP) === JSON.stringify(DEFAULT_KEYMAP);
  if (same) delete settings.keymap; else settings.keymap = KEYMAP;
  saveSettings();
}
// A short label for a key code, e.g. KeyJ -> J, Numpad1 -> Num 1, Comma -> ,
function keyName(code) {
  if (!code) return '?';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  const names = {Comma: ',', Period: '.', Slash: '/', Quote: "'", Semicolon: ';', BracketLeft: '[', BracketRight: ']',
    Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`', ShiftLeft: 'L Shift', ShiftRight: 'R Shift',
    ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', AltLeft: 'L Alt', AltRight: 'R Alt',
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓'};
  return names[code] || code;
}
const PRESSABLE = ['punch', 'kick', 'left', 'right'];      // left/right taps are counted for the double-tap dash
function humanInput(maps) {
  const held = {}, press = [];
  for (const b of BTNS) {
    held[b] = maps.some(m => m[b].some(c => keys[c]));
    if (PRESSABLE.includes(b) && maps.some(m => m[b].some(c => tapped.has(c)))) press.push(b);
  }
  return {held, press};
}

