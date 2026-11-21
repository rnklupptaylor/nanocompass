/* Nanocompass v8.0 · lesson catalogue. Order, questions and slogans agreed with Robin on 14 November 2026; "In the magnetometer" added at his request the same day; lesson 04 rebuilt around the ferrocell and the research-question lessons removed (14 November 2026).
 * engine: which module runs the lesson (planar = src/v8/engines/planar.js, layer = layer.js models). */
(function(root){
'use strict';
const LESSONS=[
  {id:'particle',num:'00',name:'One particle',accent:'#c4473a',engine:'planar',
   question:'Why does a nanoparticle forget which way it points?',
   slogan:'Hear a moment flip. Watch it forget.',
   research:'Néel and Brown relaxation, the energy barrier KV and the blocking condition: relaxation slower than the measurement.'},
  {id:'fluid',num:'01',name:'Ferrofluid in a field',accent:'#2a78d6',engine:'planar',
   question:'Why is a ferrofluid magnetic only while a magnet is near?',
   slogan:'Switch the field on. Watch the gauge follow.',
   research:'Langevin magnetisation, Zeeman energy μB against k_BT, and the rigid-matrix (blocked) contrast.'},
  {id:'magnetometer',num:'02',name:'Magnetic measurements',accent:'#c0882a',engine:'magnetometer',
   question:'What does a magnetic measurement tell you about the particles?',
   slogan:'Open a loop, find the χ″ peak or read a magnetic fingerprint.',
   research:'M(H) loops, ZFC/FC and AC susceptibility of a size-distributed ensemble, plus magnetic particle spectroscopy of a two-population mixture.'},
  {id:'chains',num:'03',name:'Chains',accent:'#1b9e6f',engine:'planar',
   question:'When do particles line up head to tail?',
   slogan:'Strengthen the coupling. See chains form and fall apart.',
   research:'Dipolar coupling λ, steric coating, head-to-tail energy −2λ k_BT and cluster statistics.'},
  {id:'ferrocell',num:'04',name:'The ferrocell',accent:'#8b5fbf',engine:'ferrocell',
   question:'Why does a ferrocell glow in lines around a magnet?',
   slogan:'Light the edge. Move the magnet. Read the light cones.',
   research:'Conical (Keller-cone) scattering by field-aligned needle aggregates; edge-lit light guided in the glass; absorption of the film.'},
];
const EXTRA=[];
const DESTINATIONS=[
  {id:'lab',num:'Lab',name:'Lab',accent:'#5b6b7d',
   slogan:'Every control and more measurements. Explore freely.'},
  {id:'theory',num:'Σ',name:'Theory',accent:'#617d9f',
   slogan:'Connect every view to the equations behind it.'},
];
/* Plain-text notation helper: k_BT → k<sub>B</sub>T, U_HT → U<sub>HT</sub>. Escapes HTML first. */
const sub=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/_(HT|[A-Za-z0-9])/g,'<sub>$1</sub>');
root.NanoLessons={LESSONS,DESTINATIONS,EXTRA,sub,all:[...LESSONS,...DESTINATIONS],byId:id=>[...LESSONS,...DESTINATIONS,...EXTRA].find(l=>l.id===id)};
})(typeof globalThis!=='undefined'?globalThis:this);
