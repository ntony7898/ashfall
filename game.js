'use strict';
/* ASHFALL — gothic horde survival. All art drawn in code. */
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const store = { get: (k, d) => { try { const v = localStorage.getItem('ashfall.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('ashfall.' + k, JSON.stringify(v)); } catch {} } };
let W = 0, H = 0, DPR = 1, Z = 1;
function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR | 0; cv.height = H * DPR | 0; Z = clamp(Math.min(W, H) / 470, .85, 1.5); lightC.width = (W / 2) | 0; lightC.height = (H / 2) | 0; }
const lightC = document.createElement('canvas'), lg = lightC.getContext('2d');
addEventListener('resize', resize);

/* ---------------- audio: soft synthesized ---------------- */
const AU = { ctx: null, master: null, muted: store.get('mute', false), last: {} };
function audioInit() { if (AU.ctx) { if (AU.ctx.state !== 'running') AU.ctx.resume(); return; }
  try { const C = window.AudioContext || window.webkitAudioContext; AU.ctx = new C(); AU.master = AU.ctx.createGain(); AU.master.gain.value = AU.muted ? 0 : .7;
    const comp = AU.ctx.createDynamicsCompressor(); AU.master.connect(comp); comp.connect(AU.ctx.destination);
    const b = AU.ctx.createBuffer(1, 1, 22050), s = AU.ctx.createBufferSource(); s.buffer = b; s.connect(AU.ctx.destination); s.start(0);
    AU.noise = AU.ctx.createBuffer(1, AU.ctx.sampleRate * .5, AU.ctx.sampleRate); const d = AU.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { AU.ctx = null; } }
['touchend', 'click', 'keydown'].forEach(ev => addEventListener(ev, audioInit, { passive: true }));
function thr(k, ms) { const t = performance.now(); if (AU.last[k] && t - AU.last[k] < ms) return false; AU.last[k] = t; return true; }
function tone(f0, f1, dur, vol, type = 'sine', at = .005) { const a = AU.ctx; if (!a || AU.muted) return; const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + dur + .02); }
function noise(dur, vol, freq, q = .8, sweep) { const a = AU.ctx; if (!a || AU.muted) return; const t = a.currentTime, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = AU.noise; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur); f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f); f.connect(g); g.connect(AU.master); s.start(t, Math.random() * .3); s.stop(t + dur + .02); }
const sfx = {
  hit: () => thr('hit', 45) && noise(.05, .05, 900),
  kill: () => thr('kill', 60) && tone(150, 60, .12, .05),
  gem: () => thr('gem', 50) && tone(rnd(900, 1100), 1500, .07, .022),
  shoot: () => thr('shoot', 90) && noise(.06, .018, 2500, .5, 600),
  nova: () => noise(.5, .07, 400, 1, 2400),
  zap: () => thr('zap', 120) && noise(.12, .03, 3000, 4, 1200),
  hurt: () => thr('hurt', 200) && (noise(.18, .08, 500), tone(110, 70, .2, .05, 'triangle')),
  level: () => { [392, 494, 587, 784].forEach((f, i) => setTimeout(() => tone(f, f, .9, .045, 'sine', .08), i * 70)); },
  chest: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f * 1.01, .6, .04, 'triangle', .02), i * 90)); },
  boss: () => { tone(70, 45, 2.2, .12, 'sawtooth', .4); noise(1.6, .06, 200, 1, 90); },
  heal: () => tone(523, 784, .4, .04, 'sine', .05),
};
function setMute(m) { AU.muted = m; store.set('mute', m); $('mute').classList.toggle('off', m); if (AU.master) AU.master.gain.value = m ? 0 : .7; }

/* ---------------- sprites (pre-rendered) ---------------- */
const SPR = {};
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function humanoid(g, o, f) { // origin: feet at (0,0), facing right
  const s = o.s || 1, lift = f ? 2 : 0; g.save(); g.scale(s, s);
  g.fillStyle = o.legs; g.fillRect(-6, -16 + (f ? -lift : 0), 5, 16 - (f ? 2 : 0)); g.fillRect(1, -16 + (f ? 0 : -lift), 5, 16 - (f ? 0 : 2));
  if (o.cape) { g.fillStyle = o.cape; g.beginPath(); g.moveTo(-8, -34); g.lineTo(-13 - (f ? 2 : 0), -6); g.lineTo(6, -8); g.lineTo(4, -34); g.fill(); }
  g.fillStyle = o.body; g.beginPath(); g.moveTo(-9, -34); g.lineTo(9, -34); g.lineTo(o.robe ? 11 : 8, o.robe ? -3 : -15); g.lineTo(o.robe ? -11 : -8, o.robe ? -3 : -15); g.closePath(); g.fill();
  if (o.belt) { g.fillStyle = o.belt; g.fillRect(-9, -20, 18, 3); }
  if (o.trim) { g.strokeStyle = o.trim; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -34); g.lineTo(0, o.robe ? -4 : -16); g.stroke(); }
  if (o.pauld) { g.fillStyle = o.pauld; g.beginPath(); g.ellipse(-8, -33, 6, 4, 0, 0, TAU); g.ellipse(8, -33, 6, 4, 0, 0, TAU); g.fill(); }
  g.fillStyle = o.skin || '#c8b090'; g.beginPath(); g.arc(1, -40, 6, 0, TAU); g.fill();
  if (o.hood) { g.fillStyle = o.hood; g.beginPath(); g.moveTo(-8, -36); g.quadraticCurveTo(-9, -50, 1, o.point ? -56 : -49); g.quadraticCurveTo(10, -48, 9, -36); g.lineTo(5, -36); g.quadraticCurveTo(5, -45, 0, -45); g.quadraticCurveTo(-3, -42, -2, -36); g.fill();
    g.fillStyle = '#050303'; g.beginPath(); g.ellipse(3, -40, 4, 4.5, 0, 0, TAU); g.fill(); g.fillStyle = o.eye || '#000'; g.fillRect(3, -41, 2, 1.5); g.fillRect(6, -41, 1.5, 1.5); }
  if (o.helm) { g.fillStyle = o.helm; g.beginPath(); g.arc(1, -41, 7, Math.PI, 0); g.fill(); g.fillRect(-6, -41, 14, 5); g.fillStyle = '#111'; g.fillRect(3, -40, 5, 1.6); g.fillStyle = o.plume || '#9e1b14'; g.fillRect(-1, -52, 3, 5); }
  if (o.weapon) o.weapon(g, f);
  g.restore(); }
