// ====== ÚČINNOST – kostra aplikace (P0, P, η) ======
const $   = id => document.getElementById(id);
const log = (...a) => console.log('[UCINNOST]', ...a);
const warn= (...a) => console.warn('[UCINNOST][WARN]', ...a);

// Pomocné
const F = { W:1, kW:1000, MW:1_000_000 };
const toNumber = s => String(s??'').trim().replace(',', '.').replace(/\s+/g,'')*1;
const formatComma = (n,d=3)=>Number(n).toFixed(d).replace(/\.?0+$/,'').replace('.',',');
const unitize = w => w>=1_000_000?{v:w/1_000_000,u:'MW'}:w>=1000?{v:w/1000,u:'kW'}:{v:w,u:'W'};
const fmtW = w => { const u=unitize(w); return formatComma(u.v)+' '+u.u; };

// Stav
let step = 0;
let problem = null;

// Realistické rozsahy
const DEVICES = [
  {name:'Žárovka',      p0W:[5,150],                eta:[5,25]},
  {name:'LED žárovka',  p0W:[3,30],                 eta:[25,45]},
  {name:'Motor',        p0W:[5_000,500_000],        eta:[60,95]},
  {name:'Čerpadlo',     p0W:[500,50_000],           eta:[40,80]},
  {name:'Turbína',      p0W:[1_000_000,50_000_000], eta:[30,60]},
];
const rnd  = (a,b)=>a+Math.random()*(b-a);
const rint = (a,b)=>Math.round(rnd(a,b));
const choose = a=>a[Math.floor(Math.random()*a.length)];

// Vytvoř kontejner #content, pokud chybí
function ensureContentContainer() {
  let c = document.getElementById('content');
  if (c) return c;
  const actions = document.querySelector('.card.flow .actions');
  c = document.createElement('div');
  c.id = 'content';
  c.className = 'card';
  if (actions && actions.parentNode) {
    actions.parentNode.insertBefore(c, actions);
    log('Dynamicky vytvořen #content (vložen před .actions)');
  } else {
    (document.querySelector('main') || document.body).appendChild(c);
    warn('Nepodařilo se najít .card.flow .actions – #content vložen nouzově na konec');
  }
  return c;
}

// Generování úlohy
function makeProblem(){
  const dev  = choose(DEVICES);
  const type = choose(['eta','P','P0']);            // neznámá
  const P0W  = rnd(dev.p0W[0], dev.p0W[1]);
  const eta  = rint(dev.eta[0], dev.eta[1]);
  const PW   = P0W*(eta/100);
  const P0   = unitize(P0W), P = unitize(PW);

  let text='', ask='';
  if (type==='eta'){
    text = `${dev.name} odebírá příkon P₀ = ${formatComma(P0.v)} ${P0.u}. ` +
           `Užitečný výkon je P = ${formatComma(P.v)} ${P.u}.`;
    ask  = 'Urči účinnost η v procentech.';
  } else if (type==='P'){
    text = `${dev.name} pracuje s účinností η = ${eta} %. ` +
           `Odebírá příkon P₀ = ${formatComma(P0.v)} ${P0.u}.`;
    ask  = 'Urči užitečný výkon P.';
  } else {
    text = `${dev.name} má účinnost η = ${eta} %. ` +
           `Dodává užitečný výkon P = ${formatComma(P.v)} ${P.u}.`;
    ask  = 'Urči celkový příkon P₀.';
  }
  return { device:dev, type, P0W, PW, eta, P0, P, text, ask };
}

// Vlevo (zadání)
function renderAside(){
  if (!problem) return;
  const zad = $('#zadaniText');
  const kb  = $('#knownBox');
  if (zad) zad.innerHTML = `${problem.text}<br><br><i>Úkol:</i> ${problem.ask}`;
  if (kb)  kb.innerHTML  = [
    (problem.type!=='P0' ? `P₀ = ${formatComma(problem.P0.v)} ${problem.P0.u}` : 'P₀ = ?'),
    (problem.type!=='P'  ? `P = ${formatComma(problem.P.v)} ${problem.P.u}`   : 'P = ?'),
    (problem.type!=='eta'? `η = ${problem.eta} %` : 'η = ?')
  ].join(' • ');
}

