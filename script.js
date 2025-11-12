document.addEventListener('DOMContentLoaded', () => {
  console.info('[UCINNOST] DOMContentLoaded');
  init();
});

const $ = (id) => document.getElementById(id);
const log = (...a) => console.log('[UCINNOST]', ...a);
const warn = (...a) => console.warn('[UCINNOST][WARN]', ...a);

const F = { W:1, kW:1000, MW:1_000_000 };
const toNumber = (s) => String(s||'').trim().replace(',', '.').replace(/\s+/g,'') * 1;
const formatComma = (n,d=3)=>Number(n).toFixed(d).replace(/\.?0+$/,'').replace('.',',');
const unitize = (w)=> w>=1_000_000?{v:w/1_000_000,u:'MW'}:w>=1000?{v:w/1000,u:'kW'}:{v:w,u:'W'};
const fmtW=(w)=>{const u=unitize(w);return formatComma(u.v)+' '+u.u};

let step=0, problem=null, stats={ok:0,err:0,accSum:0,accN:0};

const DEVICES=[
 {id:'zarovka',name:'Žárovka',p0W:[5,150],eta:[5,25]},
 {id:'ledka',name:'LED žárovka',p0W:[3,30],eta:[25,45]},
 {id:'motor',name:'Elektromotor',p0W:[5_000,500_000],eta:[60,95]},
 {id:'cerpadlo',name:'Čerpadlo',p0W:[500,50_000],eta:[40,80]},
 {id:'turbina',name:'Turbína',p0W:[1_000_000,50_000_000],eta:[30,60]},
];
const pick=(a,b)=>a+Math.random()*(b-a);
const pickInt=(a,b)=>Math.round(pick(a,b));
const choose=(a)=>a[Math.floor(Math.random()*a.length)];

function makeProblem(){
  const dev=choose(DEVICES);
  const type=choose(['eta','P','P0']);
  const P0W=pick(dev.p0W[0],dev.p0W[1]);
  const eta=pickInt(dev.eta[0],dev.eta[1]);
  const PW=P0W*(eta/100);
  const P0=unitize(P0W),P=unitize(PW);
  let text='',ask='';
  if(type==='eta'){
    text=`${dev.name} odebírá příkon P₀ = ${formatComma(P0.v)} ${P0.u}. Užitečný výkon je P = ${formatComma(P.v)} ${P.u}. Urči účinnost.`;
    ask='Vypočítej účinnost η v %.';
  } else if(type==='P'){
    text=`${dev.name} pracuje s účinností η = ${eta} %. Odebírá příkon P₀ = ${formatComma(P0.v)} ${P0.u}. Urči P.`;
    ask='Vypočítej P (užitečný výkon).';
  } else {
    text=`${dev.name} má účinnost η = ${eta} %. Dodává P = ${formatComma(P.v)} ${P.u}. Urči P₀.`;
    ask='Vypočítej P₀ (celkový příkon).';
  }
  return {device:dev,type,P0W,PW,eta,P0,P,text,ask};
}

function renderAside(){
  const zad=$('#zadaniText'),kb=$('#knownBox');
  if(zad){
    zad.innerHTML=(problem.text+'\n\nÚkol: '+problem.ask).replace(/\n/g,'<br>');
  }
  if(kb){
    kb.innerHTML=`<b>Dané:</b> ${
      (problem.type!=='P0'?`P₀ = ${formatComma(problem.P0.v)} ${problem.P0.u}`:'P₀ = ?')
    } • ${
      (problem.type!=='P'?`P = ${formatComma(problem.P.v)} ${problem.P.u}`:'P = ?')
    } • ${
      (problem.type!=='eta'?`η = ${problem.eta} %`:'η = ?')}`;
  }
}