const CHAR = {
  warrior: { body: '#5d5a58', legs: '#2c2725', cape: '#7a1d14', pauld: '#8d8a86', helm: '#a7a39c', belt: '#5a3a1a', trim: '#c9a24a', s: 1.1,
    weapon: g => { g.fillStyle = '#6b4a22'; g.fillRect(8, -26, 3, 6); g.fillStyle = '#d8d4cc'; g.beginPath(); g.moveTo(9, -27); g.lineTo(12, -27); g.lineTo(13, -52); g.lineTo(10, -56); g.lineTo(8, -52); g.fill(); g.fillStyle = '#c9a24a'; g.fillRect(5, -28, 11, 2); } },
  assassin: { body: '#2b2433', legs: '#17131b', hood: '#1e1a24', belt: '#6b2a7a', eye: '#d86bff', s: .95,
    weapon: g => { g.fillStyle = '#cfd3da'; g.beginPath(); g.moveTo(9, -22); g.lineTo(18, -26); g.lineTo(10, -20); g.fill(); g.beginPath(); g.moveTo(-9, -22); g.lineTo(-16, -15); g.lineTo(-8, -20); g.fill(); } },
  mage: { body: '#2a2f5e', legs: '#14172e', hood: '#33397a', robe: 1, point: 1, trim: '#c9a24a', eye: '#7fd0ff', s: 1,
    weapon: g => { g.strokeStyle = '#5b3a1e'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(12, -4); g.lineTo(12, -50); g.stroke(); g.fillStyle = '#ff8a3a'; g.beginPath(); g.arc(12, -53, 4, 0, TAU); g.fill(); g.fillStyle = '#ffe2a0'; g.beginPath(); g.arc(12, -53, 1.8, 0, TAU); g.fill(); } },
  archer: { body: '#3c4a2a', legs: '#201f15', hood: '#2f3d22', cape: '#26301b', belt: '#6b4a22', eye: '#c9e07a', s: 1,
    weapon: g => { g.strokeStyle = '#7a5226'; g.lineWidth = 2.2; g.beginPath(); g.arc(6, -28, 15, -1.2, 1.2); g.stroke(); g.strokeStyle = '#ddd2b8'; g.lineWidth = .8; g.beginPath(); g.moveTo(6 + 15 * Math.cos(-1.2), -28 + 15 * Math.sin(-1.2)); g.lineTo(6 + 15 * Math.cos(1.2), -28 + 15 * Math.sin(1.2)); g.stroke(); } },
};
function drawMonster(g, k, f) {
  if (k === 'skel') { g.strokeStyle = '#d9d0bb'; g.fillStyle = '#d9d0bb'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-3, -14); g.lineTo(-5 - (f ? 2 : 0), 0); g.moveTo(3, -14); g.lineTo(5 + (f ? 0 : 2), 0); g.moveTo(0, -14); g.lineTo(0, -28); g.stroke();
    g.lineWidth = 1.5; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-5, -26 + i * 4); g.lineTo(5, -26 + i * 4); g.stroke(); }
    g.lineWidth = 2; g.beginPath(); g.moveTo(-6, -27); g.lineTo(-9, -17 + (f ? 2 : 0)); g.moveTo(6, -27); g.lineTo(10, -19 - (f ? 0 : 2)); g.stroke();
    g.beginPath(); g.arc(0, -33, 5.5, 0, TAU); g.fill(); g.fillStyle = '#120808'; g.fillRect(-3, -35, 2.4, 2.6); g.fillRect(1.2, -35, 2.4, 2.6); g.fillStyle = '#e24a2a'; g.fillRect(-2.4, -34.3, 1, 1); g.fillRect(1.8, -34.3, 1, 1);
    g.strokeStyle = '#7a6e5a'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, -19); g.lineTo(14, -34); g.stroke(); }
  else if (k === 'ghoul') { g.fillStyle = '#4a5240'; g.beginPath(); g.ellipse(0, -16, 11, 12, -.25, 0, TAU); g.fill();
    g.fillStyle = '#353b2e'; g.fillRect(-7, -6 - (f ? 2 : 0), 5, 6); g.fillRect(2, -6 - (f ? 0 : 2), 5, 6);
    g.fillStyle = '#5d6650'; g.beginPath(); g.arc(7, -26, 6.5, 0, TAU); g.fill(); g.fillStyle = '#d6e04a'; g.fillRect(8, -28, 2, 2); g.fillRect(11, -27, 1.6, 1.6);
    g.strokeStyle = '#5d6650'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(6, -18); g.lineTo(16, -10 + (f ? 3 : 0)); g.stroke(); g.fillStyle = '#5a0c08'; g.fillRect(6, -22, 6, 2); }
  else if (k === 'imp') { g.fillStyle = '#5a140e'; g.beginPath(); g.moveTo(-3, -18); g.lineTo(-16, -26 - (f ? 4 : 0)); g.lineTo(-10, -14); g.fill(); g.beginPath(); g.moveTo(3, -18); g.lineTo(14, -28 - (f ? 0 : 4)); g.lineTo(9, -14); g.fill();
    g.fillStyle = '#a3261a'; g.beginPath(); g.ellipse(0, -12, 6, 8, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(1, -22, 5, 0, TAU); g.fill();
    g.fillStyle = '#e8d6a8'; g.beginPath(); g.moveTo(-3, -25); g.lineTo(-5, -31); g.lineTo(-1, -26); g.moveTo(4, -25); g.lineTo(6, -31); g.lineTo(2, -26); g.fill(); g.fillStyle = '#ffd34a'; g.fillRect(1, -23, 2, 1.6); g.fillRect(4, -23, 1.6, 1.6);
    g.strokeStyle = '#a3261a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-3, -6); g.quadraticCurveTo(-12, -2, -10, -10); g.stroke(); }
  else if (k === 'brute' || k === 'boss') { const big = k === 'boss';
    g.fillStyle = big ? '#2a0806' : '#3d0c08'; g.fillRect(-11, -14 - (f ? 2 : 0), 8, 14); g.fillRect(3, -14 - (f ? 0 : 2), 8, 14);
    g.fillStyle = big ? '#5c120c' : '#6e1a10'; g.beginPath(); g.moveTo(-16, -40); g.lineTo(16, -40); g.lineTo(11, -12); g.lineTo(-11, -12); g.closePath(); g.fill();
    g.fillStyle = '#2a0806'; g.beginPath(); g.ellipse(-16, -38, 7, 6, 0, 0, TAU); g.ellipse(16, -38, 7, 6, 0, 0, TAU); g.fill();
    g.fillStyle = '#8a2414'; g.beginPath(); g.arc(0, -46, 9, 0, TAU); g.fill();
    g.fillStyle = '#d8c79a'; g.beginPath(); g.moveTo(-6, -51); g.quadraticCurveTo(-16, -56, -14, -66); g.quadraticCurveTo(-10, -56, -2, -54); g.fill(); g.beginPath(); g.moveTo(6, -51); g.quadraticCurveTo(16, -56, 14, -66); g.quadraticCurveTo(10, -56, 2, -54); g.fill();
    g.fillStyle = '#ffcf3a'; g.shadowColor = '#ff6a1a'; g.shadowBlur = 6; g.fillRect(-5, -48, 3.5, 2.5); g.fillRect(2, -48, 3.5, 2.5); g.shadowBlur = 0;
    g.fillStyle = '#ff6a1a'; g.globalAlpha = .7; g.fillRect(-2, -34, 4, 12); g.globalAlpha = 1;
    if (big) { g.strokeStyle = '#1a0504'; g.lineWidth = 4; g.beginPath(); g.moveTo(18, -36); g.lineTo(26, -6); g.stroke(); g.fillStyle = '#9a9a9a'; g.beginPath(); g.moveTo(22, -10); g.lineTo(34, -2); g.lineTo(26, 2); g.fill(); } }
}
function buildSprite(key, draw, w, h, scale) {
  const out = { w, h, f: [] };
  for (let f = 0; f < 2; f++) { const set = [];
    for (let flip = 0; flip < 2; flip++) for (let fl = 0; fl < 2; fl++) { const c = mk(w * scale, h * scale), g = c.getContext('2d'); g.translate(c.width / 2, c.height - 4 * scale); g.scale(scale * (flip ? -1 : 1), scale); draw(g, f);
      if (fl) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,240,220,.85)'; g.fillRect(0, 0, c.width, c.height); }
      set[flip * 2 + fl] = c; }
    out.f[f] = set; }
  SPR[key] = out; }
function buildSprites() { const S2 = 2;
  for (const k in CHAR) buildSprite(k, (g, f) => humanoid(g, CHAR[k], f), 48, 70, S2);
  buildSprite('skel', (g, f) => drawMonster(g, 'skel', f), 40, 48, S2); buildSprite('ghoul', (g, f) => drawMonster(g, 'ghoul', f), 44, 44, S2);
  buildSprite('imp', (g, f) => drawMonster(g, 'imp', f), 40, 40, S2); buildSprite('brute', (g, f) => drawMonster(g, 'brute', f), 52, 74, S2);
  buildSprite('boss', (g, f) => { g.scale(2.1, 2.1); drawMonster(g, 'boss', f); }, 120, 160, S2); }

