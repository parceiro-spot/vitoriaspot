/* Ilustrações de veículos (vista lateral, estilo catálogo) para o Registro de Sinistro.
   Uso: SpotVehicleArt(tipo) -> data URI SVG. Tipos: VUC, VAN, 3/4, TOCO, TRUCK, CARRETA, MOTO, KWID/CARRO. */
(function(){
  'use strict';
  const GROUND=360;
  const defs=`<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8faf7"/><stop offset="1" stop-color="#e8ede6"/></linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe5dc"/><stop offset="1" stop-color="#eef2ec"/></linearGradient>
<linearGradient id="box" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".65" stop-color="#eef1ed"/><stop offset="1" stop-color="#d5dbd3"/></linearGradient>
<linearGradient id="cab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#eceeea"/><stop offset="1" stop-color="#cfd5cd"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f4658"/><stop offset=".55" stop-color="#5f7e93"/><stop offset="1" stop-color="#a9c2d1"/></linearGradient>
<radialGradient id="rim" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#eef1ec"/><stop offset=".6" stop-color="#b4bcb2"/><stop offset="1" stop-color="#7f887c"/></radialGradient>
<linearGradient id="green" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5f9f1d"/><stop offset="1" stop-color="#8bc53f"/></linearGradient>
<radialGradient id="shadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#1b241a" stop-opacity=".38"/><stop offset="1" stop-color="#1b241a" stop-opacity="0"/></radialGradient>
</defs>`;
  const OUT='#aeb7ab';

  function wheel(cx,r,dual){
    const cy=GROUND-r;
    const one=(x)=>`<circle cx="${x}" cy="${cy}" r="${r}" fill="#171b17"/><circle cx="${x}" cy="${cy}" r="${r*.88}" fill="#252a25"/><circle cx="${x}" cy="${cy}" r="${r*.6}" fill="url(#rim)" stroke="#6c756a" stroke-width="2"/><circle cx="${x}" cy="${cy}" r="${r*.27}" fill="#d9ded7" stroke="#7b8478" stroke-width="2"/>${[0,72,144,216,288].map(a=>`<circle cx="${(x+Math.cos(a*Math.PI/180)*r*.4).toFixed(1)}" cy="${(cy+Math.sin(a*Math.PI/180)*r*.4).toFixed(1)}" r="${(r*.045).toFixed(1)}" fill="#5c655a"/>`).join('')}`;
    return `<circle cx="${cx}" cy="${cy}" r="${r+9}" fill="#1d221d"/>`+one(cx)+(dual?`<circle cx="${cx+9}" cy="${cy}" r="${r}" fill="none" stroke="#0f130f" stroke-width="2" opacity=".5"/>`:'');
  }

  function ribs(x,w,top,bottom,step){let s='';for(let i=x+step;i<x+w-6;i+=step)s+=`<line x1="${i}" y1="${top+6}" x2="${i}" y2="${bottom-6}" stroke="#c5cbc3" stroke-width="2"/>`;return s;}

  function cabShape(x0,w,top){
    const h=GROUND-0-(GROUND-285)-top; // altura até o chassi (285)
    const y=(k)=>(top+h*k).toFixed(1), x=(k)=>(x0+w*k).toFixed(1);
    const body=`<path d="M${x0} 285V${top+18}Q${x0} ${top} ${x0+18} ${top}H${x(.6)}L${x(.84)} ${y(.46)}L${x(1)} ${y(.56)}V268Q${x(1)} 285 ${x0+w-16} 285Z" fill="url(#cab)" stroke="${OUT}" stroke-width="3"/>`;
    const win=`<path d="M${x(.14)} ${y(.12)}H${x(.55)}L${x(.76)} ${y(.44)}H${x(.14)}Z" fill="url(#glass)" stroke="#3a4a55" stroke-width="3"/>`;
    const door=`<path d="M${x(.12)} ${y(.08)}V280" stroke="#c0c7bd" stroke-width="2" fill="none"/><rect x="${x(.66)}" y="${y(.52)}" width="${(w*.08).toFixed(1)}" height="5" rx="2" fill="#9aa497"/>`;
    const mirror=`<rect x="${x(.8)}" y="${y(.22)}" width="${(w*.06).toFixed(1)}" height="${(h*.2).toFixed(1)}" rx="3" fill="#2b332b"/>`;
    const lamp=`<rect x="${x(.93)}" y="${y(.62)}" width="${(w*.1).toFixed(1)}" height="16" rx="5" fill="#fff7d6" stroke="#b9ad7a" stroke-width="2"/>`;
    const bumper=`<rect x="${x(.88)}" y="262" width="${(w*.16).toFixed(1)}" height="24" rx="5" fill="#2a312a"/>`;
    return body+win+door+mirror+lamp+bumper;
  }

  /* caminhão rígido com baú */
  function rigid(o){
    const {boxX,boxW,top,cabW,cabTop,axles,r,dualRear,stripe=true}=o;
    const cabX=boxX+boxW+6, end=cabX+cabW;
    let s=`<rect x="${boxX}" y="285" width="${end-boxX-8}" height="14" rx="4" fill="#2b312b"/>`;
    s+=`<rect x="${boxX}" y="${top}" width="${boxW}" height="${285-top}" rx="8" fill="url(#box)" stroke="${OUT}" stroke-width="3"/>`;
    s+=ribs(boxX,boxW,top,285,34);
    if(stripe)s+=`<rect x="${boxX+3}" y="${285-34}" width="${boxW-6}" height="12" fill="url(#green)"/><rect x="${boxX+3}" y="${285-18}" width="${boxW-6}" height="3" fill="#2c4a17" opacity=".55"/>`;
    s+=`<rect x="${boxX-4}" y="${top+8}" width="8" height="${285-top-16}" rx="3" fill="#cfd5cc" stroke="${OUT}"/>`;
    s+=`<circle cx="${boxX+14}" cy="${top+14}" r="4" fill="#d9442d"/><circle cx="${boxX+boxW-12}" cy="${top+14}" r="4" fill="#e9a21f"/>`;
    s+=cabShape(cabX,cabW,cabTop);
    s+=axles.map((a,i)=>wheel(a,r,dualRear&&i>0&&a<boxX+boxW-20)).join('');
    return {svg:s,min:boxX-4,max:end+4};
  }

  function van(){
    const body=`<path d="M170 290V175Q170 122 222 118H520Q565 120 592 150L655 216Q684 238 688 268V290Z" fill="url(#box)" stroke="${OUT}" stroke-width="3"/>`+
      `<path d="M485 132H530Q552 134 568 152L612 205H485Z" fill="url(#glass)" stroke="#3a4a55" stroke-width="3"/>`+
      `<path d="M478 128V282" stroke="#c0c7bd" stroke-width="2"/><rect x="170" y="252" width="518" height="12" fill="url(#green)"/>`+
      `<rect x="590" y="262" width="104" height="26" rx="6" fill="#2a312a"/><rect x="650" y="226" width="40" height="16" rx="5" fill="#fff7d6" stroke="#b9ad7a" stroke-width="2"/>`+
      `<rect x="168" y="178" width="6" height="96" rx="3" fill="#cfd5cc"/><circle cx="182" cy="170" r="4" fill="#d9442d"/>`+
      `<rect x="172" y="284" width="516" height="12" rx="4" fill="#2b312b"/>`;
    return {svg:body+wheel(268,40)+wheel(590,40),min:166,max:694};
  }

  function car(){
    const body=`<path d="M200 292V248Q200 222 232 216L300 208Q338 148 400 142H500Q548 144 575 190L618 212Q668 224 676 256V292Z" fill="url(#cab)" stroke="${OUT}" stroke-width="3"/>`+
      `<path d="M322 205Q350 160 402 156H455V205Z" fill="url(#glass)" stroke="#3a4a55" stroke-width="3"/><path d="M470 156H500Q536 158 558 196H470Z" fill="url(#glass)" stroke="#3a4a55" stroke-width="3"/>`+
      `<path d="M463 156V285" stroke="#c0c7bd" stroke-width="2"/><rect x="214" y="262" width="454" height="9" fill="url(#green)"/>`+
      `<rect x="636" y="236" width="34" height="15" rx="5" fill="#fff7d6" stroke="#b9ad7a" stroke-width="2"/><rect x="200" y="238" width="14" height="22" rx="4" fill="#d9442d"/>`+
      `<rect x="640" y="268" width="38" height="22" rx="6" fill="#2a312a"/>`;
    return {svg:body+wheel(300,38)+wheel(588,38),min:196,max:680};
  }

  function moto(){
    const w=(cx,cy,r)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#171b17"/><circle cx="${cx}" cy="${cy}" r="${r*.62}" fill="url(#rim)" stroke="#6c756a" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${r*.2}" fill="#d9ded7" stroke="#7b8478" stroke-width="2"/>`;
    const s=`<ellipse cx="450" cy="${GROUND}" rx="260" ry="12" fill="url(#shadow)"/>`+
      `<rect x="130" y="108" width="170" height="130" rx="14" fill="url(#box)" stroke="${OUT}" stroke-width="3"/><rect x="134" y="190" width="162" height="14" fill="url(#green)"/><path d="M148 118V228M214 118V228" stroke="#c5cbc3" stroke-width="2"/>`+
      `<rect x="150" y="238" width="150" height="10" rx="4" fill="#2b312b"/>`+
      w(230,308,52)+w(640,308,52)+
      `<path d="M230 308L330 230H470L560 308" stroke="#2b332b" stroke-width="12" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`+
      `<path d="M330 230Q360 190 430 188H500L548 218Q566 232 556 250L520 262H350Q320 258 330 230Z" fill="#dfe4dc" stroke="${OUT}" stroke-width="3"/>`+
      `<path d="M318 226H410Q430 224 438 238L430 252H318Q300 240 318 226Z" fill="#1f251f"/>`+
      `<path d="M556 214L640 308" stroke="#9aa497" stroke-width="10" stroke-linecap="round"/><path d="M560 196L604 168H636" stroke="#2b332b" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`+
      `<rect x="590" y="214" width="34" height="22" rx="8" fill="#fff7d6" stroke="#b9ad7a" stroke-width="2"/>`+
      `<rect x="404" y="274" width="104" height="42" rx="10" fill="#3a423a"/><path d="M180 312H128" stroke="#2b332b" stroke-width="10" stroke-linecap="round"/>`;
    return {svg:s,min:120,max:700,noShadow:true};
  }

  function build(type){
    const t=String(type||'VUC').toUpperCase().trim();
    const key=t.includes('KWID')||t.includes('CARRO')||t.includes('PASSEIO')?'CAR':t.includes('MOTO')?'MOTO':t.includes('CARRETA')||t.includes('BITREM')?'CARRETA':t.includes('TRUCK')?'TRUCK':t.includes('TOCO')?'TOCO':t.includes('3/4')?'TRES':t.includes('VAN')?'VAN':'VUC';
    switch(key){
      case 'VAN':return van();
      case 'CAR':return car();
      case 'MOTO':return moto();
      case 'TRES':return rigid({boxX:100,boxW:430,top:92,cabW:138,cabTop:132,axles:[210,590],r:44,dualRear:true});
      case 'TOCO':return rigid({boxX:70,boxW:490,top:86,cabW:140,cabTop:128,axles:[200,640],r:46,dualRear:true});
      case 'TRUCK':return rigid({boxX:50,boxW:560,top:84,cabW:142,cabTop:126,axles:[150,235,690],r:46,dualRear:false});
      case 'CARRETA':{
        const trailer=`<rect x="30" y="285" width="560" height="14" rx="4" fill="#2b312b"/><rect x="30" y="86" width="560" height="199" rx="8" fill="url(#box)" stroke="${OUT}" stroke-width="3"/>`+ribs(30,560,86,285,36)+`<rect x="33" y="251" width="554" height="12" fill="url(#green)"/><rect x="26" y="94" width="8" height="183" rx="3" fill="#cfd5cc" stroke="${OUT}"/><circle cx="46" cy="100" r="4" fill="#d9442d"/>`;
        const tractor=`<rect x="590" y="272" width="250" height="14" rx="4" fill="#2b312b"/>`+cabShape(626,150,118)+`<rect x="596" y="262" width="34" height="14" rx="3" fill="#59635a"/>`;
        const wheels=[110,190,270].map(a=>wheel(a,42)).join('')+wheel(650,42)+wheel(740,42);
        return {svg:trailer+tractor+wheels,min:24,max:790};
      }
      default:return rigid({boxX:120,boxW:410,top:104,cabW:132,cabTop:136,axles:[240,600],r:42,dualRear:false});
    }
  }

  window.SpotVehicleArt=function(type){
    const v=build(type);
    const dx=Math.round(450-(v.min+v.max)/2);
    const shadow=v.noShadow?'':`<ellipse cx="${(v.min+v.max)/2+dx}" cy="${GROUND+2}" rx="${(v.max-v.min)/2+20}" ry="14" fill="url(#shadow)"/>`;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420" viewBox="0 0 900 420">${defs}<rect width="900" height="420" fill="url(#bg)"/><rect y="${GROUND-6}" width="900" height="66" fill="url(#floor)"/>${shadow}<g transform="translate(${dx},0)">${v.svg}</g></svg>`;
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  };
})();
