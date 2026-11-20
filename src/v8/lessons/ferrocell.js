/* Nanocompass · lesson "Why does a ferrocell glow?" — the ferrocell digital twin.
 * Engine: src/v8/engines/ferrocell.js (cone scattering by field-aligned needles; edge-lit or backlit). */
(function(root){
'use strict';
const FV=root.NanoFerrocellView;
const lit=v=>({edge:'Edge-lit',back:'Lamp behind'})[v];
FV.lesson('ferrocell',{
  config:{light:'edge',leds:24,colours:'rainbow',magnet:'disc',mx:0,my:0,gap:3,eyeH:300,needleUm:50,spread:.03,Bn:15,exposure:1,lampX:0,showField:false},
  controls:c=>[
    {type:'choice',key:'light',label:'Light',options:[['edge','LEDs around the edge'],['back','Lamp behind']],hint:c.light==='edge'?'LED light travels inside the glass plates and reaches the film only where needles touch the glass.':'A small lamp 60 mm behind the cell; drag it sideways.'},
    ...(c.light==='edge'?[{type:'choice',key:'leds',label:'Number of LEDs',options:[[1,'1'],[2,'2'],[6,'6'],[24,'24']]},{type:'choice',key:'colours',label:'LED colours',options:[['white','White'],['rainbow','Rainbow']]}]:[]),
    {type:'choice',key:'magnet',label:'Magnet under the cell',options:[['disc','Disc'],['bar','Bar'],['pair','Two discs'],['ring','Ring']],hint:'Drag the dashed outline to move it.'},
    {key:'gap',label:'Magnet distance below the fluid',min:1,max:15,step:.5,unit:'mm'},
    {key:'eyeH',label:'Your eye above the cell',min:100,max:1000,log:true,step:1,unit:'mm'},
    {key:'needleUm',label:'Needle length',min:5,max:300,log:true,step:1,unit:'µm',hint:'Microscopy shows needles tens to hundreds of µm long.'},
    {key:'Bn',label:'Field at which needles form',min:5,max:100,step:1,unit:'mT'},
    {key:'exposure',label:'Brightness',min:.3,max:5,log:true,unit:'×',entry:{digits:1}},
  ],
  readouts(c,hover,fc){
    const rows=[];
    if(hover&&fc){const N=fc.N,H=FV.HALF,i=Math.min(N-1,Math.max(0,Math.floor((hover[0]+H)/(2*H)*N))),j=Math.min(N-1,Math.max(0,Math.floor((H-hover[1])/(2*H)*N))),q=3*(j*N+i),bx=fc.B[q],by=fc.B[q+1],bz=fc.B[q+2],B=Math.hypot(bx,by,bz),f=B*B/(B*B+(c.Bn/1e3)**2);
      rows.push(['Field at the pointer',(1e3*B).toFixed(0)+' mT'],['Tilt of the field out of the plane',(Math.asin(Math.min(1,Math.abs(bz)/Math.max(B,1e-12)))*180/Math.PI).toFixed(0)+'°'],['Needles formed there',Math.round(100*f)+' %']);}
    else rows.push(['Field','Point at the cell to read the field there']);
    rows.push(['Bright points','where the light cone of the local needles passes through your eye','pv-note']);
    return rows;
  },
  caption:c=>(c.light==='edge'?(c.leds===1?'One LED':c.leds+' LEDs')+' around the edge':'Lamp 60 mm behind the cell')+', eye '+c.eyeH.toFixed(0)+' mm above the centre. Drag the magnet'+(c.light==='back'?' or the lamp':'')+'. Click any point to see what happens there. Brightness is relative.',
  guide:{
    lecture:{
      aim:'A ferrocell is a thin film of diluted ferrofluid between two glass plates. Near a magnet it shows bright curves that look like field lines. Find out how they are made.',
      read:'This is a digital twin: what your eye sees, seen from above. The dashed outline is the magnet under the cell, the coloured dots are LEDs around the edge. In a field the fluid forms microscopic needles along the field. Each needle sends light only into a cone around its own axis. A point of the cell lights up when the cone from its needles, lit by an LED, passes through your eye.',
      tasks:[
        {text:'First idea: is the light bent by the fluid (magneto-birefringence)? Its strength Δn is at most about 0.001, which bends light by a few hundredths of a degree over 1 cm; and 1 cm of this fluid is opaque. So the light cannot be travelling along the film. Keep this in mind.'},
        {text:'One LED and a disc magnet in the centre. Where is the bright curve? Switch on the field direction: how do the curve and the field lines meet?',set:{light:'edge',leds:1,colours:'white',magnet:'disc',mx:0,my:0,showField:true}},
        {text:'Add a second LED, then all 24. Each LED draws its own curve.',set:{leds:24,colours:'rainbow'}},
        {text:'Drag the magnet around. Try the bar magnet and the two discs.',set:{magnet:'bar'}},
        {text:'Make the needles short (10 µm) and then long (200 µm). What happens to the lines, and why?',set:{needleUm:10}},
        {text:'Move your eye closer (150 mm). The pattern depends on where you look from: the curves are not drawn in the fluid.',set:{eyeH:150}},
        {text:'Light the cell from behind with a lamp and drag the lamp sideways.',set:{light:'back',lampX:-20}},
        {text:'Click a bright point and a dark point. In the 3D view, compare where the cone of scattered light goes and where your eye is. Move the point with the arrow keys and watch the cone swing past your eye.'},
      ],
      check:'Two students look at the same ferrocell from different positions. Do they see the same bright curves?',
      answer:'No. A point is bright when the cone of its needles passes through the eye, so changing the eye position changes which points are bright. The curves are not field lines drawn in the fluid; they show where the needle direction satisfies the cone condition for that lamp and that eye.'},
    research:{
      aim:'Single scattering by field-aligned needle aggregates with the Keller-cone condition (k_out − k_in)·t = 0, for edge-lit light guided in the glass (evanescent coupling, in-plane β between n_fluid and n_glass) and for backlit light crossing the film.',
      read:'Needle direction t = B/|B| from exact fields of the magnet; needle number ∝ B²/(B² + B_n²). The cone is broadened by the finite needle length (σ_L = 0.39λ/(nL)) and an orientation spread of 0.03 rad. Absorption: stock EFH1 860 cm⁻¹ at 532 nm (Lin et al. 2021), halved by 1:1 dilution, 10 µm film. Edge-lit power decays as exp(−r/25 mm)/r in the plates; the decay length is assumed. Intensities are relative because needle sizes, density and coupling are not measured for a specific cell.',
      tasks:[
        {text:'For a purely radial in-plane field and one edge LED, with the eye far above, the bright curve is the circle with the LED and the field centre at the ends of a diameter (Thales circle: light direction ⟂ radial needles). Over a real disc magnet the field also tilts out of the plane: how does that deform the circle?',set:{light:'edge',leds:1,colours:'white',magnet:'disc',mx:0,my:0,eyeH:1000}},
        {text:'Where the field turns out of the plane (above the magnet pole), how does the out-of-plane needle component change the condition?',set:{magnet:'disc',gap:1.5}},
        {text:'Compare edge-lit and backlit patterns for the same magnet: which terms of the cone condition change?',set:{light:'back',lampX:0}},
      ],
      physics:'Cone condition: t·k<sub>out</sub> = t·k<sub>in</sub>. Edge-lit: k<sub>in</sub> = βû with û the in-plane direction from the LED; with a distant eye (k<sub>out</sub> ≈ n ẑ) and in-plane needles it reduces to û·t = 0, so the bright curve crosses the in-plane field at right angles. Magneto-birefringence: deflection ≈ (Δn/n)(L/ℓ) ≲ 10<sup>−3</sup> rad. Tufaile, Snyder &amp; Tufaile, Condens. Matter 6, 30 (2021); Lin et al., Mater. Today 51, 48 (2021).',
      check:'Why can the light not reach the centre of an edge-lit cell by travelling in the ferrofluid film?',
      answer:'Diluted EFH1 absorbs about 4×10⁴ m⁻¹ at 532 nm: the 1/e length is about 25 µm, so after 1 cm nothing is left. Light reaches the centre inside the glass plates, guided by total internal reflection, and couples to needles touching the glass through the evanescent field.'},
  },
});
})(typeof globalThis!=='undefined'?globalThis:this);