/* ---------------- floor & decor ---------------- */
let floorPat = null;
function buildFloor() { const T = 256, c = mk(T, T), g = c.getContext('2d'); g.fillStyle = '#17110e'; g.fillRect(0, 0, T, T);
  const tw = 64, th = 32; // iso flagstones
  for (let y = -1; y < T / th + 1; y++) for (let x = -1; x < T / tw + 1; x++) { const cx = x * tw + (y & 1 ? tw / 2 : 0), cy = y * th;
    const v = 30 + Math.random() * 16, r = v + Math.random() * 6; g.fillStyle = `rgb(${r | 0},${v * .86 | 0},${v * .74 | 0})`;
    g.beginPath(); g.moveTo(cx, cy - th / 2 + 2); g.lineTo(cx + tw / 2 - 3, cy); g.lineTo(cx, cy + th / 2 - 2); g.lineTo(cx - tw / 2 + 3, cy); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,230,200,.04)'; g.beginPath(); g.moveTo(cx, cy - th / 2 + 2); g.lineTo(cx + tw / 2 - 3, cy); g.lineTo(cx, cy - 2); g.lineTo(cx - tw / 2 + 3, cy); g.fill();
    if (Math.random() < .25) { g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1; g.beginPath(); let px = cx + rnd(-12, 12), py = cy + rnd(-4, 4); g.moveTo(px, py); for (let i = 0; i < 3; i++) { px += rnd(-8, 8); py += rnd(-4, 4); g.lineTo(px, py); } g.stroke(); } }
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '200,170,140'},${Math.random() * .06})`; g.fillRect(Math.random() * T, Math.random() * T, 2, 2); }
  floorPat = ctx.createPattern(c, 'repeat'); }
const CELL = 340;
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function decorAt(cx, cy) { const h = hash(cx, cy), h2 = hash(cy + 91, cx - 37); const x = cx * CELL + 40 + h2 * (CELL - 80), y = cy * CELL + 40 + hash(cx + 5, cy + 7) * (CELL - 80);
  if (Math.abs(cx) + Math.abs(cy) === 0) return null;
  return h < .3 ? { t: 'pillar', x, y } : h < .45 ? { t: 'brazier', x, y } : h < .62 ? { t: 'blood', x, y, r: 20 + h2 * 40 } : h < .76 ? { t: 'bones', x, y } : h < .84 ? { t: 'grave', x, y } : null; }
function drawDecorFloor(d, t) { const g = ctx;
  if (d.t === 'blood') { g.fillStyle = 'rgba(90,10,6,.55)'; g.beginPath(); g.ellipse(d.x, d.y, d.r, d.r * .5, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(60,6,4,.6)'; g.beginPath(); g.ellipse(d.x + d.r * .4, d.y + 4, d.r * .4, d.r * .2, 0, 0, TAU); g.fill(); }
  else if (d.t === 'bones') { g.strokeStyle = '#8f8572'; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(d.x - 10, d.y); g.lineTo(d.x + 8, d.y + 4); g.moveTo(d.x - 4, d.y - 6); g.lineTo(d.x + 2, d.y + 8); g.stroke(); g.fillStyle = '#a89c84'; g.beginPath(); g.arc(d.x + 12, d.y - 2, 4.5, 0, TAU); g.fill(); g.fillStyle = '#1a1210'; g.fillRect(d.x + 10, d.y - 3, 1.6, 1.6); g.fillRect(d.x + 13, d.y - 3, 1.6, 1.6); } }
function drawDecorUp(d, t) { const g = ctx;
  if (d.t === 'pillar') { g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(d.x, d.y, 26, 12, 0, 0, TAU); g.fill();
    g.fillStyle = '#2b2420'; g.fillRect(d.x - 22, d.y - 8, 44, 10); const gr = g.createLinearGradient(d.x - 16, 0, d.x + 16, 0); gr.addColorStop(0, '#2a231f'); gr.addColorStop(.4, '#4d433b'); gr.addColorStop(1, '#1d1815'); g.fillStyle = gr; g.fillRect(d.x - 16, d.y - 96, 32, 90);
    g.fillStyle = '#3a312b'; g.fillRect(d.x - 20, d.y - 104, 40, 10); g.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 3; i++) g.fillRect(d.x - 10 + i * 8, d.y - 92, 2, 84);
    torchFlame(d.x + 18, d.y - 64, t, .8); g.fillStyle = '#3a2a1a'; g.fillRect(d.x + 14, d.y - 62, 8, 4); }
  else if (d.t === 'brazier') { g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(d.x, d.y, 18, 8, 0, 0, TAU); g.fill(); g.strokeStyle = '#3a312b'; g.lineWidth = 3; g.beginPath(); g.moveTo(d.x - 10, d.y); g.lineTo(d.x, d.y - 20); g.lineTo(d.x + 10, d.y); g.stroke();
    g.fillStyle = '#4a3f36'; g.beginPath(); g.ellipse(d.x, d.y - 22, 14, 6, 0, 0, TAU); g.fill(); torchFlame(d.x, d.y - 26, t, 1.3); }
  else if (d.t === 'grave') { g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(d.x, d.y, 16, 6, 0, 0, TAU); g.fill(); g.fillStyle = '#3d3732'; g.beginPath(); g.moveTo(d.x - 12, d.y); g.lineTo(d.x - 12, d.y - 22); g.quadraticCurveTo(d.x, d.y - 36, d.x + 12, d.y - 22); g.lineTo(d.x + 12, d.y); g.fill();
    g.strokeStyle = '#211c19'; g.lineWidth = 2; g.beginPath(); g.moveTo(d.x, d.y - 24); g.lineTo(d.x, d.y - 10); g.moveTo(d.x - 5, d.y - 19); g.lineTo(d.x + 5, d.y - 19); g.stroke(); } }
function torchFlame(x, y, t, s) { const g = ctx, fl = Math.sin(t * 13 + x) * .15 + Math.sin(t * 7.3 + y) * .1;
  g.fillStyle = '#ff6a1a'; g.beginPath(); g.moveTo(x - 5 * s, y); g.quadraticCurveTo(x - 6 * s, y - 10 * s, x + fl * 10, y - (16 + fl * 8) * s); g.quadraticCurveTo(x + 6 * s, y - 10 * s, x + 5 * s, y); g.fill();
  g.fillStyle = '#ffd36a'; g.beginPath(); g.moveTo(x - 2.5 * s, y); g.quadraticCurveTo(x - 3 * s, y - 6 * s, x + fl * 6, y - 10 * s); g.quadraticCurveTo(x + 3 * s, y - 6 * s, x + 2.5 * s, y); g.fill(); }

/* ---------------- data ---------------- */
const CLASSES = {
  warrior: { name: 'Warrior', glow: '#5a1a10', hp: 150, armor: 3, speed: 145, start: 'arc', blurb: 'Iron-clad. Cleaves all who close in.', perk: 'Passive: takes 20% less damage', dr: .2,
    w: { arc: 3, blades: 2.5, nova: 1.5, spear: 1.2, armor: 2, maxhp: 2, might: 1.6, regen: 1.5 } },
  assassin: { name: 'Assassin', glow: '#3a1450', hp: 80, armor: 0, speed: 200, start: 'dagger', blurb: 'Swift as smoke. Daggers that find the heart.', perk: 'Passive: 15% dodge, +20% crit', dodge: .15, crit: .2,
    w: { dagger: 3, chain: 2, blades: 1.6, speed: 2, cooldown: 2, might: 1.4, magnet: 1.3 } },
  mage: { name: 'Mage', glow: '#14245a', hp: 85, armor: 0, speed: 155, start: 'fire', blurb: 'Fragile flesh, terrible fire.', perk: 'Passive: -15% cooldown, +15% area', cdr: .15, area: .15,
    w: { fire: 3, nova: 2.6, chain: 2.4, holy: 2, area: 2, cooldown: 2 } },
  archer: { name: 'Archer', glow: '#24360f', hp: 100, armor: 1, speed: 170, start: 'arrow', blurb: 'Strikes from the dark. Arrows pierce the rank.', perk: 'Passive: +1 projectile, +1 pierce', proj: 1, pierce: 1,
    w: { arrow: 3, spear: 2.6, holy: 2, dagger: 1.2, magnet: 1.6, speed: 1.5, might: 1.5 } },
};
const WEAP = {
  arc: { name: 'Cleaving Arc', ic: '⚔', c: '#8a2a1a', cd: .95, d: 'Sweep a heavy blade through foes in front.', up: ['+30% damage', '+25% arc width', '-15% cooldown', 'Strikes twice'], evo: 'might', evoName: 'Executioner\'s Wheel' },
  dagger: { name: 'Throwing Daggers', ic: '🗡', c: '#5a2a7a', cd: .6, d: 'Hurl daggers at the nearest foe. Can crit.', up: ['+1 dagger', '+30% damage', '+1 dagger', '+1 pierce, -15% cooldown'], evo: 'cooldown', evoName: 'Fan of a Thousand Cuts' },
  fire: { name: 'Fire Bolt', ic: '☄', c: '#b0401a', cd: 1.3, d: 'A bolt that bursts into flame on impact.', up: ['+30% damage', '+1 bolt', '+25% blast radius', '+1 bolt'], evo: 'area', evoName: 'Inferno' },
  arrow: { name: 'Piercing Arrows', ic: '➶', c: '#4a6a1a', cd: .85, d: 'Arrows that pierce through the ranks.', up: ['+1 arrow', '+2 pierce', '+30% damage', '+1 arrow, -15% cooldown'], evo: 'speed', evoName: 'Storm of Arrows' },
  holy: { name: 'Holy Bolt', ic: '✦', c: '#c9a24a', cd: 1.05, d: 'Seeking bolts of white fire.', up: ['+1 bolt', '+30% damage', '+1 bolt', '-20% cooldown'], evo: 'regen', evoName: 'Sanctified Lance' },
  blades: { name: 'Whirling Blades', ic: '✷', c: '#6a6a7a', cd: 0, d: 'Blades orbit you, cutting all they touch.', up: ['+1 blade', '+30% damage', '+1 blade, +15% radius', '+1 blade'], evo: 'armor', evoName: 'Iron Maelstrom' },
  nova: { name: 'Fire Nova', ic: '✺', c: '#c2501a', cd: 3.2, d: 'A ring of fire bursts from you, hurling foes back.', up: ['+30% damage', '+20% radius', '-15% cooldown', '+30% damage'], evo: 'maxhp', evoName: 'Hellfire Corona' },
  chain: { name: 'Chain Lightning', ic: 'ϟ', c: '#3a6ac2', cd: 1.6, d: 'Lightning leaps between enemies.', up: ['+2 jumps', '+30% damage', '+2 jumps', '-20% cooldown'], evo: 'magnet', evoName: 'Tempest Coil' },
  spear: { name: 'Bone Spear', ic: '☩', c: '#bdb39a', cd: 1.5, d: 'A spear of bone that pierces everything in your path.', up: ['+30% damage', '+1 spear', '-15% cooldown', '+40% size'], evo: 'might', evoName: 'Ossuary Pike' },
};
const PASS = {
  speed: { name: 'Haste', ic: '➹', c: '#4a6a3a', d: '+10% move speed' }, might: { name: 'Might', ic: '✊', c: '#8a1a14', d: '+12% damage' },
  area: { name: 'Reach', ic: '◎', c: '#6a3a8a', d: '+12% area' }, cooldown: { name: 'Swiftness', ic: '⌛', c: '#3a5a8a', d: '-8% cooldowns' },
  magnet: { name: 'Lodestone', ic: '⊛', c: '#3a7a7a', d: '+30% pickup radius' }, armor: { name: 'Plate', ic: '⛨', c: '#5a5a5a', d: '+1 armor' },
  maxhp: { name: 'Vigor', ic: '❤', c: '#9e1b14', d: '+20 max health' }, regen: { name: 'Renewal', ic: '✚', c: '#2a7a4a', d: '+0.4 health / sec' },
};
const MON = { skel: { hp: 14, sp: 52, dmg: 7, r: 11, xp: 1 }, imp: { hp: 9, sp: 92, dmg: 5, r: 9, xp: 1 }, ghoul: { hp: 34, sp: 44, dmg: 11, r: 13, xp: 2 },
  brute: { hp: 260, sp: 50, dmg: 18, r: 20, xp: 12, elite: 1 }, boss: { hp: 2600, sp: 58, dmg: 26, r: 38, xp: 60, boss: 1 } };
const GOAL = 600, BOSSES = [180, 390];

/* ---------------- state ---------------- */
let S = null, P = null, CLS = store.get('cls', 'warrior');
const MAXE = 320, MAXB = 360, MAXG = 420, MAXFX = 360;
function pool(n, f) { const a = []; for (let i = 0; i < n; i++) a.push(f()); return a; }
const E = pool(MAXE + 6, () => ({ on: false })), B = pool(MAXB, () => ({ on: false })), GEM = pool(MAXG, () => ({ on: false })), FX = pool(MAXFX, () => ({ on: false }));
const EB = pool(120, () => ({ on: false }));
function take(arr) { for (let i = 0; i < arr.length; i++) if (!arr[i].on) { arr[i].on = true; return arr[i]; } return null; }
const GRID = new Map(), GC = 64;
function gridBuild() { for (const v of GRID.values()) v.length = 0; for (const e of E) if (e.on) { const k = ((e.x / GC | 0) + 4096) * 8192 + ((e.y / GC | 0) + 4096); let a = GRID.get(k); if (!a) GRID.set(k, a = []); a.push(e); } }
function near(x, y, r, cb) { const x0 = (x - r) / GC | 0, x1 = (x + r) / GC | 0, y0 = (y - r) / GC | 0, y1 = (y + r) / GC | 0;
  for (let cx = x0 - 1; cx <= x1; cx++) for (let cy = y0 - 1; cy <= y1; cy++) { const a = GRID.get((cx + 4096) * 8192 + cy + 4096); if (a) for (let i = 0; i < a.length; i++) if (a[i].on && cb(a[i]) === true) return; } }
function nearest(x, y, maxR, skip) { let best = null, bd = maxR * maxR; for (const e of E) { if (!e.on || (skip && skip.has(e))) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; best = e; } } return best; }

function newRun(cls) {
  CLS = cls; store.set('cls', cls); const C = CLASSES[cls];
  for (const a of [E, B, GEM, FX, EB]) for (const o of a) o.on = false;
  P = { x: 0, y: 0, vx: 0, vy: 0, face: 1, ax: 1, ay: 0, hp: C.hp, maxhp: C.hp, armor: C.armor, speed: C.speed, might: 1, area: 1 + (C.area || 0), cdm: 1 - (C.cdr || 0), magnet: 70, regen: 0,
    crit: .05 + (C.crit || 0), dodge: C.dodge || 0, dr: C.dr || 0, proj: C.proj || 0, pierce: C.pierce || 0, lvl: 1, xp: 0, next: 6, inv: 0, walk: 0, hurtT: 0 };
  S = { t: 0, kills: 0, state: 'play', weapons: [], passives: {}, spawnAcc: 0, nextElite: 75, bossIdx: 0, finalBoss: false, boss: null, shake: 0, pendingLv: 0, chests: [], potions: [], dmgDealt: 0, won: false, banners: [], surge: 60 };
  addWeapon(C.start); $('hud').classList.remove('hidden'); showScreen(null); banner(C.name.toUpperCase(), 'Survive until dawn');
}
function addWeapon(id) { S.weapons.push({ id, lvl: 1, t: .3, evo: false, ang: 0, hits: new Map() }); }
function wlv(id) { const w = S.weapons.find(w => w.id === id); return w ? w.lvl : 0; }

/* ---------------- spawning ---------------- */
function spawn(kind, x, y) { const e = take(E); if (!e) return null; const m = MON[kind], tm = S.t / 60;
  const hpMul = m.boss ? (1 + S.bossIdx) * (1 + tm * .15) : 1 + tm * .26 + tm * tm * .03;
  if (x == null) { const hw = W / Z / 2 + 30, hh = H / Z / 2 + 40, a = Math.random() * TAU, c = Math.cos(a), sn = Math.sin(a), k = Math.min(hw / Math.abs(c || 1e-6), hh / Math.abs(sn || 1e-6)); x = P.x + c * k; y = P.y + sn * k; }
  Object.assign(e, { kind, x, y, vx: 0, vy: 0, hp: m.hp * hpMul, max: m.hp * hpMul, sp: m.sp * (1 + Math.min(.35, tm * .03)) * rnd(.9, 1.1), dmg: m.dmg * (1 + tm * .08), r: m.r, xp: m.xp, elite: !!m.elite, boss: !!m.boss, flash: 0, f: Math.random() * 2, kb: 0, shootT: 3, slow: 0, final: false });
  return e; }
function spawner(dt) {
  const tm = S.t / 60, live = E.reduce((n, e) => n + (e.on ? 1 : 0), 0);
  const rate = S.finalBoss ? 1.2 : 1.6 + tm * 2.1 + tm * tm * .12;
  S.spawnAcc += rate * dt;
  while (S.spawnAcc >= 1) { S.spawnAcc--; if (live >= MAXE - 10) break; const r = Math.random();
    const k = tm > 1.2 && r < Math.min(.35, .1 + tm * .03) ? 'ghoul' : tm > .6 && r > 1 - Math.min(.35, .12 + tm * .03) ? 'imp' : 'skel'; spawn(k); }
  if (S.t >= S.surge && !S.finalBoss) { S.surge += 60; const n = Math.min(40, 14 + tm * 3 | 0), a0 = Math.random() * TAU, R = Math.hypot(W, H) / Z / 2 + 30;
    for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU; spawn(tm > 3 ? 'ghoul' : 'skel', P.x + Math.cos(a) * R, P.y + Math.sin(a) * R); } banner('THE DEAD SURGE', ''); }
  if (S.t >= S.nextElite) { S.nextElite += Math.max(35, 60 - tm * 3); spawn('brute'); }
  if (S.bossIdx < BOSSES.length && S.t >= BOSSES[S.bossIdx]) { S.boss = spawn('boss'); S.bossIdx++; banner('A FIEND AWAKENS', 'Slay it for a reliquary'); sfx.boss(); }
  if (!S.finalBoss && S.t >= GOAL) { S.finalBoss = true; S.bossIdx = 4; const b = spawn('boss'); if (b) { b.hp = b.max = clamp(S.dmgDealt / S.t * 50, 6000, 20000); b.final = true; b.r = 44; S.boss = b; } banner('THE ASH LORD RISES', 'Destroy him to end the night'); sfx.boss(); }
}

/* ---------------- combat ---------------- */
function fx(o) { const f = take(FX); if (f) Object.assign(f, { vx: 0, vy: 0, r: 2, life: .4, max: .4, c: '#ff8a3a', t: 'p', a: 0, pts: null, g: 0 }, o, { on: true }); return f; }
function bullet(o) { const b = take(B); if (b) Object.assign(b, { pierce: 0, life: 1.6, r: 6, hit: null, boom: 0, crit: 0, home: 0, kind: 'bolt', spin: 0 }, o, { on: true }); if (b) b.hit = b.hit || new Set(); else return null; b.hit.clear(); return b; }
function hurt(e, dmg, kx = 0, ky = 0, canCrit = false) { if (!e.on) return; let crit = false;
  if (canCrit && Math.random() < P.crit) { dmg *= 2.4; crit = true; }
  dmg *= P.might; S.dmgDealt += Math.min(dmg, Math.max(0, e.hp)); e.hp -= dmg; e.flash = .08; if (!e.boss) { e.vx += kx; e.vy += ky; }
  if (crit) fx({ t: 'txt', x: e.x, y: e.y - 30, s: 'CRIT', c: '#f0d58a', life: .5, max: .5, vy: -40 });
  sfx.hit(); if (e.hp <= 0) kill(e); }
function kill(e) { e.on = false; S.kills++; sfx.kill();
  for (let i = 0; i < (e.boss ? 40 : 5); i++) fx({ x: e.x + rnd(-6, 6), y: e.y - 10, vx: rnd(-90, 90), vy: rnd(-120, 20), g: 260, r: rnd(1.5, 3.5), c: e.kind === 'skel' ? '#cfc6b0' : '#7a120c', life: rnd(.3, .6) });
  fx({ t: 'decal', x: e.x, y: e.y, r: e.r * rnd(.8, 1.3), c: e.kind === 'skel' ? 'rgba(160,150,130,.25)' : 'rgba(90,8,5,.45)', life: 8, max: 8 });
  if (e.boss) { S.chests.push({ x: e.x, y: e.y, big: true }); if (S.boss === e) S.boss = null; if (e.final) { S.won = true; setTimeout(() => endRun(true), 1200); } shake(14); }
  else if (e.elite) S.chests.push({ x: e.x, y: e.y });
  else if (S.potions.length < 4 && Math.random() < .012) S.potions.push({ x: e.x, y: e.y });
  dropGem(e.x, e.y, e.xp * (e.boss ? 10 : 1)); }
function dropGem(x, y, v) { let g = take(GEM);
  if (!g) { let best = null, bd = 1e18; for (const q of GEM) { const d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < bd) { bd = d; best = q; } } if (best) best.v += v; return; }
  Object.assign(g, { x: x + rnd(-6, 6), y: y + rnd(-6, 6), v, pull: false }); }
function shake(v) { S.shake = Math.max(S.shake, v); }
const WFIRE = {
  arc(w, L, ev) { const R = 92 * P.area * (L >= 2 ? 1.25 : 1) * (ev ? 1.25 : 1), span = ev ? TAU : 2.6 * (L >= 3 ? 1.25 : 1), dmg = (22 + (L >= 2 ? 7 : 0) + (L >= 5 ? 8 : 0)) * (ev ? 1.7 : 1), a0 = (t => t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.atan2(P.ay, P.ax))(nearest(P.x, P.y, R * 1.8));
    const go = a => { fx({ t: 'arc', x: P.x, y: P.y - 14, r: R, a, span, life: .22, max: .22, c: ev ? '#ffcf6a' : '#e8e0d0' }); sfx.shoot();
      near(P.x, P.y, R + 20, e => { const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy); if (d > R + e.r) return; let da = Math.abs(((Math.atan2(dy, dx) - a) % TAU + TAU * 1.5) % TAU - Math.PI); if (span < TAU && da > span / 2) return; hurt(e, dmg, dx / d * 160, dy / d * 160); }); };
    if (w.again) { w.again = 0; go(a0 + Math.PI); return; } go(a0); if (L >= 5) { w.again = 1; w.t = .18; return true; } },
  dagger(w, L, ev) { const n = 1 + (L >= 2) + (L >= 4) + P.proj + (ev ? 4 : 0), t = nearest(P.x, P.y, 420); const base = t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.atan2(P.ay, P.ax);
    for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * (ev ? .22 : .12); bullet({ kind: 'dagger', x: P.x, y: P.y - 16, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, dmg: (8 + (L >= 3 ? 3 : 0)) * (ev ? 1.4 : 1), crit: 1, pierce: (L >= 5 ? 1 : 0) + (ev ? 2 : 0), life: .8, r: 6 }); } sfx.shoot(); },
  fire(w, L, ev) { const n = 1 + (L >= 3) + (L >= 5) + (ev ? 1 : 0); for (let i = 0; i < n; i++) { const t = nearest(P.x, P.y, 460) ; const a = t ? Math.atan2(t.y - P.y, t.x - P.x) + (i ? rnd(-.5, .5) : 0) : rnd(0, TAU);
      bullet({ kind: 'fire', x: P.x, y: P.y - 18, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, dmg: (18 + (L >= 2 ? 6 : 0)) * (ev ? 1.6 : 1), boom: 48 * P.area * (L >= 4 ? 1.25 : 1) * (ev ? 1.5 : 1), life: 1.4, r: 8 }); } sfx.shoot(); },
  arrow(w, L, ev) { const n = 1 + (L >= 2) + (L >= 5) + P.proj + (ev ? 3 : 0), t = nearest(P.x, P.y, 480), base = t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.atan2(P.ay, P.ax);
    for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * .1; bullet({ kind: 'arrow', x: P.x, y: P.y - 18, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, dmg: (11 + (L >= 4 ? 4 : 0)) * (ev ? 1.4 : 1), pierce: 2 + P.pierce + (L >= 3 ? 2 : 0) + (ev ? 4 : 0), life: 1, r: 6 }); } sfx.shoot(); },
  holy(w, L, ev) { const n = 1 + (L >= 2) + (L >= 4) + (ev ? 2 : 0); for (let i = 0; i < n; i++) { const a = rnd(0, TAU);
      bullet({ kind: 'holy', x: P.x, y: P.y - 18, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, dmg: (13 + (L >= 3 ? 5 : 0)) * (ev ? 1.6 : 1), home: 1, life: 2.2, r: 7, pierce: ev ? 3 : 0 }); } sfx.shoot(); },
  nova(w, L, ev) { const R = 120 * P.area * (L >= 3 ? 1.2 : 1) * (ev ? 1.4 : 1), dmg = (22 + (L >= 2 ? 7 : 0) + (L >= 5 ? 8 : 0)) * (ev ? 1.6 : 1);
    fx({ t: 'ring', x: P.x, y: P.y, r: R, life: .45, max: .45, c: ev ? '#ffcf6a' : '#ff6a1a' }); sfx.nova(); shake(3);
    near(P.x, P.y, R, e => { const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1; if (d < R + e.r) hurt(e, dmg, dx / d * 260, dy / d * 260); });
    if (ev) P.hp = Math.min(P.maxhp, P.hp + 2); },
  chain(w, L, ev) { const jumps = 2 + (L >= 2 ? 2 : 0) + (L >= 4 ? 2 : 0) + (ev ? 4 : 0), dmg = (15 + (L >= 3 ? 6 : 0)) * (ev ? 1.5 : 1), hit = new Set(); let x = P.x, y = P.y - 18, t = nearest(P.x, P.y, 300); const pts = [[x, y]];
    for (let j = 0; t && j <= jumps; j++) { hit.add(t); pts.push([t.x, t.y - 14]); hurt(t, dmg); t = nearest(t.x, t.y, 140, hit); }
    if (pts.length > 1) { fx({ t: 'bolt', pts, life: .18, max: .18, c: '#9ad0ff' }); sfx.zap(); } },
  spear(w, L, ev) { const n = 1 + (L >= 3) + (ev ? 2 : 0), s = (L >= 5 ? 1.4 : 1) * (ev ? 1.4 : 1); for (let i = 0; i < n; i++) { const a = Math.atan2(P.ay, P.ax) + (i - (n - 1) / 2) * .25;
      bullet({ kind: 'spear', x: P.x, y: P.y - 16, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, dmg: (24 + (L >= 2 ? 8 : 0)) * (ev ? 1.6 : 1), pierce: 999, life: 1.1, r: 9 * s, sz: s }); } sfx.shoot(); },
};
function cdOf(w) { const d = WEAP[w.id]; let cd = d.cd; const L = w.lvl;
  if ((w.id === 'arc' && L >= 4) || (w.id === 'dagger' && L >= 5) || (w.id === 'arrow' && L >= 5) || (w.id === 'nova' && L >= 4) || (w.id === 'spear' && L >= 4)) cd *= .85;
  if ((w.id === 'holy' && L >= 5) || (w.id === 'chain' && L >= 5)) cd *= .8; if (w.evo) cd *= .8; return cd * P.cdm; }
function updWeapons(dt) {
  for (const w of S.weapons) {
    if (w.id === 'blades') { const n = Math.min(8, 2 + (w.lvl >= 2) + (w.lvl >= 4) + (w.lvl >= 5) + (w.evo ? 3 : 0)), R = 64 * P.area * (w.lvl >= 4 ? 1.15 : 1) * (w.evo ? 1.3 : 1), dmg = (7 + (w.lvl >= 3 ? 3 : 0)) * (w.evo ? 1.6 : 1);
      w.ang += dt * (w.evo ? 4.2 : 3.4); w.n = n; w.R = R;
      for (const [e, tt] of w.hits) { if (tt - dt <= 0 || !e.on) w.hits.delete(e); else w.hits.set(e, tt - dt); }
      for (let i = 0; i < n; i++) { const a = w.ang + i / n * TAU, bx = P.x + Math.cos(a) * R, by = P.y - 12 + Math.sin(a) * R * .6;
        near(bx, by, 24, e => { if (w.hits.has(e)) return; if ((e.x - bx) ** 2 + (e.y - 10 - by) ** 2 < (e.r + 12) ** 2) { w.hits.set(e, .45); hurt(e, dmg, Math.cos(a) * 60, Math.sin(a) * 60); } }); } continue; }
    w.t -= dt; if (w.t <= 0) { const keep = WFIRE[w.id](w, w.lvl, w.evo); if (!keep) w.t = cdOf(w); } }
}
function updBullets(dt) {
  for (const b of B) { if (!b.on) continue; b.life -= dt; if (b.life <= 0) { b.on = false; if (b.boom) boom(b); continue; }
    if (b.home) { const t = nearest(b.x, b.y, 300); if (t) { const a = Math.atan2(t.y - 12 - b.y, t.x - b.x), sp = Math.hypot(b.vx, b.vy); const cur = Math.atan2(b.vy, b.vx); let da = ((a - cur + Math.PI * 3) % TAU) - Math.PI; const na = cur + clamp(da, -5 * dt, 5 * dt); const s2 = Math.min(520, sp + 400 * dt); b.vx = Math.cos(na) * s2; b.vy = Math.sin(na) * s2; } }
    b.x += b.vx * dt; b.y += b.vy * dt; b.spin += dt * 20;
    if (b.kind === 'fire' && Math.random() < .5) fx({ x: b.x, y: b.y, vx: rnd(-20, 20), vy: rnd(-40, 0), r: rnd(2, 4), c: Math.random() < .5 ? '#ff6a1a' : '#ffb04a', life: .3, max: .3 });
    if (b.kind === 'holy' && Math.random() < .4) fx({ x: b.x, y: b.y, r: rnd(1.5, 3), c: '#fff2c0', life: .25, max: .25 });
    near(b.x, b.y + 12, b.r + 24, e => { if (b.hit.has(e)) return; if ((e.x - b.x) ** 2 + (e.y - 12 - b.y) ** 2 > (e.r + b.r) ** 2) return;
      b.hit.add(e); const sp = Math.hypot(b.vx, b.vy) || 1; hurt(e, b.dmg, b.vx / sp * 90, b.vy / sp * 90, !!b.crit || CLS === 'assassin');
      if (b.boom) { b.on = false; boom(b); return true; } if (b.pierce-- <= 0) { b.on = false; return true; } }); }
  for (const b of EB) { if (!b.on) continue; b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.life <= 0) { b.on = false; continue; }
    if (Math.random() < .3) fx({ x: b.x, y: b.y, r: rnd(2, 3), c: '#ff3a1a', life: .25, max: .25 });
    if ((b.x - P.x) ** 2 + (b.y - (P.y - 16)) ** 2 < 15 ** 2) { b.on = false; damageP(b.dmg); } }
}
function boom(b) { fx({ t: 'ring', x: b.x, y: b.y + 8, r: b.boom, life: .3, max: .3, c: '#ff8a3a', fill: 1 }); for (let i = 0; i < 8; i++) fx({ x: b.x, y: b.y, vx: rnd(-120, 120), vy: rnd(-120, 60), r: rnd(2, 4), c: '#ffb04a', life: .35, max: .35 });
  near(b.x, b.y, b.boom + 20, e => { const d = Math.hypot(e.x - b.x, e.y - 10 - b.y); if (d < b.boom + e.r) hurt(e, b.dmg * .7, (e.x - b.x) / (d || 1) * 120, (e.y - b.y) / (d || 1) * 120); }); }
function damageP(d) { if (P.inv > 0 || S.god) return; if (Math.random() < P.dodge) { fx({ t: 'txt', x: P.x, y: P.y - 50, s: 'DODGE', c: '#d6b0ff', life: .5, max: .5, vy: -40 }); P.inv = .25; return; }
  const dmg = Math.max(1, d * (1 - P.dr) - P.armor); P.hp -= dmg; P.inv = .45; P.hurtT = .25; shake(6); sfx.hurt(); try { navigator.vibrate && navigator.vibrate(15); } catch {}
  if (P.hp <= 0) { P.hp = 0; endRun(false); } }

/* ---------------- level up ---------------- */
function gainXP(v) { P.xp += v; while (P.xp >= P.next) { P.xp -= P.next; P.lvl++; P.next = Math.round(6 + P.lvl * 4.2 + Math.pow(P.lvl, 1.55)); S.pendingLv++; } }
function options() { const C = CLASSES[CLS], opts = [], wt = id => (C.w[id] || 1);
  for (const id in WEAP) { const L = wlv(id); if (L >= 5 || (!L && S.weapons.length >= 5)) continue; opts.push({ k: 'w', id, w: wt(id) * (L ? 2.2 : 1) }); }
  for (const id in PASS) { const L = S.passives[id] || 0; if (L >= 5 || (!L && Object.keys(S.passives).length >= 5)) continue; opts.push({ k: 'p', id, w: wt(id) * (L ? 1.4 : 1) }); }
  const out = []; while (out.length < 3 && opts.length) { let s = opts.reduce((a, o) => a + o.w, 0), r = Math.random() * s, i = 0; for (; i < opts.length - 1; i++) { r -= opts[i].w; if (r <= 0) break; } out.push(opts.splice(i, 1)[0]); }
  if (!out.length) out.push({ k: 'heal' }); return out; }
function applyOpt(o) {
  if (o.k === 'w') { const w = S.weapons.find(w => w.id === o.id); if (w) { if (w.lvl < 5) w.lvl++; else P.hp = Math.min(P.maxhp, P.hp + 20); } else if (S.weapons.length < 6) addWeapon(o.id); }
  else if (o.k === 'p') { S.passives[o.id] = (S.passives[o.id] || 0) + 1; const id = o.id;
    if (id === 'speed') P.speed *= 1.1; if (id === 'might') P.might += .12; if (id === 'area') P.area += .12; if (id === 'cooldown') P.cdm *= .92; if (id === 'magnet') P.magnet *= 1.3; if (id === 'armor') P.armor += 1; if (id === 'maxhp') { P.maxhp += 20; P.hp += 20; } if (id === 'regen') P.regen += .4; }
  else P.hp = Math.min(P.maxhp, P.hp + P.maxhp * .4); }
function optCard(o) { if (o.k === 'heal') return { ic: '⚱', c: '#9e1b14', name: 'Elixir', lv: '', d: 'Restore 40% health' };
  if (o.k === 'w') { const d = WEAP[o.id], L = wlv(o.id); return { ic: d.ic, c: d.c, name: d.name, lv: L ? `Lv ${L + 1}` : 'New', d: L ? d.up[L - 1] : d.d }; }
  const d = PASS[o.id], L = S.passives[o.id] || 0; return { ic: d.ic, c: d.c, name: d.name, lv: L ? `Lv ${L + 1}` : 'New', d: d.d }; }
function openLevelUp() { S.state = 'level'; sfx.level(); const ops = options(); $('luTitle').textContent = 'Level ' + P.lvl; $('luSub').textContent = 'Choose a blessing';
  const box = $('choices'); box.innerHTML = '';
  ops.forEach((o, i) => { const c = optCard(o), b = document.createElement('button'); b.className = 'ch'; b.style.setProperty('--c', c.c); b.innerHTML = `<span class="ic">${c.ic}</span><span><b>${c.name}<em>${c.lv}</em></b><small>${c.d}</small></span>`;
    b.onclick = () => { applyOpt(o); S.pendingLv--; if (S.pendingLv > 0) openLevelUp(); else { showScreen(null); S.state = 'play'; } }; box.appendChild(b); });
  showScreen('levelup'); S.opts = ops; }
function openChest(big) { sfx.chest(); shake(4);
  const w = S.weapons.find(w => w.lvl >= 5 && !w.evo && S.passives[WEAP[w.id].evo]);
  if (w) { w.evo = true; banner(WEAP[w.id].evoName.toUpperCase(), 'Weapon evolved'); return; }
  const n = big ? 3 : 1, got = []; for (let i = 0; i < n; i++) { const o = options().find(o => o.k !== 'heal'); if (o) { applyOpt(o); got.push(optCard(o).name); } else P.hp = P.maxhp; }
  banner('RELIQUARY', got.join(' · ') || 'Fully restored'); }

/* ---------------- update ---------------- */
const IN = { kx: 0, ky: 0, jx: 0, jy: 0, jon: false, ox: 0, oy: 0, px: 0, py: 0, keys: new Set() };
function update(dt) {
  S.t += dt; spawner(dt);
  let mx = IN.kx + IN.jx, my = IN.ky + IN.jy; if (S.bot) { const a = S.t * .9; mx = Math.cos(a); my = Math.sin(a); }
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  P.vx = mx * P.speed; P.vy = my * P.speed; P.x += P.vx * dt; P.y += P.vy * dt; if (ml > .1) { P.ax = mx / Math.max(ml, 1e-3); P.ay = my / Math.max(ml, 1e-3); if (Math.abs(mx) > .05) P.face = mx > 0 ? 1 : -1; P.walk += dt * 8; }
  P.inv -= dt; P.hurtT -= dt; P.hp = Math.min(P.maxhp, P.hp + P.regen * dt);
  gridBuild();
  for (const e of E) { if (!e.on) continue; const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d > 1400) { e.on = false; continue; }
    e.vx *= Math.pow(.02, dt); e.vy *= Math.pow(.02, dt);
    let sx = 0, sy = 0; near(e.x, e.y, e.r * 2, o => { if (o === e) return; const ox = e.x - o.x, oy = e.y - o.y, dd = ox * ox + oy * oy, rr = (e.r + o.r) * .9; if (dd < rr * rr && dd > .01) { const q = Math.sqrt(dd); sx += ox / q * (rr - q); sy += oy / q * (rr - q); } });
    e.x += (dx / d * e.sp + e.vx) * dt + sx * .35; e.y += (dy / d * e.sp + e.vy) * dt + sy * .35; e.f += dt * e.sp / 14; e.flash -= dt;
    if (e.boss) { e.shootT -= dt; if (e.shootT <= 0) { e.shootT = e.final ? 2.2 : 3; const n = e.final ? 16 : 10, a0 = Math.random(); for (let i = 0; i < n; i++) { const b = take(EB); if (b) Object.assign(b, { x: e.x, y: e.y - 40, vx: Math.cos(a0 + i / n * TAU) * 150, vy: Math.sin(a0 + i / n * TAU) * 150, life: 4, dmg: 14 }); } } }
    if (d < e.r + 12) damageP(e.dmg); }
  updWeapons(dt); updBullets(dt);
  for (const g of GEM) { if (!g.on) continue; const dx = P.x - g.x, dy = P.y - 10 - g.y, d = Math.hypot(dx, dy); if (d < P.magnet) g.pull = true;
    if (g.pull) { const s = Math.max(260, 900 - d * 2); g.x += dx / (d || 1) * s * dt; g.y += dy / (d || 1) * s * dt; if (d < 14) { g.on = false; gainXP(g.v); sfx.gem(); } } }
  for (let i = S.chests.length - 1; i >= 0; i--) { const c = S.chests[i]; if (Math.hypot(c.x - P.x, c.y - P.y) < 30) { S.chests.splice(i, 1); openChest(c.big); } }
  for (let i = S.potions.length - 1; i >= 0; i--) { const c = S.potions[i]; if (Math.hypot(c.x - P.x, c.y - P.y) < 26) { S.potions.splice(i, 1); P.hp = Math.min(P.maxhp, P.hp + 30); sfx.heal(); fx({ t: 'txt', x: P.x, y: P.y - 50, s: '+30', c: '#ff6a5a', life: .7, max: .7, vy: -30 }); } }
  for (const f of FX) { if (!f.on) continue; f.life -= dt; if (f.life <= 0) { f.on = false; continue; } f.vy += f.g * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
  S.shake *= Math.pow(.01, dt);
  if (S.pendingLv > 0 && S.state === 'play') openLevelUp();
}

/* ---------------- render ---------------- */
function sprite(key, x, y, f, flip, flash, s = .5) { const sp = SPR[key], c = sp.f[f & 1][(flip ? 2 : 0) + (flash ? 1 : 0)]; ctx.drawImage(c, x - c.width * s / 2, y - c.height * s + 4 * s * 2, c.width * s, c.height * s); }
function shadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * .42, 0, 0, TAU); ctx.fill(); }
const LIGHTS = [];
function render(now) { const t = now / 1000, g = ctx;
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = '#0b0706'; g.fillRect(0, 0, W, H);
  if (!S) { drawTitleBG(t); return; }
  const sk = S.shake, camX = P.x - W / 2 / Z + rnd(-sk, sk), camY = P.y - 20 - H / 2 / Z + rnd(-sk, sk);
  g.setTransform(DPR * Z, 0, 0, DPR * Z, -camX * DPR * Z, -camY * DPR * Z);
  g.fillStyle = floorPat; g.fillRect(camX, camY, W / Z, H / Z);
  LIGHTS.length = 0; LIGHTS.push([P.x, P.y - 20, 340, 1]);
  const c0 = Math.floor(camX / CELL) - 1, c1 = Math.floor((camX + W / Z) / CELL) + 1, r0 = Math.floor(camY / CELL) - 1, r1 = Math.floor((camY + H / Z) / CELL) + 1, ups = [];
  for (let cx = c0; cx <= c1; cx++) for (let cy = r0; cy <= r1; cy++) { const d = decorAt(cx, cy); if (!d) continue; drawDecorFloor(d, t); if (d.t === 'pillar' || d.t === 'brazier' || d.t === 'grave') ups.push(d);
    if (d.t === 'pillar') LIGHTS.push([d.x + 18, d.y - 70, 150, .8]); if (d.t === 'brazier') LIGHTS.push([d.x, d.y - 30, 190, 1]); }
  for (const f of FX) if (f.on && f.t === 'decal') { g.globalAlpha = Math.min(1, f.life / 2); g.fillStyle = f.c; g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r * .45, 0, 0, TAU); g.fill(); } g.globalAlpha = 1;
  for (const gm of GEM) if (gm.on) { const big = gm.v >= 20 ? 2 : gm.v >= 5 ? 1 : 0, col = ['#5ad0ff', '#7aff8a', '#ff4a6a'][big], s = 3.2 + big * 1.6, bob = Math.sin(t * 5 + gm.x) * 1.5;
    g.fillStyle = col; g.globalAlpha = .25; g.beginPath(); g.arc(gm.x, gm.y + bob, s * 2.4, 0, TAU); g.fill(); g.globalAlpha = 1; g.beginPath(); g.moveTo(gm.x, gm.y - s * 1.4 + bob); g.lineTo(gm.x + s, gm.y + bob); g.lineTo(gm.x, gm.y + s * 1.4 + bob); g.lineTo(gm.x - s, gm.y + bob); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(gm.x - 1, gm.y - s * .8 + bob, 1.6, 2); if (big) LIGHTS.push([gm.x, gm.y, 40, .5]); }
  for (const c of S.chests) { const s = c.big ? 1.4 : 1, gl = .6 + Math.sin(t * 4) * .3; g.fillStyle = `rgba(240,200,90,${.25 * gl})`; g.beginPath(); g.arc(c.x, c.y - 8, 30 * s, 0, TAU); g.fill(); shadow(c.x, c.y, 14 * s);
    g.fillStyle = '#5a3a1a'; g.fillRect(c.x - 12 * s, c.y - 16 * s, 24 * s, 14 * s); g.fillStyle = '#7a5226'; g.fillRect(c.x - 12 * s, c.y - 22 * s, 24 * s, 7 * s); g.fillStyle = '#c9a24a'; g.fillRect(c.x - 12 * s, c.y - 16 * s, 24 * s, 2 * s); g.fillRect(c.x - 2 * s, c.y - 18 * s, 4 * s, 6 * s); LIGHTS.push([c.x, c.y - 10, 90, .9]); }
  for (const c of S.potions) { shadow(c.x, c.y, 6); g.fillStyle = '#b01a14'; g.beginPath(); g.arc(c.x, c.y - 7, 6, 0, TAU); g.fill(); g.fillStyle = '#c9b48a'; g.fillRect(c.x - 2, c.y - 17, 4, 5); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(c.x - 3, c.y - 10, 2, 3); }
  // y-sorted actors
  const act = []; for (const e of E) if (e.on) act.push(e); act.push(P); for (const d of ups) act.push(d); act.sort((a, b) => a.y - b.y);
  for (const a of act) {
    if (a === P) { shadow(P.x, P.y, 13); const blink = P.inv > 0 && (t * 20 | 0) % 2; if (!blink || P.hurtT < 0) sprite(CLS, P.x, P.y, (P.walk | 0) % 2, P.face < 0, P.hurtT > 0); continue; }
    if (a.t) { drawDecorUp(a, t); continue; }
    const e = a, s = e.boss ? .5 : .5; shadow(e.x, e.y, e.r * 1.05);
    if (e.elite || e.boss) { g.fillStyle = e.boss ? 'rgba(255,60,20,.18)' : 'rgba(255,120,40,.14)'; g.beginPath(); g.arc(e.x, e.y - e.r, e.r * 2.2, 0, TAU); g.fill(); LIGHTS.push([e.x, e.y - e.r, e.boss ? 140 : 70, .6]); }
    sprite(e.kind, e.x, e.y, (e.f | 0) % 2, e.x > P.x, e.flash > 0, s);
    if ((e.elite || e.boss) && e.hp < e.max) { const w = e.r * 2.4; g.fillStyle = '#000'; g.fillRect(e.x - w / 2, e.y + 6, w, 4); g.fillStyle = '#c21a14'; g.fillRect(e.x - w / 2, e.y + 6, w * e.hp / e.max, 4); } }
  // blades
  for (const w of S.weapons) if (w.id === 'blades' && w.n) for (let i = 0; i < w.n; i++) { const a = w.ang + i / w.n * TAU, bx = P.x + Math.cos(a) * w.R, by = P.y - 12 + Math.sin(a) * w.R * .6;
    g.save(); g.translate(bx, by); g.rotate(t * 14 + i); g.fillStyle = w.evo ? '#f0d58a' : '#cfd3da'; for (let k = 0; k < 4; k++) { g.rotate(TAU / 4); g.beginPath(); g.moveTo(0, 0); g.lineTo(11, -3); g.lineTo(3, 2); g.fill(); } g.restore(); }
  for (const b of B) if (b.on) { const a = Math.atan2(b.vy, b.vx); g.save(); g.translate(b.x, b.y); g.rotate(a);
    if (b.kind === 'dagger') { g.fillStyle = '#e6e8ee'; g.beginPath(); g.moveTo(9, 0); g.lineTo(-3, -2.5); g.lineTo(-3, 2.5); g.fill(); g.fillStyle = '#5a2a7a'; g.fillRect(-8, -1.5, 5, 3); }
    else if (b.kind === 'arrow') { g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, 0); g.lineTo(8, 0); g.stroke(); g.fillStyle = '#d8d4cc'; g.beginPath(); g.moveTo(12, 0); g.lineTo(6, -3.5); g.lineTo(6, 3.5); g.fill(); g.fillStyle = '#9e1b14'; g.fillRect(-13, -3, 4, 6); }
    else if (b.kind === 'spear') { g.scale(b.sz, b.sz); g.fillStyle = '#e8dfc6'; g.beginPath(); g.moveTo(20, 0); g.lineTo(6, -5); g.lineTo(-16, -2); g.lineTo(-16, 2); g.lineTo(6, 5); g.fill(); g.fillStyle = '#9a8f74'; g.fillRect(-14, -1, 18, 2); }
    else { const c = b.kind === 'fire' ? ['#ff6a1a', '#ffd36a'] : ['#fff0b0', '#ffffff']; g.fillStyle = c[0]; g.globalAlpha = .4; g.beginPath(); g.arc(0, 0, b.r * 1.8, 0, TAU); g.fill(); g.globalAlpha = 1; g.beginPath(); g.ellipse(0, 0, b.r * 1.3, b.r * .8, 0, 0, TAU); g.fill(); g.fillStyle = c[1]; g.beginPath(); g.arc(2, 0, b.r * .45, 0, TAU); g.fill(); }
    g.restore(); if (b.kind === 'fire' || b.kind === 'holy') LIGHTS.push([b.x, b.y, 70, .7]); }
  for (const b of EB) if (b.on) { g.fillStyle = '#ff3a1a'; g.beginPath(); g.arc(b.x, b.y, 6, 0, TAU); g.fill(); g.fillStyle = '#ffd36a'; g.beginPath(); g.arc(b.x, b.y, 2.5, 0, TAU); g.fill(); LIGHTS.push([b.x, b.y, 50, .6]); }
  for (const f of FX) { if (!f.on || f.t === 'decal') continue; const k = f.life / f.max;
    if (f.t === 'p') { g.globalAlpha = Math.min(1, k * 1.5); g.fillStyle = f.c; g.fillRect(f.x - f.r / 2, f.y - f.r / 2, f.r, f.r); }
    else if (f.t === 'ring') { g.globalAlpha = k; const R = f.r * (f.fill ? 1 : (1 - k * .7)); g.strokeStyle = f.c; g.lineWidth = 6 * k + 2; g.beginPath(); g.ellipse(f.x, f.y, R, R * .6, 0, 0, TAU); g.stroke(); if (f.fill) { g.fillStyle = f.c; g.globalAlpha = k * .35; g.fill(); } LIGHTS.push([f.x, f.y, R * 1.3, k]); }
    else if (f.t === 'arc') { g.globalAlpha = k; g.strokeStyle = f.c; g.lineWidth = 12 * k + 2; g.lineCap = 'round'; g.beginPath(); g.ellipse(f.x, f.y, f.r * .9, f.r * .6, 0, f.a - f.span / 2 + (1 - k) * .3, f.a + f.span / 2 - (1 - k) * .3); g.stroke(); }
    else if (f.t === 'bolt') { g.globalAlpha = k; g.strokeStyle = f.c; g.lineWidth = 3; g.shadowColor = '#5aa0ff'; g.shadowBlur = 10; g.beginPath(); g.moveTo(f.pts[0][0], f.pts[0][1]);
      for (let i = 1; i < f.pts.length; i++) { const [x0, y0] = f.pts[i - 1], [x1, y1] = f.pts[i]; for (let s = 1; s <= 4; s++) g.lineTo(x0 + (x1 - x0) * s / 4 + (s < 4 ? rnd(-8, 8) : 0), y0 + (y1 - y0) * s / 4 + (s < 4 ? rnd(-8, 8) : 0)); }
      g.stroke(); g.shadowBlur = 0; LIGHTS.push([f.pts[1][0], f.pts[1][1], 90, k]); }
    else if (f.t === 'txt') { g.globalAlpha = Math.min(1, k * 2); g.fillStyle = f.c; g.font = '700 12px Cinzel,serif'; g.textAlign = 'center'; g.fillText(f.s, f.x, f.y); } }
  g.globalAlpha = 1;
  // darkness + lights
  const lw = lightC.width, lh = lightC.height, ls = lw / W;
  lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'source-over'; lg.fillStyle = 'rgba(4,2,2,.84)'; lg.fillRect(0, 0, lw, lh); lg.globalCompositeOperation = 'destination-out';
  for (const [x, y, r, k] of LIGHTS) { const sx = (x - camX) * Z * ls, sy = (y - camY) * Z * ls, sr = r * Z * ls * (1 + Math.sin(t * 9 + x) * .03); if (sx < -sr || sy < -sr || sx > lw + sr || sy > lh + sr) continue;
    const gr = lg.createRadialGradient(sx, sy, 0, sx, sy, sr); gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(.55, `rgba(0,0,0,${k * .6})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); lg.fillStyle = gr; lg.fillRect(sx - sr, sy - sr, sr * 2, sr * 2); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(lightC, 0, 0, cv.width, cv.height);
  g.globalCompositeOperation = 'lighter'; for (const [x, y, r, k] of LIGHTS) { if (r < 100 && r !== 90) continue; const sx = (x - camX) * Z * DPR, sy = (y - camY) * Z * DPR, sr = r * .5 * Z * DPR; if (sx < -sr || sy < -sr || sx > cv.width + sr || sy > cv.height + sr) continue;
    const gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr); gr.addColorStop(0, `rgba(120,50,15,${.16 * k})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2); }
  g.globalCompositeOperation = 'source-over';
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (P.hurtT > 0) { g.fillStyle = `rgba(150,0,0,${P.hurtT * .8})`; g.fillRect(0, 0, W, H); }
  drawHUD(t);
}
function globe(x, y, r, k, c1, c2, label, t) { const g = ctx;
  g.fillStyle = '#060404'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(x, y, r - 3, 0, TAU); g.clip(); const top = y + r - (r * 2) * clamp(k, 0, 1);
  const gr = g.createLinearGradient(0, y - r, 0, y + r); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.beginPath(); g.moveTo(x - r, y + r);
  for (let i = 0; i <= 12; i++) g.lineTo(x - r + i * r / 6, top + Math.sin(t * 3 + i * .9) * 2); g.lineTo(x + r, y + r); g.fill();
  g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(x - r * .3, y - r * .4, r * .35, r * .22, -.6, 0, TAU); g.fill(); g.restore();
  g.strokeStyle = '#6b5631'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.strokeStyle = '#c9a24a'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r + 2.5, 0, TAU); g.stroke();
  g.fillStyle = '#f0e6d0'; g.font = '700 13px Cinzel,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#000'; g.shadowBlur = 4; g.fillText(label, x, y + 1); g.shadowBlur = 0; g.textBaseline = 'alphabetic'; }
function drawHUD(t) { const g = ctx, r = clamp(W * .1, 34, 50), by = H - r - 16 - (parseFloat(getComputedStyle(document.body).getPropertyValue('--sab')) || 0);
  globe(r + 14, by, r, P.hp / P.maxhp, '#d8281e', '#4a0604', Math.ceil(P.hp), t);
  globe(W - r - 14, by, r, P.xp / P.next, '#4a78e0', '#0a1450', 'Lv ' + P.lvl, t);
  // weapon icons row
  g.font = '15px serif'; g.textAlign = 'center'; let x = W / 2 - (S.weapons.length - 1) * 15;
  for (const w of S.weapons) { g.fillStyle = 'rgba(10,7,6,.8)'; g.fillRect(x - 13, H - 40, 26, 26); g.strokeStyle = w.evo ? '#f0d58a' : '#5a4a2e'; g.lineWidth = 1.5; g.strokeRect(x - 13, H - 40, 26, 26); g.fillStyle = '#e6dcc6'; g.fillText(WEAP[w.id].ic, x, H - 22); g.fillStyle = '#c9a24a'; g.font = '700 8px Cinzel'; g.fillText(w.evo ? '★' : w.lvl, x + 9, H - 16); g.font = '15px serif'; x += 30; }
  if (S.boss && S.boss.on) { const bw = Math.min(320, W - 60), bx = (W - bw) / 2, yy = 64; g.fillStyle = '#000'; g.fillRect(bx - 2, yy - 2, bw + 4, 12); g.fillStyle = '#8a0e0a'; g.fillRect(bx, yy, bw * S.boss.hp / S.boss.max, 8);
    g.fillStyle = '#f0d58a'; g.font = '700 11px Cinzel'; g.fillText(S.boss.final ? 'THE ASH LORD' : 'FIEND', W / 2, yy + 22); }
  if (IN.jon) { g.strokeStyle = 'rgba(201,162,74,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(IN.ox, IN.oy, 46, 0, TAU); g.stroke(); g.fillStyle = 'rgba(201,162,74,.35)'; g.beginPath(); g.arc(IN.ox + IN.jx * 46, IN.oy + IN.jy * 46, 18, 0, TAU); g.fill(); }
  const tm = Math.min(S.t, 5999); $('timer').textContent = `${String(tm / 60 | 0).padStart(2, '0')}:${String(tm % 60 | 0).padStart(2, '0')}`; $('killN').textContent = S.kills; }
let titleT = 0;
function drawTitleBG(t) { const g = ctx; g.setTransform(DPR, 0, 0, DPR, 0, 0); g.save(); g.translate(-(t * 8 % 256), -(t * 4 % 256)); g.fillStyle = floorPat; g.fillRect(0, 0, W + 512, H + 512); g.restore();
  const gr = g.createRadialGradient(W / 2, H * .45, 40, W / 2, H * .45, Math.max(W, H) * .7); gr.addColorStop(0, 'rgba(0,0,0,.2)'); gr.addColorStop(1, 'rgba(0,0,0,.95)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { const x = (hash(i, 3) * W + t * 20 * hash(i, 9)) % W, y = H - ((t * 30 * (.5 + hash(i, 5)) + hash(i, 7) * H) % H); g.fillStyle = `rgba(255,${120 + hash(i, 2) * 80 | 0},40,${.25 + hash(i, 4) * .5})`; g.fillRect(x, y, 2, 2); } }

/* ---------------- UI ---------------- */
function showScreen(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id); }
let bannerT = 0;
function banner(a, b) { const el = $('banner'); el.innerHTML = a + (b ? `<small>${b}</small>` : ''); el.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => el.classList.remove('show'), 2200); }
function portrait(cls, size = 150) { const c = mk(size, size), g = c.getContext('2d'); const sp = SPR[cls].f[0][0]; g.imageSmoothingEnabled = false; const s = size / sp.height * 1.05; g.drawImage(sp, (size - sp.width * s) / 2, size - sp.height * s + 6, sp.width * s, sp.height * s); return c; }
function fmt(s) { return `${s / 60 | 0}:${String(s % 60 | 0).padStart(2, '0')}`; }
function buildClasses() { const grid = $('classGrid'); grid.innerHTML = '';
  for (const k in CLASSES) { const C = CLASSES[k], b = document.createElement('button'), best = store.get('best.' + k, null); b.className = 'cls'; b.style.setProperty('--glow', C.glow);
    const pc = portrait(k); b.appendChild(pc);
    b.insertAdjacentHTML('beforeend', `<b>${C.name}</b><small>${C.blurb}<br><em>${C.perk}</em><br>HP ${C.hp} · Speed ${C.speed} · ${WEAP[C.start].name}</small><i>${best ? `BEST ${fmt(best.t)} · ${best.k} KILLS` : 'UNTESTED'}</i>`);
    b.onclick = () => { audioInit(); newRun(k); }; grid.appendChild(b); } }
function endRun(won) { if (!S || S.state === 'over') return; S.state = 'over'; S.won = won; const best = store.get('best.' + CLS, { t: 0, k: 0 });
  const nb = { t: Math.max(best.t, S.t), k: Math.max(best.k, S.kills) }; store.set('best.' + CLS, nb);
  setTimeout(() => { $('hud').classList.add('hidden'); $('resTitle').textContent = won ? 'Dawn Breaks' : 'Fallen'; $('resSub').textContent = `${CLASSES[CLS].name} · ${won ? 'The Ash Lord is slain' : 'Claimed by the night'}`;
    $('resStats').innerHTML = [['TIME', fmt(S.t)], ['KILLS', S.kills], ['LEVEL', P.lvl], ['BEST', fmt(nb.t)]].map(([a, b]) => `<div><b>${b}</b><span>${a}</span></div>`).join('');
    S.card = makeCard(won); $('card').src = S.card.toDataURL('image/jpeg', .85); showScreen('result'); }, won ? 200 : 900); }
function makeCard(won) { const Wc = 1080, Hc = 1920, c = mk(Wc, Hc), g = c.getContext('2d');
  g.fillStyle = '#0b0706'; g.fillRect(0, 0, Wc, Hc); g.save(); g.scale(2.4, 2.4); g.fillStyle = floorPat; g.fillRect(0, 0, Wc, Hc); g.restore();
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(90,8,5,${.2 + Math.random() * .3})`; g.beginPath(); g.ellipse(Math.random() * Wc, Math.random() * Hc, 30 + Math.random() * 90, 15 + Math.random() * 40, 0, 0, TAU); g.fill(); }
  const gr = g.createRadialGradient(Wc / 2, 820, 80, Wc / 2, 820, 1100); gr.addColorStop(0, won ? 'rgba(120,70,20,.15)' : 'rgba(110,20,10,.2)'); gr.addColorStop(.6, 'rgba(0,0,0,.8)'); gr.addColorStop(1, 'rgba(0,0,0,.97)'); g.fillStyle = gr; g.fillRect(0, 0, Wc, Hc);
  g.strokeStyle = '#6b5631'; g.lineWidth = 6; g.strokeRect(40, 40, Wc - 80, Hc - 80); g.strokeStyle = '#c9a24a'; g.lineWidth = 2; g.strokeRect(58, 58, Wc - 116, Hc - 116);
  g.textAlign = 'center'; g.fillStyle = '#c9a24a'; g.font = '700 40px Cinzel'; g.fillText('✦  A S H F A L L  ✦', Wc / 2, 170);
  const tg = g.createLinearGradient(0, 220, 0, 380); tg.addColorStop(0, '#f6e2a8'); tg.addColorStop(1, '#9a7430'); g.fillStyle = tg; g.font = '900 150px Cinzel'; g.shadowColor = won ? '#e0a02a' : '#c21a14'; g.shadowBlur = 40; g.fillText(won ? 'DAWN' : 'FALLEN', Wc / 2, 360); g.shadowBlur = 0;
  g.fillStyle = '#e6dcc6'; g.font = '700 46px Cinzel'; g.fillText(CLASSES[CLS].name.toUpperCase(), Wc / 2, 450);
  const lg2 = g.createRadialGradient(Wc / 2, 900, 20, Wc / 2, 900, 420); lg2.addColorStop(0, 'rgba(255,120,40,.35)'); lg2.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lg2; g.fillRect(0, 480, Wc, 840);
  g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.ellipse(Wc / 2, 1160, 220, 60, 0, 0, TAU); g.fill();
  const sp = SPR[CLS].f[0][0], s = 640 / sp.height; g.imageSmoothingEnabled = false; g.drawImage(sp, Wc / 2 - sp.width * s / 2, 1180 - sp.height * s + 30, sp.width * s, sp.height * s);
  const st = [['SURVIVED', fmt(S.t)], ['SLAIN', S.kills], ['LEVEL', P.lvl]]; st.forEach(([a, b], i) => { const x = 220 + i * 320; g.fillStyle = '#f0d58a'; g.font = '900 96px Cinzel'; g.fillText(b, x, 1370); g.fillStyle = '#8d7f68'; g.font = '700 28px Cinzel'; g.fillText(a, x, 1420); });
  g.fillStyle = '#cbbd9f'; g.font = 'italic 34px Georgia'; const wl = S.weapons.map(w => (w.evo ? '★ ' + WEAP[w.id].evoName : WEAP[w.id].name + ' ' + w.lvl)); for (let i = 0; i < wl.length; i += 2) g.fillText(wl.slice(i, i + 2).join('   ·   '), Wc / 2, 1530 + i / 2 * 52);
  g.fillStyle = '#9e1b14'; g.font = '700 30px Cinzel'; g.fillText(won ? 'THE NIGHT IS ENDED' : 'SURVIVE THE NIGHT OF CINDERS', Wc / 2, 1740); g.fillStyle = '#8d7f68'; g.font = '700 26px Cinzel'; g.fillText('ntony7898.github.io/ashfall', Wc / 2, 1800);
  return c; }
