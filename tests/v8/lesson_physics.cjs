'use strict';
// Nanocompass v8.0: the particle lessons show what their guides claim.
// Usage (from the project root): node tests/v8/lesson_physics.cjs
const path = require('path'), ROOT = path.resolve(__dirname, '..', '..');
global.NanoPlanarView = { lesson(id, spec) { (global.L = global.L || {})[id] = spec; } };
require(path.join(ROOT, 'src/v8/engines/planar.js')); require(path.join(ROOT, 'src/v8/lessons/particles.js'));
const { besselRatio, times } = global.NanoParticleLessons;
let failed = 0; const check = (ok, text) => { console.log(ok ? 'PASS' : 'FAIL', text); if (!ok) failed++; };
function meanM(id, over, steps) { const E = createPlanarEngine(); E.configure({ ...L[id].config, ...over }); let s = 0, n = 0;
  for (let i = 0; i < steps; i++) { E.step(1); if (i > steps / 4 && i % 5 === 0) { s += E.state.particles.reduce((a, p) => a + Math.cos(p.theta), 0) / E.state.particles.length; n++; } } return [E, s / n]; }
// 01: with the projected Néel barrier the free fluid follows the 2D equilibrium I1(a)/I0(a).
for (const B of [10, 30, 80]) { const [E, m] = meanM('fluid', { field_mT: B }, 6000), t = times(E), a = t.mu * B * 1e-3 / t.kT;
  check(Math.abs(m - besselRatio(a)) < 0.03, `01 ferrofluid at μB/kT = ${a.toFixed(2)}: M = ${m.toFixed(3)}, 2D theory ${besselRatio(a).toFixed(3)}`); }
{ const [, m] = meanM('fluid', { field_mT: 0 }, 4000); check(Math.abs(m) < 0.06, `01 no remanence at zero field: M = ${m.toFixed(3)}`); }
// 00: small cores flip constantly, large cores are blocked during the viewing window.
const flips = d => { const E = createPlanarEngine(); E.configure({ ...L.particle.config, coreNm: d }); E.step(1000); return E.state.neelEvents; };
check(flips(10) > 1000, '00 10 nm cores flip thousands of times in 10 µs'); check(flips(24) < 5, '00 24 nm cores are blocked (Néel) in 10 µs');
// 02: the head-to-tail contact fraction rises with coupling.
const chain = d => { const E = createPlanarEngine(); E.configure({ ...L.chains.config, coreNm: d }); E.step(4000); return [E.dimensionless().lambda, E.pairAnalysis().chainFraction]; };
const [l1, c1] = chain(10), [l2, c2] = chain(18); check(c2 > c1 + 0.3, `02 chains: λ ${l1.toFixed(1)} → ${(100 * c1).toFixed(0)} %, λ ${l2.toFixed(1)} → ${(100 * c2).toFixed(0)} % head to tail`);
if (failed) process.exitCode = 1;
