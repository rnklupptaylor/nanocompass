'use strict';
/* Nanocompass v8.0 · ferrocell digital twin.
 *
 * Principle (Tufaile, Snyder & Tufaile, Condens. Matter 6, 30 (2021)): in a field above a few tens of mT the
 * diluted ferrofluid film (about 10 µm thick) forms needle-like aggregates along the field, tens to hundreds of
 * µm long and a few µm wide. A long thin scatterer redirects light only onto a cone around its own axis:
 * the component of the wave vector along the needle is conserved,
 *        (k_out − k_in) · t = 0          (Keller cone; t = needle direction).
 * An observer therefore sees light from those points of the cell where the cone of the local needle, lit by a
 * given source, passes through the eye. The bright curves are the set of such points, not light paths.
 *
 * Light reaching the needles
 *  - Edge-lit (LEDs around the cell): the fluid absorbs strongly (EFH1 ≈ 860 cm⁻¹ at 532 nm; Lin et al. 2021),
 *    so light cannot travel along the film. It travels in the glass plates. Rays steeper than the critical
 *    angle at the glass–fluid interface enter the film near the edge and are absorbed; grazing rays are totally
 *    reflected (n_glass 1.52 > n_fluid ≈ 1.47) and reach the film only through the evanescent field, where
 *    needles touching the glass scatter them. Their in-plane wave vector is β·u with n_fluid ≤ β ≤ n_glass,
 *    u the in-plane direction from the LED. Power falls as exp(−r/ℓ)/r (spreading in a slab; ℓ: guide loss).
 *  - Backlit (lamp behind the cell): light crosses the film once; k_in follows from refraction
 *    (tangential component conserved), attenuated by exp(−α d / k_z).
 * The outgoing wave travels to the eye; its tangential component equals that of the ray in air.
 *
 * Needles: direction t = B/|B| (3D). Their number grows with field, f(B) = B²/(B² + B_n²) with B_n set by the
 * user (formation reported over 20–100 mT). The cone is broadened by the finite needle length,
 * σ_L = 0.39 λ/(n L) (sinc² main lobe), and by orientation spread σ_t: σ² = σ_L² + σ_t² |Δk_⊥|².
 * Intensities are relative: needle sizes, density and coupling are not measured for a given cell.
 * Lengths in mm (geometry) unless stated; fields in tesla. */
