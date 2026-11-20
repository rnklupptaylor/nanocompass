'use strict';
// Nanocompass v8.0: the magnetometer engine reproduces known limits.
// Usage (from the project root): node tests/v8/magnetometer.cjs
const path = require('path'), M = require(path.resolve(__dirname, '..', '..', 'src/v8/engines/magnetometer.js'));
let failed = 0; const check = (ok, text) => { console.log(ok ? 'PASS' : 'FAIL', text); if (!ok) failed++; };
function loop(cfg, opt) { const m = new M.Magnetometer(cfg), pts = [...M.loopProtocol(m, opt)];
  const down = pts.filter(p => p.branch === 'down'), up = pts.filter(p => p.branch === 'up');
  const cross = a => { for (let i = 1; i < a.length; i++) if (Math.sign(a[i].M) !== Math.sign(a[i - 1].M)) { const f = a[i - 1].M / (a[i - 1].M - a[i].M); return a[i - 1].B + f * (a[i].B - a[i - 1].B); } return 0; };
  const at0 = a => { for (let i = 1; i < a.length; i++) if (Math.sign(a[i].B) !== Math.sign(a[i - 1].B)) return (a[i].M + a[i - 1].M) / 2; };
  return { Hc: (Math.abs(cross(down)) + Math.abs(cross(up))) / 2, Mr: at0(down), m }; }
const sw = loop({ dNm: 20, sigma: 0 }, { T: 0.5, Bmax: 0.2, sweepTime: 10, steps: 600 });
check(Math.abs(sw.Hc / sw.m.hk() - 0.479) < 0.01 && Math.abs(sw.Mr - 0.5) < 0.02, `Stoner–Wohlfarth limit (random axes, T → 0): Hc/HK = ${(sw.Hc / sw.m.hk()).toFixed(3)} (0.479), Mr/Ms = ${sw.Mr.toFixed(3)} (0.5)`);
const spm = loop({ dNm: 8, sigma: 0 }, { T: 300, Bmax: 0.2, sweepTime: 10, steps: 300 });
check(spm.Hc < 1e-5, `superparamagnetic 8 nm at 300 K: no coercivity (Hc = ${(spm.Hc * 1e3).toFixed(4)} mT)`);
const fast = loop({ dNm: 20, sigma: 0 }, { T: 300, Bmax: 0.2, sweepTime: 1e-3, steps: 300 }), slow = loop({ dNm: 20, sigma: 0 }, { T: 300, Bmax: 0.2, sweepTime: 1, steps: 300 });
check(fast.Hc > 1e-3 && slow.Hc < 1e-5, `sweep-rate dependence at 20 nm, 300 K: Hc = ${(fast.Hc * 1e3).toFixed(2)} mT (1 ms loop) vs ${(slow.Hc * 1e3).toFixed(3)} mT (1 s loop)`);
const liq = loop({ dNm: 30, sigma: 0, medium: 'liquid' }, { T: 300, Bmax: 0.2, sweepTime: 1, steps: 300 });
check(liq.Hc < 1e-5, `liquid: Brown rotation closes the loop even for 30 nm (Hc = ${(liq.Hc * 1e3).toFixed(4)} mT)`);
{ const m = new M.Magnetometer({ dNm: 10, sigma: 0 }), pts = [...M.zfcfcProtocol(m, { tPoint: 10, dT: 1, Tmax: 120 })], z = pts.filter(p => p.curve === 'ZFC'), f = pts.filter(p => p.curve === 'FC');
  const pk = z.reduce((a, b) => b.M > a.M ? b : a), TB = m.blockingT(10, 10);
  check(Math.abs(pk.T / TB - 1) < 0.25, `ZFC peak ${pk.T} K near the Néel–Arrhenius blocking temperature ${TB.toFixed(1)} K (10 s per point)`);
  check(f[0].M > 3 * z[0].M && Math.abs(f.at(-1).M - z.at(-1).M) < 0.02 * f.at(-1).M, 'FC (measured on warming) lies above ZFC at low temperature and joins it above blocking'); }
{ const m = new M.Magnetometer({ dNm: 10, sigma: 0 }), T = 60, pts = [...M.acProtocol(m, { against: 'f', T, fmin: 1e-2, fmax: 1e9, points: 600 })];
  const pk = pts.reduce((a, b) => b.im > a.im ? b : a), fexp = 1 / (2 * Math.PI * m.tauN(m.sizes[0], T) / 2);
  check(Math.abs(Math.log(pk.f / fexp)) < 0.05, `Debye: χ″ peaks at ωτ = 1 (${pk.f.toExponential(2)} Hz vs ${fexp.toExponential(2)} Hz)`); }
{ const m = new M.Magnetometer({ dNm: 10, sigma: 0 }), peak = f => [...M.acProtocol(m, { against: 'T', f, Tmin: 5, Tmax: 200, points: 400 })].reduce((a, b) => b.im > a.im ? b : a).T;
  const a = peak(10), b = peak(1e5); check(b > a, `χ″(T) peak moves up with frequency: ${a.toFixed(1)} K at 10 Hz, ${b.toFixed(1)} K at 100 kHz`); }
{ const m = new M.Magnetometer({ dNm: 20, sigma: 0 }), pts = [...M.loopProtocol(m, { T: 0.5, Bmax: 0.2, steps: 300 })], v = pts.filter(p => p.branch === 'virgin');
  check(pts[0].B === 0 && Math.abs(pts[0].M) < 1e-9 && v.at(-1).B === 0.2, `loop starts demagnetised at zero field and records the initial curve up to +Bmax (${v.length} points)`); }
{ const m = new M.Magnetometer({ dNm: 10, sigma: 0.2 }), pts = [...M.zfcfcProtocol(m, { Tmax: 200, dT: 5 })], order = [...new Set(pts.map(p => p.curve))].join(' → ');
  check(order === 'cool → switch → ZFC → fccool → FC' && pts.filter(p => p.curve === 'cool').every(p => Math.abs(p.M) < 1e-9 && p.B === 0), `ZFC/FC follows the laboratory sequence: ${order}, M = 0 while cooling without field`); }
