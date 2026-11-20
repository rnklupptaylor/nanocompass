'use strict';
// Nanocompass v8.0: the ferrocell twin obeys the cone geometry it claims.
// Usage (from the project root): node tests/v8/ferrocell.cjs
const path = require('path'), R = path.resolve(__dirname, '..', '..');
global.Phys = require(path.join(R, 'src/v8/engines/magnet-fields.js'));
const F = require(path.join(R, 'src/v8/engines/ferrocell.js'));
let failed = 0; const check = (ok, t) => { console.log(ok ? 'PASS' : 'FAIL', t); if (!ok) failed++; };
const base = { half: 40, cellR: 40, eyeH: 5000, needleUm: 100, orientSpread: 0.01, Bn: 0.015, filmUm: 10, mode: 'edge' };
// 1. Uniform in-plane field along x, one LED at the bottom of the rim: the bright line runs through the LED, perpendicular to the field.
{ const N = 101, B = new Float32Array(N * N * 3); for (let k = 0; k < N * N; k++) B[3 * k] = 0.05;
  const img = F.render({ ...base, N, leds: [{ x: 0, y: -40, rgb: [0, 1, 0] }], B }), x0 = row => { let bi = 0, bv = -1; for (let i = 0; i < N; i++) { const v = img[3 * (row * N + i) + 1]; if (v > bv) { bv = v; bi = i; } } return -40 + 80 * (bi + .5) / N; };
  check([25, 50, 75].every(r => Math.abs(x0(r)) < 1.2), `uniform field: bright line perpendicular to the field through the LED (x = ${[25, 50, 75].map(r => x0(r).toFixed(1)).join(', ')} mm)`); }
// 2. Radial in-plane field (the in-plane part of a disc magnet's field), one LED, distant eye: the bright points lie on the
//    Thales circle whose diameter joins the LED and the field centre (light direction perpendicular to the radial needles).
{ const N = 161, B = new Float32Array(N * N * 3), led = { x: 0, y: -40, rgb: [0, 1, 0] };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -40 + 80 * (i + .5) / N, y = 40 - 80 * (j + .5) / N, r = Math.hypot(x, y) || 1; B.set([0.05 * x / r, 0.05 * y / r, 0], 3 * (j * N + i)); }
  const img = F.render({ ...base, N, leds: [led], B }); let n = 0, dev = 0;
  for (let j = 0; j < N; j++) { const y = 40 - 80 * (j + .5) / N; if (y < -36 || y > -4) continue; let bi = 0, bv = -1; for (let i = 0; i < (N - 1) / 2; i++) { const v = img[3 * (j * N + i) + 1]; if (v > bv) { bv = v; bi = i; } }
    const x = -40 + 80 * (bi + .5) / N, expect = -Math.sqrt(400 - (y + 20) ** 2); dev += Math.abs(x - expect); n++; }
  check(n > 20 && dev / n < 1, `radial in-plane field, one LED: in every row the brightest point lies on the Thales circle LED–centre (mean deviation ${(dev / n).toFixed(2)} mm over ${n} rows)`); }
// 3. Reversing the magnet leaves the image unchanged (needles have no head or tail for scattering).
{ const N = 81, leds = F.ledRing(6, 41, 'white'), a = F.render({ ...base, N, leds, B: F.fieldGrid(F.magnets({ kind: 'bar', x: 0, y: 0, gap: 3, Br: 1.3 }), N, 40) }), b = F.render({ ...base, N, leds, B: F.fieldGrid(F.magnets({ kind: 'bar', x: 0, y: 0, gap: 3, Br: -1.3 }), N, 40) });
  let d = 0, s = 0; for (let k = 0; k < a.length; k++) { d += Math.abs(a[k] - b[k]); s += a[k]; } check(d / s < 1e-9, 'reversing the magnet does not change the image'); }
// 4. Without a magnet nothing lights up (no needles).
{ const N = 41, img = F.render({ ...base, N, leds: F.ledRing(6, 41, 'white'), B: new Float32Array(N * N * 3) }); check(img.every(v => v === 0), 'no magnet: no needles, no bright lines'); }
if (failed) process.exitCode = 1;