async function share() { const c = S && S.card; if (!c) return; const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'ashfall-result.png', { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Ashfall', text: `I survived ${fmt(S.t)} as the ${CLASSES[CLS].name} in Ashfall.` }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ashfall-result.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

/* ---------------- input ---------------- */
const KM = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
function keyVec() { let x = 0, y = 0; for (const k of IN.keys) { const v = KM[k]; if (v) { x += v[0]; y += v[1]; } } IN.kx = x; IN.ky = y; }
addEventListener('keydown', e => { if (KM[e.code]) { IN.keys.add(e.code); keyVec(); e.preventDefault(); } if (e.code === 'Escape' || e.code === 'KeyP') togglePause(); if (S && S.state === 'level' && /Digit[123]/.test(e.code)) { const b = $('choices').children[+e.code.slice(5) - 1]; b && b.click(); } });
addEventListener('keyup', e => { IN.keys.delete(e.code); keyVec(); });
cv.addEventListener('pointerdown', e => { IN.jon = true; IN.pid = e.pointerId; IN.ox = e.clientX; IN.oy = e.clientY; IN.jx = IN.jy = 0; });
addEventListener('pointermove', e => { if (!IN.jon || e.pointerId !== IN.pid) return; let dx = e.clientX - IN.ox, dy = e.clientY - IN.oy; const d = Math.hypot(dx, dy), R = 46;
  if (d > R) { IN.ox += dx / d * (d - R); IN.oy += dy / d * (d - R); dx = e.clientX - IN.ox; dy = e.clientY - IN.oy; } IN.jx = dx / R; IN.jy = dy / R; if (Math.hypot(IN.jx, IN.jy) < .15) IN.jx = IN.jy = 0; });
const jEnd = e => { if (e.pointerId === IN.pid) { IN.jon = false; IN.jx = IN.jy = 0; } }; addEventListener('pointerup', jEnd); addEventListener('pointercancel', jEnd);
function togglePause(force) { if (!S) return; if (S.state === 'play' && force !== false) { S.state = 'pause'; $('loadout').innerHTML = S.weapons.map(w => `${WEAP[w.id].ic} ${w.evo ? WEAP[w.id].evoName : WEAP[w.id].name} · ${w.evo ? '★' : 'Lv ' + w.lvl}`).join('<br>') + '<br>' + Object.entries(S.passives).map(([k, v]) => `${PASS[k].name} ${v}`).join(' · '); showScreen('paused'); }
  else if (S.state === 'pause') { S.state = 'play'; showScreen(null); } }
document.addEventListener('visibilitychange', () => { if (document.hidden && S && S.state === 'play') togglePause(); });
$('pause').onclick = () => togglePause(); $('btnResume').onclick = () => togglePause(); $('btnQuit').onclick = () => { S.state = 'play'; endRun(false); };
$('mute').onclick = () => { audioInit(); setMute(!AU.muted); }; setMute(AU.muted);
$('btnBegin').onclick = () => { audioInit(); buildClasses(); showScreen('classes'); };
$('btnBack').onclick = () => showScreen('title');
$('btnRetry').onclick = () => newRun(CLS); $('btnClass').onclick = () => { S = null; buildClasses(); showScreen('classes'); }; $('btnShare').onclick = share;

/* ---------------- loop ---------------- */
let last = performance.now();
function frame(now) { requestAnimationFrame(frame); let dt = Math.min(.05, (now - last) / 1000); last = now;
  if (S && S.state === 'play') { const n = dt > .025 ? 2 : 1; for (let i = 0; i < n; i++) update(dt / n); if (S.bot && S.state === 'level' && !S.botT) S.botT = setTimeout(() => { S.botT = 0; const b = $('choices').children[0]; b && b.click(); }, 250); }
  if (S && S.bot && S.state === 'level' && !S.botT) S.botT = setTimeout(() => { S.botT = 0; const b = $('choices').children[0]; b && b.click(); }, 250);
  render(now); }
resize(); buildFloor(); buildSprites(); requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__g = { get S() { return S; }, get P() { return P; }, E, newRun, update, spawn, gainXP, sim(sec) { for (let i = 0; i < sec * 60 && S.state !== 'over'; i++) { if (S.state === 'level') { applyOpt(S.opts[0]); S.pendingLv--; S.state = 'play'; if (S.pendingLv > 0) openLevelUp(); else showScreen(null); continue; } update(1 / 60); } } };
