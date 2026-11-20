// Verifies the analytic magnet fields against brute-force surface-charge integration.
const P = require(require('path').resolve(__dirname,'..','..','src/v8/engines/magnet-fields.js'));

// field of a charged planar face (density +1), H/(Br) contribution = (1/4π)∫(r-r')/|r-r'|³ dA'
function discNumeric(x, y, z, a, z0, N) {
  let B = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const r = a * Math.sqrt((i + 0.5) / N);           // area-uniform radii
    const dA = Math.PI * a * a / N / N;
    for (let j = 0; j < N; j++) {
      const ph = 2 * Math.PI * (j + 0.5) / N;
      const dx = x - r * Math.cos(ph), dy = y - r * Math.sin(ph), dz = z - z0;
      const R3 = Math.pow(dx * dx + dy * dy + dz * dz, 1.5);
      B[0] += dx / R3 * dA; B[1] += dy / R3 * dA; B[2] += dz / R3 * dA;
    }
  }
  return B.map(v => v / (4 * Math.PI));
}
function rectNumeric(x, y, z, a, b, z0, N) {
  let B = [0, 0, 0]; const dA = (2 * a / N) * (2 * b / N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const xs = -a + 2 * a * (i + 0.5) / N, ys = -b + 2 * b * (j + 0.5) / N;
    const dx = x - xs, dy = y - ys, dz = z - z0;
    const R3 = Math.pow(dx * dx + dy * dy + dz * dz, 1.5);
    B[0] += dx / R3 * dA; B[1] += dy / R3 * dA; B[2] += dz / R3 * dA;
  }
  return B.map(v => v / (4 * Math.PI));
}
const diff = (a, b) => a.map((v, i) => v - b[i]);
const nrm = a => Math.hypot(...a);
let worst = 0;
function check(name, an, nu) {
  const e = nrm(diff(an, nu)) / Math.max(nrm(nu), 1e-12);
  worst = Math.max(worst, e);
  console.log(name.padEnd(34), an.map(v => v.toExponential(4)).join(' '), ' | num', nu.map(v => v.toExponential(4)).join(' '), ' rel.err', e.toExponential(2));
}

// cylinder: radius 6, half length 3 (12 x 6 mm disc), points in a plane 2 mm above the top face
const a = 6, h = 3, N = 700;
for (const [x, y, z] of [[0, 0, 5], [3, 4, 5], [6, 0, 5], [10, -2, 5], [25, 30, 5], [0, 7, 3.5], [40, 0, -1]]) {
  const an = P.cylB(x, y, z, a, h);
  const t = discNumeric(x, y, z, a, h, N), b = discNumeric(x, y, z, a, -h, N);
  check(`cyl (${x},${y},${z})`, an, diff(t, b));
}
// box: half sizes 10 x 5 x 2.5
const [bx, by, bz] = [10, 5, 2.5];
for (const [x, y, z] of [[0, 0, 4.5], [7, 3, 4.5], [12, -6, 4.5], [-30, 20, 4.5], [11, 0, 0], [0, 0, -8]]) {
  const an = P.boxB(x, y, z, bx, by, bz);
  const t = rectNumeric(x, y, z, bx, by, bz, N), b = rectNumeric(x, y, z, bx, by, -bz, N);
  check(`box (${x},${y},${z})`, an, diff(t, b));
}
// on-axis closed form for the cylinder
for (const z of [4, 5, 10, 30]) {
  const exact = 0.5 * ((z + h) / Math.hypot(z + h, a) - (z - h) / Math.hypot(z - h, a));
  check(`cyl axis z=${z}`, P.cylB(0, 0, z, a, h), [0, 0, exact]);
}
// far field: sphere and cylinder of equal moment agree with the dipole
{
  const V = Math.PI * a * a * 2 * h, R = Math.cbrt(3 * V / (4 * Math.PI));
  const p = [120, 50, 80];
  check('cyl vs sphere far field', P.cylB(...p, a, h), P.sphB(...p, R));
}
// rotated primitive (bar magnetised along x) vs. box with permuted axes
{
  const prim = { type: 2, c: [0, 0, -5], e0: [0, 0, 1], e1: [0, -1, 0], e2: [1, 0, 0], dims: [3, 4, 15], Br: 1 };
  const pt = [9, 7, 0];
  const B1 = P.primB(prim, ...pt);
  // direct: box magnetised along +x with half sizes (15,4,3) → use boxB on permuted coords (y,z,x)
  const l = [pt[1], pt[2] + 5, pt[0]];
  const b = P.boxB(l[0], l[1], l[2], 4, 3, 15);
  check('rotated bar primitive', B1, [b[2], b[0], b[1]]);
}
console.log('\nworst relative error:', worst.toExponential(2));
// Langevin sanity
for (const x of [0.01, 0.29, 0.31, 1, 5, 25]) console.log('xi', x, 'L', P.langevin(x).toFixed(6), 'S2', P.order2(x).toFixed(6), 'wob', P.wobble(x).toFixed(6));
console.log('xi per mT for dm=20nm:', (P.xiPerTesla(20) * 1e-3).toFixed(3));

// Nanocompass: fail the run if the analytic fields deviate from the quadrature by more than 0.5 %.
if (worst > 5e-3) { console.log('FAIL magnet fields'); process.exitCode = 1; } else console.log('PASS magnet fields agree with surface-charge integration (worst ' + worst.toExponential(1) + ')');
