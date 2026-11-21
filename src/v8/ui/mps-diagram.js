/* Side-view cutaway of an example differential MPS coil arrangement. */
(function(root) {
'use strict';
function draw(canvas) {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  const dpr = Math.min(2, root.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const g = canvas.getContext('2d');
  const scale = Math.min(width / 420, height / 182);
  g.setTransform(dpr * scale, 0, 0, dpr * scale, (width - 420 * scale) * dpr / 2, (height - 182 * scale) * dpr / 2);
  const style = getComputedStyle(canvas);
  const color = name => style.getPropertyValue(name).trim();
  const surface = color('--surface'), ink = color('--ink'), outline = color('--ink-2');
  const drive = color('--mps-reference'), receive = color('--mps-current'), field = color('--mps-field');

  function box(x, y, w, h, radius, fill, stroke) {
    g.beginPath();
    g.roundRect(x, y, w, h, radius);
    if (fill) {g.fillStyle = fill; g.fill();}
    if (stroke) {g.strokeStyle = stroke; g.stroke();}
  }
  function line(points, stroke) {
    g.beginPath();
    points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.strokeStyle = stroke;
    g.stroke();
  }
  function label(text, x, y, fill) {
    g.fillStyle = fill;
    g.fillText(text, x, y);
  }
  function windings(start, count, step, top, bottom, w, h, stroke) {
    for (let i = 0; i < count; i++) {
      const x = start + i * step;
      box(x, top, w, h, 2, stroke);
      box(x, bottom, w, h, 2, stroke);
    }
  }

  g.lineWidth = 1.4;
  g.lineJoin = 'round';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 17px ' + color('--ui');

  // The cutaway shows the same winding along the upper and lower edges of the bore.
  box(17, 35, 386, 112, 10, surface, color('--line'));
  windings(26, 34, 11, 39, 133, 6, 10, drive);
  label('Drive coil', 210, 14, drive);
  line([[210, 24], [210, 38]], drive);

  box(54, 80, 122, 42, 5, null, color('--line'));
  box(244, 80, 122, 42, 5, null, color('--line'));
  windings(60, 9, 13, 78, 118, 7, 7, receive);
  windings(250, 9, 13, 78, 118, 7, 7, receive);
  label('Pickup coil', 115, 64, receive);
  label('Balance coil', 305, 64, receive);

  box(75, 92, 80, 18, 8, color('--surface-3'), outline);
  box(145, 92, 12, 18, 2, color('--surface-3'), outline);
  for (const [x, y] of [[85, 100], [92, 103], [99, 97], [106, 104], [113, 99], [120, 104], [128, 97], [137, 102]]) {
    g.beginPath();
    g.arc(x, y, 2, 0, 2 * Math.PI);
    g.fillStyle = outline;
    g.fill();
  }
  g.setLineDash([3, 3]);
  line([[115, 111], [115, 155]], ink);
  g.setLineDash([]);
  label('Particle sample', 115, 169, ink);
  label('Empty', 305, 101, outline);
  line([[193, 101], [227, 101]], field);
  line([[199, 96], [193, 101], [199, 106]], field);
  line([[221, 96], [227, 101], [221, 106]], field);
  label('B(t)', 210, 118, field);
}
root.NanoMPSDiagram = {draw};
})(typeof globalThis !== 'undefined' ? globalThis : this);