(function(root){
const P=typeof Phys!=='undefined'?Phys:root.Phys||(typeof require!=='undefined'?require('./magnet-fields.js'):null); // Phys is a global const of magnet-fields.js
const N_GLASS=1.52,N_FLUID=1.47;
const CH=[{name:'R',lam:630,alpha:2.25e4},{name:'G',lam:530,alpha:8.6e4},{name:'B',lam:460,alpha:1.1e5}]; // α of stock EFH1 (m⁻¹), Lin et al. 2021

/* Magnet presets placed under the cell (z < 0); Br in tesla, sizes in mm. */
function magnets(spec){
  const out=[],Br=spec.Br??1.3,g=spec.gap??3;
  const disc=(x,y,up,D=12,H=6)=>({type:0,c:[x,y,-(g+H/2)],e0:[1,0,0],e1:[0,up?1:-1,0],e2:[0,0,up?1:-1],dims:[D/2,0,H/2,0],Br});
  if(spec.kind==='disc')out.push(disc(spec.x,spec.y,true));
  else if(spec.kind==='bar')out.push({type:2,c:[spec.x,spec.y,-(g+2.5)],e0:[0,1,0],e1:[0,0,1],e2:[1,0,0],dims:[10,4,2.5,0],Br}); // 20 × 8 × 5 mm, magnetised along x
  else if(spec.kind==='pair'){out.push(disc(spec.x-9,spec.y,true));out.push(disc(spec.x+9,spec.y,false));}
  else if(spec.kind==='ring')out.push({type:1,c:[spec.x,spec.y,-(g+3)],e0:[1,0,0],e1:[0,1,0],e2:[0,0,1],dims:[12,5,3,0],Br});
  return out;
}
function ledRing(n,R,colours){
  const pal=colours==='rainbow'?[[1,.15,.1],[1,.6,0],[.95,.95,.1],[.2,1,.2],[.1,.7,1],[.25,.3,1],[.8,.2,1]]:[[1,1,1]];
  return Array.from({length:n},(_,i)=>{const a=2*Math.PI*i/n-Math.PI/2;return {x:R*Math.cos(a),y:R*Math.sin(a),rgb:pal[i%pal.length]};});
}
/* Field and needle state on an N × N grid over the cell (half-size h mm). */
function fieldGrid(prims,N,h){
  const B=new Float32Array(N*N*3);for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=-h+2*h*(i+.5)/N,y=h-2*h*(j+.5)/N,b=P.fieldAt(prims,x,y,0);B.set(b,3*(j*N+i));}
  return B;
}
/* Render the observer's view of the cell. Returns Float32Array RGB (linear, relative). */
function render(o){
  const N=o.N,h=o.half,cellR=o.cellR,eye=[o.eyeX??0,o.eyeY??0,o.eyeH],L=o.needleUm,sigT=o.orientSpread,Bn=o.Bn,film=o.filmUm*1e-6,dil=o.dilution??.5;
  const B=o.B||fieldGrid(o.prims,N,h),img=new Float32Array(N*N*3),leds=o.leds,beta=.5*(N_GLASS+N_FLUID),ell=o.guideLossMm??25;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const x=-h+2*h*(i+.5)/N,y=h-2*h*(j+.5)/N;if(Math.hypot(x,y)>cellR)continue;
    const q=3*(j*N+i),bx=B[q],by=B[q+1],bz=B[q+2],Bm=Math.hypot(bx,by,bz);if(!(Bm>1e-6))continue;
    const t=[bx/Bm,by/Bm,bz/Bm],dens=Bm*Bm/(Bm*Bm+Bn*Bn);
    // outgoing wave towards the eye, inside the fluid (tangential component conserved)
    const dx=eye[0]-x,dy=eye[1]-y,dz=eye[2],dl=Math.hypot(dx,dy,dz),ox=dx/dl,oy=dy/dl,kout=[ox,oy,Math.sqrt(Math.max(N_FLUID*N_FLUID-ox*ox-oy*oy,1e-9))];
    let r=0,g=0,b=0;
    if(o.mode==='edge'){
      for(const s of leds){const ux=x-s.x,uy=y-s.y,d=Math.hypot(ux,uy);if(d<1e-6)continue;
        const kin=[beta*ux/d,beta*uy/d,0],dk=[kout[0]-kin[0],kout[1]-kin[1],kout[2]-kin[2]],D=dk[0]*t[0]+dk[1]*t[1]+dk[2]*t[2];
        const perp2=Math.max(dk[0]*dk[0]+dk[1]*dk[1]+dk[2]*dk[2]-D*D,0),power=Math.exp(-d/ell)/Math.max(d,1);
        for(let c=0;c<3;c++){if(!s.rgb[c])continue;const sl=.39*CH[c].lam*1e-3/(N_FLUID*L),sig2=sl*sl+sigT*sigT*perp2;
          const v=s.rgb[c]*power*Math.exp(-.5*D*D/sig2)/Math.sqrt(2*Math.PI*sig2);if(c===0)r+=v;else if(c===1)g+=v;else b+=v;}}
    }else{
      const lamp=o.lamp,lx=x-lamp.x,ly=y-lamp.y,lz=lamp.h,ld=Math.hypot(lx,ly,lz),ax=lx/ld,ay=ly/ld,kin=[ax,ay,Math.sqrt(Math.max(N_FLUID*N_FLUID-ax*ax-ay*ay,1e-9))];
      const dk=[kout[0]-kin[0],kout[1]-kin[1],kout[2]-kin[2]],D=dk[0]*t[0]+dk[1]*t[1]+dk[2]*t[2],perp2=Math.max(dk[0]*dk[0]+dk[1]*dk[1]+dk[2]*dk[2]-D*D,0);
      const power=(lz/ld)/(ld*ld)*1e4;
      for(let c=0;c<3;c++){const sl=.39*CH[c].lam*1e-3/(N_FLUID*L),sig2=sl*sl+sigT*sigT*perp2,tr=Math.exp(-CH[c].alpha*dil*film/kin[2]*N_FLUID);
        const v=power*tr*Math.exp(-.5*D*D/sig2)/Math.sqrt(2*Math.PI*sig2);if(c===0)r+=v;else if(c===1)g+=v;else b+=v;}
    }
    // light leaving towards the eye crosses part of the film
    const out=CH.map(ch=>Math.exp(-ch.alpha*dil*film*.5/(kout[2]/N_FLUID)));
    img[q]=dens*r*out[0];img[q+1]=dens*g*out[1];img[q+2]=dens*b*out[2];
  }
  return img;
}
const api={render,fieldGrid,magnets,ledRing,N_GLASS,N_FLUID,CH};
root.NanoFerrocell=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
