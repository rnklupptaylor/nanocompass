/* Nanocompass · exact fields of uniformly magnetised permanent magnets (cylinder, ring, cuboid, sphere) and
 * small vector and optics helpers. Checked against brute-force surface-charge integration by tests/v8/magnet_fields.cjs. */
/* Ferrocell physics core (CPU side). Mirrored 1:1 by the fragment shader.
   Units: lengths in mm, fields in tesla, wavelengths in nm. */
const Phys = (() => {
  const PI = Math.PI;
  const KB = 1.380649e-23, TEMP = 293.15;
  const MS_MAGNETITE = 4.5e5; // A/m, saturation magnetisation of nanoscale magnetite

  /* Bulirsch's generalised complete elliptic integral C(kc,p,c,s)
     (algorithm as given by Derby & Olbert, Am. J. Phys. 78, 229 (2010)). */
  function cel(kc, p, c, s) {
    if (kc === 0) kc = 1e-12;
    const errtol = 1e-10;
    let k = Math.abs(kc), pp = p, cc = c, ss = s, em = 1, f, g, q;
    if (p > 0) { pp = Math.sqrt(p); ss = s / pp; }
    else {
      f = kc * kc; q = 1 - f; g = 1 - pp; f = f - pp; q = q * (ss - c * pp);
      pp = Math.sqrt(f / g); cc = (c - ss) / g; ss = -q / (g * g * pp) + cc * pp;
    }
    f = cc; cc = cc + ss / pp; g = k / pp; ss = 2 * (ss + f * g); pp = g + pp; g = em; em = k + em;
    let kk = k;
    for (let i = 0; i < 40 && Math.abs(g - k) > g * errtol; i++) {
      k = 2 * Math.sqrt(kk); kk = k * em; f = cc; cc = cc + ss / pp; g = kk / pp;
      ss = 2 * (ss + f * g); pp = g + pp; g = em; em = k + em;
    }
    return (PI / 2) * (ss + cc * em) / (em * (em + pp));
  }

  /* Uniformly, axially magnetised cylinder (radius a, half-length b), field per unit Br.
     Exact; equivalent to an ideal solenoid with surface current K = M. */
  function cylB(x, y, z, a, b) {
    const rho = Math.hypot(x, y);
    const zp = z + b, zm = z - b;
    const ap2 = (rho + a) * (rho + a), am2 = (a - rho) * (a - rho);
    const sp = Math.sqrt(zp * zp + ap2), sm = Math.sqrt(zm * zm + ap2);
    const gam = (a - rho) / (a + rho), g2 = gam * gam;
    const kp = Math.max(Math.sqrt(zp * zp + am2) / sp, 1e-12);
    const km = Math.max(Math.sqrt(zm * zm + am2) / sm, 1e-12);
    const Brho = (a / sp * cel(kp, 1, 1, -1) - a / sm * cel(km, 1, 1, -1)) / PI;
    const Bz = a / (a + rho) * (zp / sp * cel(kp, g2, 1, gam) - zm / sm * cel(km, g2, 1, gam)) / PI;
    if (rho < 1e-12) return [0, 0, Bz];
    return [Brho * x / rho, Brho * y / rho, Bz];
  }

  /* Cuboid magnetised along +z, half sizes (a,b,c): surface-charge model, closed form. */
  function lnVR(v, u, w) { // ln(v + sqrt(u²+v²+w²)) without cancellation
    const R = Math.sqrt(u * u + v * v + w * w);
    if (v >= 0) return Math.log(v + R);
    return Math.log(Math.max(u * u + w * w, 1e-300)) - Math.log(R - v);
  }
  function atanS(y, x) { return x >= 0 ? Math.atan2(y, x) : Math.atan2(-y, -x); }
  function faceI(x, y, z, a, b, z0) {
    const w = z - z0; let Ix = 0, Iy = 0, Iz = 0;
    for (let iu = 0; iu < 2; iu++) {
      const u = iu ? x - a : x + a;
      for (let iv = 0; iv < 2; iv++) {
        const v = iv ? y - b : y + b;
        const s = iu === iv ? 1 : -1;
        const R = Math.sqrt(u * u + v * v + w * w);
        Ix -= s * lnVR(v, u, w);
        Iy -= s * lnVR(u, v, w);
        Iz += s * atanS(u * v, w * R);
      }
    }
    return [Ix, Iy, Iz];
  }
  function boxB(x, y, z, a, b, c) {
    const T = faceI(x, y, z, a, b, c), D = faceI(x, y, z, a, b, -c), k = 1 / (4 * PI);
    return [(T[0] - D[0]) * k, (T[1] - D[1]) * k, (T[2] - D[2]) * k];
  }

  /* Uniformly magnetised sphere along +z: exact dipole outside. */
  function sphB(x, y, z, R) {
    const r2 = x * x + y * y + z * z, r = Math.sqrt(r2);
    if (r < R) return [0, 0, 2 / 3];
    const k = R * R * R / (3 * r2 * r), nz = z / r;
    return [k * 3 * nz * x / r, k * 3 * nz * y / r, k * (3 * nz * nz - 1)];
  }

  /* Primitive: {type 0 cyl | 1 ring | 2 box | 3 sphere, c, e0, e1, e2, dims[4], Br}
     Local frame: magnetisation along e2. dims: cyl (R,-,h), ring (Ro,Ri,h), box (hx,hy,hz), sphere (R). */
  function localOf(p, x, y, z) {
    const dx = x - p.c[0], dy = y - p.c[1], dz = z - p.c[2];
    const e0 = p.e0, e1 = p.e1, e2 = p.e2;
    return [dx * e0[0] + dy * e0[1] + dz * e0[2], dx * e1[0] + dy * e1[1] + dz * e1[2], dx * e2[0] + dy * e2[1] + dz * e2[2]];
  }
  function primB(p, x, y, z) {
    const l = localOf(p, x, y, z), d = p.dims;
    let b;
    if (p.type === 0) b = cylB(l[0], l[1], l[2], d[0], d[2]);
    else if (p.type === 1) {
      const o = cylB(l[0], l[1], l[2], d[0], d[2]), i = cylB(l[0], l[1], l[2], d[1], d[2]);
      b = [o[0] - i[0], o[1] - i[1], o[2] - i[2]];
    } else if (p.type === 2) b = boxB(l[0], l[1], l[2], d[0], d[1], d[2]);
    else b = sphB(l[0], l[1], l[2], d[0]);
    const e0 = p.e0, e1 = p.e1, e2 = p.e2, s = p.Br;
    return [s * (b[0] * e0[0] + b[1] * e1[0] + b[2] * e2[0]),
            s * (b[0] * e0[1] + b[1] * e1[1] + b[2] * e2[1]),
            s * (b[0] * e0[2] + b[1] * e1[2] + b[2] * e2[2])];
  }
  function fieldAt(prims, x, y, z) {
    let Bx = 0, By = 0, Bz = 0;
    for (const p of prims) { const b = primB(p, x, y, z); Bx += b[0]; By += b[1]; Bz += b[2]; }
    return [Bx, By, Bz];
  }

  /* Segment–magnet intersection (shadows / occlusion). */
  const EMPTY = [1, 0];
  function slabI(a, d, h) {
    if (Math.abs(d) < 1e-9) return Math.abs(a) < h ? [-1e9, 1e9] : EMPTY;
    const t0 = (-h - a) / d, t1 = (h - a) / d;
    return [Math.min(t0, t1), Math.max(t0, t1)];
  }
  function diskI(ax, ay, dx, dy, R) {
    const A = dx * dx + dy * dy, B = ax * dx + ay * dy, C = ax * ax + ay * ay - R * R;
    if (A < 1e-12) return C < 0 ? [-1e9, 1e9] : EMPTY;
    const disc = B * B - A * C;
    if (disc <= 0) return EMPTY;
    const s = Math.sqrt(disc);
    return [(-B - s) / A, (-B + s) / A];
  }
  function ballI(a, d, R) {
    const A = d[0] * d[0] + d[1] * d[1] + d[2] * d[2], B = a[0] * d[0] + a[1] * d[1] + a[2] * d[2];
    const C = a[0] * a[0] + a[1] * a[1] + a[2] * a[2] - R * R;
    if (A < 1e-12) return C < 0 ? [-1e9, 1e9] : EMPTY;
    const disc = B * B - A * C;
    if (disc <= 0) return EMPTY;
    const s = Math.sqrt(disc);
    return [(-B - s) / A, (-B + s) / A];
  }
  const isect = (a, b) => [Math.max(a[0], b[0]), Math.min(a[1], b[1])];
  function segHits(p, A, B) {
    const al = localOf(p, A[0], A[1], A[2]), bl = localOf(p, B[0], B[1], B[2]);
    const d = [bl[0] - al[0], bl[1] - al[1], bl[2] - al[2]], dm = p.dims;
    let I = [0, 1];
    if (p.type <= 1) {
      I = isect(I, slabI(al[2], d[2], dm[2]));
      const Io = isect(I, diskI(al[0], al[1], d[0], d[1], dm[0]));
      if (Io[0] >= Io[1]) return false;
      if (p.type === 1) {
        const Ii = isect(I, diskI(al[0], al[1], d[0], d[1], dm[1]));
        if (Ii[0] < Ii[1] && Ii[0] <= Io[0] + 1e-5 && Ii[1] >= Io[1] - 1e-5) return false;
      }
      return true;
    }
    if (p.type === 2) {
      I = isect(I, slabI(al[0], d[0], dm[0])); I = isect(I, slabI(al[1], d[1], dm[1])); I = isect(I, slabI(al[2], d[2], dm[2]));
      return I[0] < I[1];
    }
    I = isect(I, ballI(al, d, dm[0]));
    return I[0] < I[1];
  }

  /* Orientation statistics of the magnetic units. */
  function langevin(x) { if (x < 1e-3) return x / 3; if (x > 20) return 1 - 1 / x; return 1 / Math.tanh(x) - 1 / x; }
  function order2(x) { // S2 = <P2(cos θ)> = 1 − 3 L(ξ)/ξ
    if (x < 0.3) { const x2 = x * x; return x2 / 15 - 2 * x2 * x2 / 315; }
    return 1 - 3 * langevin(x) / x;
  }
  function wobble(x) { return x < 1e-3 ? 1 / 3 : langevin(x) / x; } // <ψ_x²> per transverse axis
  function xiPerTesla(dmNm) { // Langevin parameter per tesla for a magnetite unit of diameter dm
    const d = dmNm * 1e-9;
    return MS_MAGNETITE * PI * d * d * d / 6 / (KB * TEMP);
  }

  /* Vector helpers */
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const len = a => Math.sqrt(dot(a, a));
  const normalize = a => { const l = len(a); return l > 0 ? scale(a, 1 / l) : [0, 0, 1]; };

  /* Direction inside the fluid (tangential wave-vector conserved through the planar glass/oil interfaces). */
  function toMedium(k, n) { const t2 = k[0] * k[0] + k[1] * k[1]; return [k[0] / n, k[1] / n, Math.sqrt(Math.max(n * n - t2, 1e-9)) / n]; }
  function transverse(a, k) {
    let v = sub(a, scale(k, dot(a, k))), l = len(v);
    if (l < 1e-5) { v = cross(k, [0, 0, 1]); l = len(v); if (l < 1e-5) { v = [1, 0, 0]; l = 1; } }
    return scale(v, 1 / l);
  }
  /* pol = {src, srcAx, ana, anaAx}; ideal polariser passes half of unpolarised light. */
  function basisIn(k, pol) {
    if (pol.src) { const e1 = transverse(pol.srcAx, k); return [[e1, 0.5]]; }
    const e1 = transverse([1, 0, 0], k); return [[e1, 0.5], [cross(k, e1), 0.5]];
  }
  /* Dipole re-radiation of a needle (α∥ = 1, α⊥ = r), detected through the analyser. Normalised to 1
     for unpolarised, near-forward light on an in-plane needle. */
  function polAligned(kin, kout, t, r, pol) {
    let s = 0;
    for (const [e, w] of basisIn(kin, pol)) {
      const p = add(scale(e, r), scale(t, (1 - r) * dot(t, e)));
      if (pol.ana) { const a = transverse(pol.anaAx, kout); const d = dot(a, p); s += w * d * d; }
      else { const q = dot(p, kout); s += w * (dot(p, p) - q * q); }
    }
    return s / (0.5 * (1 + r * r));
  }
  /* Same dipole, orientation-averaged over random needles (<t_i t_j t_k t_l> isotropic average). */
  function polRandom(kin, kout, r, pol) {
    const ar = 1 - r, K = r * r + (2 / 3) * r * ar + 2 * ar * ar / 15, c0 = ar * ar / 15;
    let s = 0;
    for (const [e, w] of basisIn(kin, pol)) {
      if (pol.ana) { const a = transverse(pol.anaAx, kout); const c = dot(a, e); s += w * (K * c * c + c0); }
      else { const q = dot(e, kout); s += w * (K * (1 - q * q) + 2 * c0); }
    }
    return s / (K + 2 * c0);
  }
  /* Intensity transmission of a uniaxial retarder (slow axis = projection of t), retardance delta,
     extra amplitude attenuation kap of the e-wave, between the current polariser/analyser. */
  function jonesT(k, t, delta, kap, pol) {
    let ee = sub(t, scale(k, dot(t, k))), le = len(ee);
    if (le < 1e-5) { ee = transverse([1, 0, 0], k); delta = 0; kap = 0; } else ee = scale(ee, 1 / le);
    const oo = cross(k, ee), te = Math.exp(-kap), cd = Math.cos(delta);
    let T = 0;
    for (const [e, w] of basisIn(k, pol)) {
      const pe = dot(ee, e), po = dot(oo, e);
      if (pol.ana) {
        const a = transverse(pol.anaAx, k), A1 = dot(a, ee) * pe, A2 = dot(a, oo) * po;
        T += w * (te * te * A1 * A1 + A2 * A2 + 2 * te * A1 * A2 * cd);
      } else T += w * (te * te * pe * pe + po * po);
    }
    return T;
  }
  function hg(mu, g) { return (1 - g * g) / (4 * PI * Math.pow(1 + g * g - 2 * g * mu, 1.5)); }

  return { PI, cel, cylB, boxB, sphB, primB, fieldAt, segHits, langevin, order2, wobble, xiPerTesla,
           dot, cross, scale, sub, add, len, normalize, toMedium, transverse, polAligned, polRandom, jonesT, hg };
})();
if (typeof module !== 'undefined') module.exports = Phys;