// Shapes expected of standard measurements (checked 14 November 2026 at Robin's request).
{ const m = new M.Magnetometer({ dNm: 12, sigma: 0.15, K: 2e4 }), pts = [...M.loopProtocol(m, { T: 10, Bmax: 0.2, sweepTime: 10, steps: 240 })];
  const v = pts.filter(p => p.branch === 'virgin' && p.B > 0), d = pts.filter(p => p.branch === 'down'), u = pts.filter(p => p.branch === 'up');
  const at = (br, B) => br.reduce((a, b) => Math.abs(b.B - B) < Math.abs(a.B - B) ? b : a).M;
  const inside = v.every(p => p.M <= at(d, p.B) + 1e-3 && p.M >= at(u, p.B) - 1e-3);
  const mono = d.every((p, i) => !i || p.M <= d[i - 1].M + 1e-9) && u.every((p, i) => !i || p.M >= u[i - 1].M - 1e-9);
  check(inside && mono && Math.abs(at(d, -0.1) + at(u, 0.1)) < 1e-6, 'loop shape: initial curve inside the loop, monotonic branches, point-symmetric loop'); }
{ const m = new M.Magnetometer({ dNm: 12, sigma: 0, K: 2e4 }), pts = [...M.loopProtocol(m, { T: 300, Bmax: 0.2, sweepTime: 10, steps: 240 })].filter(p => p.branch === 'up'), s = m.sizes[0], kT = M.KB * 300;
  const dev = B => { const p = pts.reduce((a, b) => Math.abs(b.B - B) < Math.abs(a.B - B) ? b : a); return p.M / M.langevin(s.mu * p.B / kT) - 1; };
  check(Math.abs(dev(0.005)) < 0.03 && Math.abs(dev(0.2)) < 0.03 && dev(0.02) > -0.15, `superparamagnetic M(H) matches Langevin at low and high field (${(100 * dev(0.005)).toFixed(1)} %, ${(100 * dev(0.2)).toFixed(1)} %) and stays within 15 % between (${(100 * dev(0.02)).toFixed(1)} %)`); }
{ const m = new M.Magnetometer({ dNm: 12, sigma: 0.15, K: 2e4 }), pts = [...M.zfcfcProtocol(m, { Bm: 0.005, Tmin: 5, Tmax: 300, dT: 5, tPoint: 10 })];
  const z = pts.filter(p => p.curve === 'ZFC' || p.curve === 'switch'), f = pts.filter(p => p.curve === 'FC'), fAt = T => f.reduce((a, b) => Math.abs(b.T - T) < Math.abs(a.T - T) ? b : a).M;
  const maxima = z.filter((p, i) => i > 0 && i < z.length - 1 && p.M > z[i - 1].M && p.M >= z[i + 1].M).length;
  check(z.every(p => p.M <= fAt(p.T) + 1e-4) && f.every((p, i) => !i || p.M <= f[i - 1].M + 1e-6) && maxima === 1, 'ZFC/FC shape: FC never below ZFC, FC falls monotonically on warming, one ZFC maximum'); }
{ const m = new M.Magnetometer({ dNm: 12, sigma: 0.15, K: 2e4 }), pts = [...M.acProtocol(m, { against: 'T', f: 1, Tmin: 5, Tmax: 300, points: 300 })];
  const pr = pts.reduce((a, b) => b.re > a.re ? b : a), pi = pts.reduce((a, b) => b.im > a.im ? b : a), cT = T => { const p = pts.reduce((a, b) => Math.abs(b.T - T) < Math.abs(a.T - T) ? b : a); return p.re * p.T; };
  check(pr.T > pi.T && pts.every(p => p.re >= 0 && p.im >= 0) && Math.abs(cT(250) / cT(300) - 1) < 0.02, `AC shape: χ′ peaks above χ″ (${pr.T.toFixed(0)} K vs ${pi.T.toFixed(0)} K), both positive, Curie law χ′T = const at high T`); }
if (failed) process.exitCode = 1;