function render(){
  renderAside();
  const c=$('#content'); if(!c)return;
  c.innerHTML='';
  document.querySelectorAll('.step').forEach((el,i)=>el.classList.toggle('active',i===step));

  if(step===0){c.innerHTML='<h2>1. Zadání</h2><p class="muted">Prostuduj zadání vlevo → Zápis.</p>';return;}

  if(step===1){
    c.innerHTML=`<h2>2. Zápis</h2>
      <label>P₀</label><input id="p0Val" class="input">
      <label>P</label><input id="pVal" class="input">
      <label>η (%)</label><input id="etaWrite" class="input">
      <div id="writeMsg" class="small"></div>`;
    return;
  }

  if(step===2){
    const zapis=`P₀=${formatComma(problem.P0.v)} ${problem.P0.u} • P=${formatComma(problem.P.v)} ${problem.P.u} • η=${problem.eta} %`;
    c.innerHTML=`<h2>3. Výpočet</h2>
      <div class="badge">${zapis}</div>
      <div class="inline-buttons">
        <button data-ins="η">η</button><button data-ins="P">P</button><button data-ins="P₀">P₀</button>
        <button data-ins=" / ">/</button><button data-ins=" : ">:</button><button data-ins=" = ">=</button>
      </div>
      <input id="formula" class="input" placeholder="η = P/P₀ nebo P = η·P₀">
      <input id="eta" class="input" placeholder="např. 75">
      <div id="calcMsg" class="small"></div>`;

    // delegace kliků na symboly
    const wrap=c.querySelector('.inline-buttons');
    if (wrap) {
      wrap.addEventListener('click',ev=>{
        const b=ev.target.closest('button[data-ins]');if(!b)return;
        const f=$('#formula');if(!f)return;
        const ins=b.dataset.ins,pos=f.selectionStart??f.value.length;
        f.value=f.value.slice(0,pos)+ins+f.value.slice(pos);
        f.focus();f.selectionStart=f.selectionEnd=pos+ins.length;
      });
    }
    return;
  }

  if(step===3){
    c.innerHTML=`<h2>4. Odpověď</h2>
      <div class="note">Doplň slovní odpověď:</div>
      <input id="ansVal" class="input" placeholder="výsledek">
      <select id="ansUnit" class="input"><option>%</option><option>W</option><option>kW</option><option>MW</option></select>
      <div id="ansMsg" class="small"></div>`;
  }
}

function setStats(){
  const ok=$('#okCount'), er=$('#errCount'), av=$('#avgAcc');
  if(ok) ok.textContent=stats.ok;
  if(er) er.textContent=stats.err;
  if(av) av.textContent=stats.accN?(stats.accSum/stats.accN).toFixed(1).replace('.',',')+' %':'–';
}

function check(){
  if(step===1){
    const e=$('#writeMsg'); if (e) e.innerHTML='<span class="success">✅ Zápis OK (demo ověření)</span>';
    stats.ok++;setStats();return;
  }
  if(step===2){
    const f=($('#formula')?.value||'').replace(/\s+/g,'');
    const e=$('#calcMsg');
    if(e) e.innerHTML=(f==='η=P/P₀'||f==='η=P:P₀')
      ? '<span class="success">✅ Správný vzorec!</span>'
      : '<span class="error">❌ Nesprávný vzorec</span>';
    return;
  }
  if(step===3){
    const v=$('#ansVal')?.value.trim();
    const u=$('#ansUnit')?.value;
    const e=$('#ansMsg');
    if(!e) return;
    if(!v) e.innerHTML='<span class="error">Doplň hodnotu</span>';
    else   e.innerHTML='<span class="success">✅ Hotovo ('+v+' '+u+')</span>';
  }
}

function wire(){
  const on=(id,fn)=>{$(id)?.addEventListener('click',fn);};
  on('btnNew',()=>{problem=makeProblem();renderAside();step=0;render();});
  on('btnReset',()=>{stats={ok:0,err:0,accSum:0,accN:0};setStats();problem=makeProblem();step=0;render();});
  on('btnBack',()=>{if(step>0){step--;render();}});
  on('btnNext',()=>{if(step<3){step++;render();}});
  on('btnCheck',()=>{check();});
}

function init(){
  // Bezpečně – #year nemusí existovat
  const y = $('#year'); 
  if (y) y.textContent = new Date().getFullYear();

  problem=makeProblem();
  renderAside();
  render();
  setStats();
  wire();
}
