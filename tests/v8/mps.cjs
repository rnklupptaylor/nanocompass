'use strict';
const assert = require('node:assert/strict');
const {measure, amplitudeRatio, REFERENCE_FREQUENCY} = require('../../src/v8/engines/mps.js');
const {KB, MAG_DEFAULTS} = require('../../src/v8/engines/magnetometer.js');
const base = {field: .03, frequency: REFERENCE_FREQUENCY, temperature: 300, diameterA: 12, diameterB: 20,
  relaxationA: .2e-6, relaxationB: 2e-6, fractionB: .2, amount: 1};
const run = overrides => measure({...base, ...overrides});
const near = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);
const reference = run({});

const equilibrium = run({fractionB: 0, relaxationA: 0});
const weak = run({field: .001, fractionB: 0, relaxationA: 0});
const xi = MAG_DEFAULTS.Ms * Math.PI / 6 * (12e-9) ** 3 * .001 / (KB * 300);
// Project L(x) = x/3 − x³/45 + 2x⁵/945 + O(x⁷) onto the first and third harmonics.
near(weak.harmonics[0].inPhase, xi / 3 - xi ** 3 / 60 + 20 * xi ** 5 / (16 * 945), 1e-9);
near(weak.harmonics[1].inPhase, xi ** 3 / 180 - 10 * xi ** 5 / (16 * 945), 1e-9);
near(run({field: .002, fractionB: 0, relaxationA: 0}).harmonics[1].amplitude / weak.harmonics[1].amplitude, 8, .06);
assert.ok(run({field: 0}).harmonics.every(h => h.amplitude === 0));
console.log('PASS MPS vanishes at zero drive and recovers the cubic third harmonic in weak fields');

const delayed = run({fractionB: 0, relaxationA: 4e-6});
for (const [i, h] of delayed.harmonics.entries()) {
  const lag = h.n * 2 * Math.PI * REFERENCE_FREQUENCY * 4e-6;
  near(h.amplitude, equilibrium.harmonics[i].amplitude / Math.hypot(1, lag), 1e-13);
  near(h.quadrature, -lag * h.inPhase, 1e-13);
}
assert.ok(delayed.harmonics[0].quadrature < 0);
console.log('PASS finite relaxation attenuates and delays each harmonic by the expected amount');

const b = run({fractionB: 1});
const a = run({fractionB: 0});
const triple = run({amount: 3});
const fifthOverThird = ({harmonics: h}) => amplitudeRatio(h[2].amplitude, h[1].amplitude);
for (const [i, h] of reference.harmonics.entries()) {
  near(h.inPhase, .8 * a.harmonics[i].inPhase + .2 * b.harmonics[i].inPhase, 1e-13);
  near(h.quadrature, .8 * a.harmonics[i].quadrature + .2 * b.harmonics[i].quadrature, 1e-13);
  near(triple.harmonics[i].amplitude, 3 * h.amplitude, 1e-13);
}
near(fifthOverThird(triple), fifthOverThird(reference), 1e-13);
assert.ok(Math.abs(fifthOverThird(run({fractionB: .8})) - fifthOverThird(reference)) > .01);
assert.equal(amplitudeRatio(0, 0), null);
console.log('PASS coherent mixing changes the fingerprint and normalized harmonics cancel sample loading');

const {waveform: w, harmonics} = reference;
const count = w.length - 1;
const phaseStep = 2 * Math.PI / count;
for (let i = 0; i < count / 2; i++) {
  near(w[i].moment, -w[i + count / 2].moment, 1e-12);
  near(w[i].voltage, -w[i + count / 2].voltage, 1e-12);
  const derivative = (w[(i + 1) % count].moment - w[(i + count - 1) % count].moment) / (2 * phaseStep);
  near(w[i].voltage, -derivative, .002);
}
for (let n = 1; n <= 15; n++) {
  let sine = 0, cosine = 0;
  for (let i = 0; i < count; i++) {
    sine += w[i].voltage * Math.sin(n * i * phaseStep);
    cosine += w[i].voltage * Math.cos(n * i * phaseStep);
  }
  near(2 / count * Math.hypot(sine, cosine), n % 2 ? harmonics[(n - 1) / 2].amplitude : 0, 1e-12);
}
console.log('PASS voltage is the negative moment derivative and has only odd harmonics');
