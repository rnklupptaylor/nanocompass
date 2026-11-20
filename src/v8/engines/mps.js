/* Steady-state MPS of two independent populations with a shared core saturation magnetization.
 * The UI supplies peak B in T, frequency in Hz, temperature in K, core diameters in nm,
 * effective relaxation times in seconds, and a magnetic core volume fraction for population B. */
(function(root) {
'use strict';
const {KB, MAG_DEFAULTS, langevin} = root.NanoMagnetometer || require('./magnetometer.js');
const MS = MAG_DEFAULTS.Ms;
const REFERENCE_FREQUENCY = 20_100;
const SAMPLE_COUNT = 1024;
const HALF = SAMPLE_COUNT / 2;
const TAU = 2 * Math.PI;
const orders = Array.from({length: 48}, (_, i) => 2 * i + 1);
const sin = orders.map(n => Float64Array.from({length: SAMPLE_COUNT}, (_, i) => Math.sin(n * TAU * i / SAMPLE_COUNT)));
const cos = orders.map(n => Float64Array.from({length: SAMPLE_COUNT}, (_, i) => Math.cos(n * TAU * i / SAMPLE_COUNT)));

function population(diameter, relaxation, field, frequency, temperature) {
  const moment = MS * Math.PI / 6 * (diameter * 1e-9) ** 3;
  const xi = moment * field / (KB * temperature);
  const equilibrium = sin[0].slice(0, HALF).map(b => langevin(xi * b));
  // Half-wave antisymmetry and a sine drive leave only odd sine terms in equilibrium.
  return orders.map((n, k) => {
    let sine = 0;
    for (let i = 0; i < HALF; i++) sine += equilibrium[i] * sin[k][i];
    sine *= 2 / HALF;
    // Solve τ dm/dt + m = m_eq in periodic steady state, one harmonic at a time.
    const lag = n * TAU * frequency * relaxation;
    const inPhase = sine / (1 + lag * lag);
    return {inPhase, quadrature: -lag * inPhase};
  });
}

function measure({field, frequency, temperature, diameterA, diameterB, relaxationA, relaxationB, fractionB, amount}) {
  const a = population(diameterA, relaxationA, field, frequency, temperature);
  const b = population(diameterB, relaxationB, field, frequency, temperature);
  const harmonics = orders.map((n, k) => {
    const inPhase = (1 - fractionB) * a[k].inPhase + fractionB * b[k].inPhase;
    const quadrature = (1 - fractionB) * a[k].quadrature + fractionB * b[k].quadrature;
    // Sum moments with their phases before taking amplitudes. An ideal coil measures −dm/dt.
    const amplitude = amount * n * (frequency / REFERENCE_FREQUENCY) * Math.hypot(inPhase, quadrature);
    return {n, inPhase, quadrature, amplitude};
  });
  const waveform = Array.from({length: SAMPLE_COUNT + 1}, (_, i) => {
    const j = i % SAMPLE_COUNT;
    let moment = 0;
    let voltage = 0;
    harmonics.forEach(({n, inPhase, quadrature}, k) => {
      moment += inPhase * sin[k][j] + quadrature * cos[k][j];
      voltage -= n * (inPhase * cos[k][j] - quadrature * sin[k][j]);
    });
    return {cycle: i / SAMPLE_COUNT, field: sin[0][j], moment, voltage: amount * (frequency / REFERENCE_FREQUENCY) * voltage};
  });
  return {harmonics, waveform};
}

function amplitudeRatio(numerator, denominator) {
  // An absolute numerical floor in V/V₀, not a model of instrument sensitivity.
  return denominator > 1e-12 ? numerator / denominator : null;
}

const api = {measure, amplitudeRatio, REFERENCE_FREQUENCY};
root.NanoMPS = api;
if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
