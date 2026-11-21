/* Teaching settings and experiments for MPS in Magnetic measurements. */
(function(root) {
'use strict';
const config = {
  drive: 30, rate: 20.1, temperature: 300, percentB: 20, amount: 1,
  diameterA: 12, diameterB: 20, tauA: .2, tauB: 2, scale: 'third', trace: 'moment',
};
const controls = [
  {key: 'drive', label: 'Peak drive field', min: 1, max: 40, step: .5, unit: 'mT'},
  {key: 'rate', label: 'Drive frequency', min: 1, max: 50, step: .1, unit: 'kHz'},
  {key: 'temperature', label: 'Temperature', min: 250, max: 350, step: 1, unit: 'K'},
  {key: 'percentB', label: 'Population B', min: 0, max: 100, step: 1, unit: '%', hint: 'Share of the total magnetic core volume.'},
  {key: 'amount', label: 'Relative sample loading', min: .1, max: 3, step: .1, unit: '×', hint: 'Scales the total amount of magnetic material at fixed composition.'},
  {key: 'diameterA', label: 'A core diameter', min: 8, max: 24, step: .5, unit: 'nm'},
  {key: 'diameterB', label: 'B core diameter', min: 8, max: 24, step: .5, unit: 'nm'},
  {key: 'tauA', label: 'A relaxation time', min: .02, max: 30, log: true, unit: 'µs'},
  {key: 'tauB', label: 'B relaxation time', min: .02, max: 30, log: true, unit: 'µs'},
];
const references = '<p>Model and instrument: <a href="https://doi.org/10.1063/1.4935158" target="_blank" rel="noopener">Dhavalikar et al. (2015)</a> and <a href="https://doi.org/10.1063/1.4978003" target="_blank" rel="noopener">Garraud et al. (2017)</a>. Magnetic tags: <a href="https://doi.org/10.1002/smll.202101588" target="_blank" rel="noopener">Müssig, Reichstein, Prieschl, Wintzheimer and Mandel (2021)</a>.</p>';
const guide = {
  lecture: {
    aim: 'How can a mixture of magnetic nanoparticles carry a fingerprint?',
    read: 'The setup shows the sample inside a pickup coil. A larger drive coil applies a sinusoidal field. As the moments begin to saturate, their response contains odd multiples of the drive frequency. The pickup coil senses the rate of change of the total moment, and an empty balance coil helps cancel direct pickup from the drive. The M(H) loop traces magnetisation through a field sweep. MPS repeats one drive cycle and measures the peak voltage at each harmonic.',
    tasks: [
      {text: 'Start with 20% population B. Keep its spectrum, then change population B to 80%. Compare the shapes at the same drive field and frequency.', set: config, clear: true},
      {text: 'Keep a spectrum and triple only the sample loading. Compare Divide by A₃ with Relative voltage. Which quantities change?', set: {...config, scale: 'voltage'}, clear: true},
      {text: 'Start at 1 mT and increase the peak field to 30 mT. Watch the moment trace and the higher harmonics grow.', set: {...config, drive: 1, scale: 'voltage'}, clear: true},
    ],
    physics: '<p>The mixtures are simulated. Mandel’s group makes magnetic tags by assembling nanoparticle building blocks into supraparticles. Their packing and magnetic interactions can also change the spectrum.</p>' + references,
    check: 'Why can two specimens with different amounts of the same mixture have the same normalized spectrum?',
    answer: 'At fixed drive and sample composition the ideal coil amplitudes all scale with the amount of magnetic material. Dividing by one harmonic cancels that factor.',
  },
  research: {
    aim: 'Compare harmonic fingerprints at fixed excitation and test how composition and relaxation affect their interpretation.',
    read: 'The MPS setup shows one example of a differential receiver. Direct drive pickup is assumed to cancel, so Aₙ is the peak sample voltage at frequency nf. The AC susceptibility mode probes the near-linear response at f. MPS uses the higher harmonics that appear when the drive field produces a nonlinear response. Normalize to the third harmonic if the fundamental is rejected by the instrument, or to the ideal sample-only fundamental. Relative voltage uses the same fixed scale for every simulation. Compare fingerprints under matched excitation and temperature. A ratio alone cannot identify a composition uniquely.',
    tasks: [
      {text: 'At 20.1 kHz and 30 mT peak, compare 20% and 80% B. Keep the first spectrum. Check whether the normalized spectral shape changes across several orders.', set: {...config, scale: 'first'}, clear: true},
      {text: 'Use population B alone. Keep the spectrum, then increase its effective relaxation time from 2 to 10 µs at fixed frequency. How does A₅/A₃ change?', set: {...config, percentB: 100}, clear: true},
      {text: 'With population A alone at 1 mT, double the field and compare A₃ in relative voltage. The cubic weak-field limit predicts a factor of about eight.', set: {...config, drive: 1, percentB: 0, scale: 'voltage', trace: 'voltage'}, clear: true},
    ],
    physics: '<p>Each population has a spherical core, μ = M<sub>s</sub>πd³/6, with M<sub>s</sub> = 480 kA/m. Its reduced moment relaxes toward L(μB/k<sub>B</sub>T) with a constant effective τ. Odd Fourier coefficients are divided by 1 + inωτ, then added with their phases and magnetic volume weights. Inductive detection weights the resulting amplitudes by nω. V₀ is the ideal coil factor times 2π × 20.1 kHz times the sample saturation moment at 1× loading.</p><p>Two independent, monodisperse populations approximate the building blocks. The model omits anisotropy, interactions, field-dependent relaxation, instrument filtering and noise. The settings are illustrative. Temperature varies the equilibrium response with τ held fixed.</p>' + references,
    check: 'Why do moment amplitudes and pickup voltage amplitudes give different fifth-to-third harmonic ratios?',
    answer: 'The coil measures −dm/dt, which multiplies each moment amplitude by its angular frequency. The ideal pickup A₅/A₃ is 5/3 times the corresponding moment-amplitude ratio.',
  },
};
root.NanoMPSLesson = {config, controls, guide};
})(typeof globalThis !== 'undefined' ? globalThis : this);