// Střed (kroky)
function renderScreen(){
  const c = ensureContentContainer();
  c.innerHTML = '';

  // zvýraznění kroku v liště
  document.querySelectorAll('.step').forEach((el,i)=> el.classList.toggle('active', i===step));

  if (step===0){
    c.innerHTML = `<h2>1. Zadání</h2><p class="muted">Prostuduj zadání vlevo. Pokračuj na Zápis.</p>`;
    return;
  }

  if (step===1){
    c.innerHTML = `
      <h2>2. Zápis</h2>
      <p class="muted">Zatím jen ověřujeme UI (plný live-check doplním potom).</p>
      <div id="writeMsg" class="small">—</div>`;
    return;
  }

  if (step===2){
    const zapis = [
      `P₀ = ${formatComma(problem.P0.v)} ${problem.P0.u}`,
      `P = ${formatComma(problem.P.v)} ${problem.P.u}`,
      `η = ${problem.eta} %`
    ].join(' • ');

    c.innerHTML = `
      <h2>3. Výpočet</h2>
      <div class="badge">${zapis}</div>
      <div class="inline-buttons">
        <button data-ins="η">η</button><button data-ins="P">P</button><button data-ins="P₀">P₀</button>
        <button data-ins=" / ">/</button><button data-ins=" : ">:</button><button data-ins=" = ">=</button>
      </div>
      <input id="formula" class="input" placeholder="η = P/P₀">
      <div id="calcMsg" class="small">—</div>`;

    // vkládání symbolů
    c.querySelector('.inline-buttons')?.addEventListener('click',(e)=>{
      const b = e.target.closest('button[data-ins]'); if (!b) return;
      const f = $('#formula'); if (!f) return;
      const ins = b.dataset.ins; const pos = f.selectionStart ?? f.value.length;
      f.value = f.value.slice(0,pos)+ins+f.value.slice(pos);
      f.focus(); f.selectionStart = f.selectionEnd = pos + ins.length;
    });
    return;
  }

  if (step===3){
    c.innerHTML = `
      <h2>4. Odpověď</h2>
      <input id="ansVal" class="input" placeholder="výsledek">
      <select id="ansUnit" class="input">
        <option>%</option><option>W</option><option>kW</option><option>MW</option>
      </select>
      <div id="ansMsg" class="small">—</div>`;
    return;
  }
}

function renderAll(){ renderAside(); renderScreen(); }

// Ovládání
function wire(){
  const on = (id, fn) => { const el = $(id); el?.addEventListener('click', fn); };

  on('btnNew',  ()=>{ problem = makeProblem(); step=0; renderAll(); log('klik btnNew'); });
  on('btnReset',()=>{ problem = makeProblem(); step=0; renderAll(); log('klik btnReset'); });
  on('btnBack', ()=>{ if (step>0){ step--; renderAll(); log('klik btnBack'); }});
  on('btnNext', ()=>{ if (step<3){ step++; renderAll(); log('klik btnNext'); }});
  on('btnCheck',()=>{ const m=$('#calcMsg')||$('#writeMsg')||$('#ansMsg'); if(m) m.textContent='Klik OK'; log('klik btnCheck'); });
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  log('DOMContentLoaded');
  ensureContentContainer();                                   // zajisti #content
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  problem = makeProblem();                                    // vygeneruj úlohu
  renderAll();                                                // vykresli
  wire();                                                     // zapoj tlačítka
  window.__ucinnost = { get step(){return step;}, get problem(){return problem;} };
  log('elements present:', {
    btnBack: !!$('#btnBack'), btnNext: !!$('#btnNext'),
    btnNew: !!$('#btnNew'), btnReset: !!$('#btnReset'), btnCheck: !!$('#btnCheck'),
    content: !!$('#content'), knownBox: !!$('#knownBox'), zadaniText: !!$('#zadaniText')
  });
});

function ensureAsideTargets() {
  const aside = document.querySelector('.aside');
  if (!aside) { warn('Levý panel .aside nenalezen'); return; }

  let zad = document.getElementById('zadaniText');
  if (!zad) {
    zad = document.createElement('div');
    zad.id = 'zadaniText';
    zad.className = 'zadani';
    aside.appendChild(zad);
    log('Dynamicky vytvořen #zadaniText v levém panelu');
  }

  let kb = document.getElementById('knownBox');
  if (!kb) {
    kb = document.createElement('div');
    kb.id = 'knownBox';
    kb.className = 'small';
    aside.appendChild(kb);
    log('Dynamicky vytvořen #knownBox v levém panelu');
  }
}


