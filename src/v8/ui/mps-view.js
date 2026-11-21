/* Interactive teaching view for the periodic MPS model. */
(function(root) {
'use strict';
const MPS = root.NanoMPS;
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};
const number = value => value == null ? '—' : value < .001 && value > 0 ? value.toExponential(2) : +value.toPrecision(3) + '';
const axes = [
  ['third', 'Divide by A₃', 'Aₙ / A₃', 3],
  ['first', 'Divide by A₁', 'Aₙ / A₁', 1],
  ['voltage', 'Relative voltage', 'Aₙ / V₀', null],
];
const orders = [1, 3, 5, 7, 9, 11, 13, 15];

function select(label, choices) {
  const control = el('select', 'mps-select');
  control.setAttribute('aria-label', label);
  for (const [value, text] of choices) {
    const option = el('option', '', text);
    option.value = value;
    control.append(option);
  }
  return control;
}

function create(spec, controls, curvePlot) {
  const config = {...spec.config};
  let current, reference, animation = 0;
  const panel = el('div', 'mps-panel');
  panel.hidden = true;
  panel.dataset.view = 'spectrum';
  const views = el('div', 'seg mps-switch');
  views.setAttribute('role', 'group');
  views.setAttribute('aria-label', 'MPS view');
  for (const [view, label] of [['spectrum', 'Spectrum'], ['trace', 'Time trace'], ['setup', 'Setup']]) {
    const button = el('button', '', label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(view === panel.dataset.view));
    button.onclick = () => {
      panel.dataset.view = view;
      for (const other of views.children) other.setAttribute('aria-pressed', String(other === button));
      panel.scrollTop = 0;
    };
    views.append(button);
  }
  const spectrum = el('section', 'mps-card mps-spectrum-card');
  spectrum.dataset.mpsView = 'spectrum';
  spectrum.setAttribute('aria-label', 'Pickup-coil spectrum');
  const heading = el('div', 'mps-heading');
  const scale = select('Spectrum normalization', axes);
  heading.append(el('h2', '', 'Pickup-coil spectrum'), scale);
  const details = el('p', 'mps-caption');
  const spectrumData = el('div', 'mps-tablebox');
  const comparison = el('p', 'mps-caption');
  comparison.setAttribute('aria-live', 'polite');
  const actions = el('div', 'mps-actions');
  const keep = el('button', 'pv-btn', 'Keep spectrum');
  const clear = el('button', 'pv-btn', 'Clear reference');
  keep.type = clear.type = 'button';
  actions.append(keep, clear);
  spectrum.append(heading, actions, details, spectrumData, comparison);

  const wave = el('section', 'mps-card mps-wave');
  wave.dataset.mpsView = 'trace';
  wave.setAttribute('aria-label', 'Time trace');
  const waveHeading = el('div', 'mps-heading');
  const trace = select('Time trace signal', [['moment', 'Field and moment'], ['voltage', 'Pickup voltage']]);
  waveHeading.append(el('h2', '', 'One drive cycle'), trace);
  const waveBox = el('div', 'mps-wavebox');
  const canvas = el('canvas');
  canvas.setAttribute('role', 'img');
  const legend = el('div', 'mps-legend');
  waveBox.append(canvas);
  wave.append(waveHeading, legend, waveBox);

  const setup = el('figure', 'mps-card mps-setup');
  setup.dataset.mpsView = 'setup';
  const setupHeading = el('div', 'mps-heading');
  const driveSettings = el('span', 'mps-drive-settings');
  setupHeading.append(el('h2', '', 'MPS coil setup'), driveSettings);
  const coils = el('canvas', 'mps-coils');
  coils.setAttribute('role', 'img');
  coils.setAttribute('aria-label', 'Cutaway of a drive coil surrounding a particle sample in a pickup coil and an empty balance coil. The drive field alternates along their shared axis.');
  const caption = el('figcaption', 'mps-caption', 'The drive coil applies a sinusoidal field. Subtracting the empty coil’s voltage suppresses direct pickup. MPS reads the sample’s voltage harmonics. The M(H) loop traces magnetisation through a field sweep.');
  setup.append(setupHeading, coils, caption);
  panel.append(views, spectrum, setup, wave);

  function settingsLabel(c) {
    return `${c.drive} mT peak, ${c.rate} kHz, ${c.temperature} K, ${c.percentB}% B, ${c.amount}× loading. ` +
      `A: ${c.diameterA} nm / ${c.tauA} µs. B: ${c.diameterB} nm / ${c.tauB} µs.`;
  }
  function renderSpectrum() {
    const [, , unit, denominator] = axes.find(([value]) => value === scale.value);
    const values = run => {
      const base = denominator ? run.harmonics[(denominator - 1) / 2].amplitude : 1;
      return orders.map(n => MPS.amplitudeRatio(run.harmonics[(n - 1) / 2].amplitude, base));
    };
    const live = values(current);
    const saved = reference ? values(reference.result) : null;
    const max = Math.max(...live, ...(saved || []));
    const ceiling = Math.max(0, Math.ceil(Math.log10(max || 1)));
    const floor = Math.min(-6, ceiling - 6);
    const width = value => value > 0 ? Math.max(0, (Math.log10(value) - floor) / (ceiling - floor) * 100) : 0;
    details.textContent = 'Peak amplitudes ' + unit + ' · log scale 10' + exponent(floor) + ' to 10' + exponent(ceiling);
    const table = el('table', 'mps-spectrum');
    table.setAttribute('aria-label', 'Pickup voltage peak amplitudes ' + unit);
    const header = table.createTHead().insertRow();
    for (const text of ['n', 'Log scale', 'Current', ...(saved ? ['Reference'] : [])]) {
      const th = el('th', '', text);
      th.scope = 'col';
      header.append(th);
    }
    const body = table.createTBody();
    orders.forEach((n, i) => {
      const row = body.insertRow();
      const order = el('th', '', n);
      order.scope = 'row';
      row.append(order);
      const track = el('div', 'mps-track');
      track.setAttribute('aria-hidden', 'true');
      for (const [cls, value] of [['current', live[i]], ...(saved ? [['reference', saved[i]]] : [])]) {
        const bar = el('span', 'mps-band mps-' + cls);
        bar.style.width = width(value) + '%';
        track.append(bar);
      }
      row.insertCell().append(track);
      row.insertCell().textContent = number(live[i]);
      if (saved) row.insertCell().textContent = number(saved[i]);
    });
    spectrumData.replaceChildren(table);
  }
  function exponent(n) {
    const digits = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    return String(n).replace('-', '⁻').replace(/\d/g, d => digits[d]);
  }
  function drawWave() {
    if (panel.hidden || !current) return;
    const points = current.waveform;
    const x = points.map(p => p.cycle);
    const voltage = trace.value === 'voltage';
    const colors = getComputedStyle(panel);
    const signal = colors.getPropertyValue('--mps-current').trim();
    const field = colors.getPropertyValue('--mps-field').trim();
    const curves = voltage
      ? [{x, y: points.map(p => p.voltage), color: signal}]
      : [{x, y: points.map(p => p.field), color: field, dash: [4, 4]}, {x, y: points.map(p => p.moment), color: signal}];
    const extent = Math.max(...curves[0].y.map(Math.abs));
    const ymax = voltage ? Math.max(.001, +extent.toPrecision(1) * 1.25) : 1;
    canvas.setAttribute('aria-label', voltage ? 'Ideal pickup voltage over one excitation cycle' : 'Applied field and sample moment over one excitation cycle');
    curvePlot(canvas, curves, {xmin: 0, xmax: 1, ymin: -ymax, ymax, ylabel: voltage ? 'Voltage V / V₀' : 'Normalized field and moment',
      xlabel: 'Drive cycles', xfmt: v => +v.toFixed(1), yfmt: v => +v.toPrecision(2)});
  }
  function renderLegend() {
    const voltage = trace.value === 'voltage';
    legend.replaceChildren(el('span', 'mps-signal-key', voltage ? 'Particle-induced voltage V / V₀' : 'Sample moment m / mₛₐₜ'));
    if (!voltage) legend.append(el('span', 'mps-field-key', 'Drive field B / Bₚₑₐₖ'));
    drawWave();
  }
  function renderComparison() {
    clear.disabled = !reference;
    comparison.textContent = reference ? 'Reference ' + settingsLabel(reference.config) : '';
  }
  const readouts = el('dl', 'pv-readouts');
  function update() {
    current = MPS.measure({...config, field: config.drive / 1000, frequency: config.rate * 1000,
      relaxationA: config.tauA * 1e-6, relaxationB: config.tauB * 1e-6, fractionB: config.percentB / 100});
    driveSettings.textContent = number(config.drive) + ' mT peak · ' + number(config.rate) + ' kHz';
    renderSpectrum();
    drawWave();
    const [first, third, fifth] = current.harmonics.map(h => h.amplitude);
    readouts.replaceChildren();
    const rows = [
      ['A₃ / V₀', number(third)],
      ['A₅ / A₃', number(MPS.amplitudeRatio(fifth, third))],
      ['A₃ / A₁', number(MPS.amplitudeRatio(third, first))],
    ];
    for (const [label, value] of rows) readouts.append(el('dt', '', label), el('dd', '', value));
  }
  for (const control of [scale, trace]) control.addEventListener('change', () => {
    config[control === scale ? 'scale' : 'trace'] = control.value;
    if (control === scale) renderSpectrum();
    else renderLegend();
  });
  keep.onclick = () => {
    reference = {result: current, config: {...config}};
    renderSpectrum();
    renderComparison();
  };
  clear.onclick = () => {
    reference = null;
    renderSpectrum();
    renderComparison();
  };
  function drawGraphics() {
    drawWave();
    root.NanoMPSDiagram.draw(coils);
  }
  const size = new ResizeObserver(drawGraphics);
  const theme = new MutationObserver(drawGraphics);
  const scheme = root.matchMedia('(prefers-color-scheme: dark)');

  function show(settings, clearReference) {
    Object.assign(config, settings);
    if (clearReference) reference = null;
    if (panel.hidden) {
      panel.hidden = false;
      size.observe(waveBox);
      size.observe(coils);
      theme.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
      scheme.addEventListener('change', drawGraphics);
    }
    scale.value = config.scale;
    trace.value = config.trace;
    controls.replaceChildren();
    for (const definition of spec.controls) {
      const onInput = value => {
        config[definition.key] = value;
        cancelAnimationFrame(animation);
        animation = requestAnimationFrame(update);
      };
      controls.append(root.NanoSlider.make(definition, config[definition.key], {onInput}).row);
    }
    controls.append(readouts);
    update();
    renderComparison();
    renderLegend();
  }
  function hide() {
    panel.hidden = true;
    cancelAnimationFrame(animation);
    size.disconnect();
    theme.disconnect();
    scheme.removeEventListener('change', drawGraphics);
  }
  return {panel, show, hide};
}

root.NanoMPSView = {create};
})(typeof globalThis !== 'undefined' ? globalThis : this);
