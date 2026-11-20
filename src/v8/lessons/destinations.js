/* Nanocompass · Theory: the relations behind each lesson, with links back. */
(function(root){
'use strict';
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;};
root.NanoLessonViews=root.NanoLessonViews||{};

/* ---------------- Theory ---------------- */
const T=[
 {id:'neel',title:'Néel and Brown relaxation',lesson:'particle',html:`
  <p>A single-domain particle with uniaxial anisotropy K and volume V has two stable directions along its easy axis, separated by an energy barrier KV. Thermal energy k<sub>B</sub>T lets the moment jump over the barrier (Néel relaxation). In a liquid the whole particle can also turn (Brown relaxation).</p>
  <div class="eq">τ<sub>N</sub> = τ<sub>0</sub> exp(KV / k<sub>B</sub>T), τ<sub>0</sub> ≈ 10<sup>−9</sup> s</div>
  <div class="eq">τ<sub>B</sub> = 3ηV<sub>h</sub> / (k<sub>B</sub>T) = πηd<sub>h</sub><sup>3</sup> / (2k<sub>B</sub>T)</div>
  <div class="eq">1/τ = 1/τ<sub>N</sub> + 1/τ<sub>B</sub></div>
  <p>A field B along the easy axis changes the barriers to KV(1 ± B/B<sub>K</sub>)², with the anisotropy field B<sub>K</sub> = 2K/M<sub>s</sub>. The app uses the field component along each particle's easy axis, so flips obey detailed balance.</p>`},
 {id:'blocking',title:'Blocking and the measuring time',lesson:'magnetometer',html:`
  <p>A particle looks <i>superparamagnetic</i> when it relaxes faster than the measurement lasts, and <i>blocked</i> when it does not. Setting τ = t<sub>m</sub> gives the blocking temperature:</p>
  <div class="eq">T<sub>B</sub> = KV / (k<sub>B</sub> ln(t<sub>m</sub>/τ<sub>0</sub>))</div>
  <p>For a magnetometer (t<sub>m</sub> ≈ 10–100 s) ln(t<sub>m</sub>/τ<sub>0</sub>) ≈ 23–25. For AC susceptibility t<sub>m</sub> = 1/(2πf), so T<sub>B</sub> rises with frequency. Because KV ∝ d³, a size distribution gives a wide distribution of T<sub>B</sub>. Anisotropy also differs from particle to particle, which widens it further.</p>`},
 {id:'langevin',title:'Superparamagnetic magnetisation',lesson:'fluid',html:`
  <p>In thermal equilibrium each moment μ = M<sub>s</sub>V is distributed according to its Zeeman energy −μB cos θ compared with k<sub>B</sub>T:</p>
  <div class="eq">M/M<sub>s</sub> = L(α) = coth α − 1/α, α = μB/(k<sub>B</sub>T) (free rotation in 3D)</div>
  <div class="eq">M/M<sub>s</sub> = I<sub>1</sub>(α)/I<sub>0</sub>(α) (rotation in a plane, as in the particle lessons)</div>
  <div class="eq">χ<sub>0</sub> = nμ²/(3k<sub>B</sub>T) (Curie law)</div>
  <p>Strongly anisotropic, blocked-axis particles in a solid follow an Ising-like law instead, ⟨cos ψ tanh(α cos ψ)⟩. This gives the same initial susceptibility for random axes.</p>`},
 {id:'loops',title:'Hysteresis: Stoner–Wohlfarth and thermal activation',lesson:'magnetometer',html:`
  <p>At T = 0 a particle switches only when the field removes the barrier. For an easy axis at angle ψ to the field the energy is</p>
  <div class="eq">E/KV = sin²θ − 2h cos(θ − ψ), h = M<sub>s</sub>B/(2K)</div>
  <p>For random 3D axes this gives H<sub>c</sub> = 0.479 H<sub>K</sub> and M<sub>r</sub> = M<sub>s</sub>/2. At finite temperature, thermal activation lowers the coercivity, and a slower sweep lowers it further:</p>
  <div class="eq">H<sub>c</sub>(T) ≈ H<sub>c</sub>(0)[1 − (T/T<sub>B</sub>)<sup>n</sup>], n ≈ 1/2 (aligned) to 3/4 (random)</div>`},
 {id:'zfc',title:'ZFC/FC and AC susceptibility',lesson:'magnetometer',html:`
  <p><b>ZFC:</b> cool without a field, switch on a small field at low temperature, then measure while warming. Blocked particles stay frozen in random directions until they unblock, so M<sub>ZFC</sub> rises, peaks near the typical T<sub>B</sub> and then follows the Curie law. <b>FC:</b> cool in the same field and measure while warming. M<sub>FC</sub> lies above ZFC below the bifurcation temperature T<sub>irr</sub>, where the particles with the largest barriers block.</p>
  <div class="eq">χ(ω) = Σ χ<sub>0,i</sub> / (1 + iωτ<sub>i</sub>); χ″ maximal at ωτ = 1</div>
  <p>A plot of ln f against 1/T<sub>peak</sub> (Néel–Arrhenius) has slope −KV/k<sub>B</sub> and intercept ln(1/(2πτ<sub>0</sub>)).</p>`},
 {id:'mps',title:'Magnetic particle spectroscopy (MPS)',lesson:'magnetometer',html:`
  <p>A zero-bias sinusoidal field can drive magnetic particles into the nonlinear part of their magnetisation curve. With half-cycle antisymmetry the steady moment contains only odd harmonics. In the ideal pickup coil the particle-induced voltage is proportional to −dm/dt, so the nth voltage amplitude is proportional to nω times the nth moment amplitude.</p>
  <div class="eq">τ<sub>i</sub> dm<sub>i</sub>/dt + m<sub>i</sub> = L(μ<sub>i</sub>B(t)/k<sub>B</sub>T), &nbsp; B(t) = B<sub>peak</sub> sin(ωt)</div>
  <p>Here m<sub>i</sub> is the reduced moment of population i. The lesson uses two independent populations with constant effective relaxation times and adds their harmonic coefficients with magnetic core volume weights. Normalizing the voltage spectrum removes an overall loading factor. Compare samples at matched field, frequency and temperature. For the constant-time approximation see <a href="https://doi.org/10.1063/1.4935158" target="_blank" rel="noopener">Dhavalikar et al. (2015)</a>.</p>
  <p><a href="https://doi.org/10.1002/smll.202101588" target="_blank" rel="noopener">Müssig et al. (2021)</a> tailor magnetic fingerprints by controlling the composition of supraparticles. Their separate <a href="https://doi.org/10.18416/IJMPI.2020.2009003" target="_blank" rel="noopener">packing and surface study</a> shows why an independent-particle mixture cannot predict every fingerprint: changing the assembly can change the measured spectrum even with the same magnetic building blocks.</p>`},
 {id:'dipolar',title:'Dipolar coupling and chains',lesson:'chains',html:`
  <div class="eq">λ = μ<sub>0</sub>μ² / (4π d<sub>h</sub><sup>3</sup> k<sub>B</sub>T)</div>
  <p>Two touching particles head to tail have energy −2λk<sub>B</sub>T; side by side and parallel, +λk<sub>B</sub>T. Chains form in zero field for λ above about 3–4; commercial ferrofluids have λ ≈ 1. A coating of thickness δ raises d<sub>h</sub> = d + 2δ and lowers λ as (d + 2δ)<sup>−3</sup>.</p>`},

 {id:'ferrocell',title:'The ferrocell: light cones from needles',lesson:'ferrocell',html:`
  <p>In a field the diluted fluid forms needles along <b>t</b> = <b>B</b>/|<b>B</b>|. A long thin scatterer keeps the wave-vector component along its axis, so it sends light only into a cone around the axis (Keller cone):</p>
  <div class="eq">(<b>k</b><sub>out</sub> − <b>k</b><sub>in</sub>) · <b>t</b> = 0</div>
  <p>A point of the cell is bright when that cone passes through the eye. Edge-lit light travels in the glass plates, because the fluid absorbs strongly (about 4 × 10<sup>4</sup> m<sup>−1</sup> at 532 nm for 1:1 diluted EFH1). It reaches the needles through the evanescent field of the totally reflected light. That field decays within about 0.3 µm normal to the glass, but its phase travels along the glass, so needles touching the glass are illuminated with in-plane <b>k</b><sub>in</sub> = β<b>û</b>, n<sub>fluid</sub> &lt; β &lt; n<sub>glass</sub>. With a distant eye and in-plane needles the condition becomes <b>û</b> · <b>t</b> = 0, so the bright curves cross the field at right angles. The cone width is about 0.39λ/(nL) for needle length L. Magneto-birefringence (Δn ≲ 10<sup>−3</sup>) bends light by less than 0.1° and cannot make the pattern.</p>`},];
root.NanoLessonViews.theory={
  mount({stage,controls,guide}){
    stage.classList.add('dest-stage','theory-stage');stage.textContent='';
    const body=el('div','theory-body');stage.append(body);
    for(const t of T){const sec=el('section','theory-sec');sec.id='th-'+t.id;const h=el('h2','',t.title);const a=el('a','theory-link','Open the lesson →');a.href='#'+t.lesson;h.append(' ',a);sec.append(h);const d=el('div');d.innerHTML=t.html;sec.append(d);body.append(sec);}
    controls.innerHTML='';const nav=el('ol','theory-nav');for(const t of T){const li=el('li'),a=el('a','',t.title);a.href='#theory';a.onclick=e=>{e.preventDefault();document.getElementById('th-'+t.id).scrollIntoView({behavior:'smooth',block:'start'});};li.append(a);nav.append(li);}controls.append(nav);
    guide.innerHTML='<ul class="dest-list"><li>R. E. Rosensweig, <i>Ferrohydrodynamics</i> (Cambridge, 1985).</li><li>L. Néel, Ann. Géophys. 5, 99 (1949); W. F. Brown, Phys. Rev. 130, 1677 (1963).</li><li>E. C. Stoner, E. P. Wohlfarth, Phil. Trans. R. Soc. A 240, 599 (1948).</li><li>A. Tufaile, M. Snyder, A. P. B. Tufaile, Condens. Matter 6, 30 (2021), <a href="https://doi.org/10.3390/condmat6030030" target="_blank" rel="noopener">doi</a> (horocycles, needles, conical diffraction).</li><li>F. Lin et al., Mater. Today 51, 48 (2021), <a href="https://doi.org/10.1016/j.mattod.2021.10.022" target="_blank" rel="noopener">doi</a> (EFH1 absorption).</li></ul>';
  },
  unmount(){}
};
})(typeof globalThis!=='undefined'?globalThis:this);
