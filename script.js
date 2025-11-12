// Bezpečný start po DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  console.info('[UCINNOST] DOMContentLoaded');
  setTimeout(() => {
    if (typeof init === 'function') {
      console.info('[UCINNOST] init() spouštím po načtení DOM');
      init();
    } else {
      console.error('[UCINNOST] Funkce init() není definována!');
    }
  }, 50);
});

const $    = (id)   => document.getElementById(id);
const log  = (...a) => console.log('[UCINNOST]', ...a);
const warn = (...a) => console.warn('[UCINNOST][WARN]', ...a);

// čísla: čárka/tečka + jednotky
const F = { W:1, kW:1000, MW:1_000_000 };
const toNumber = (s) => {
  if (s == null) return NaN;
  const t = String(s).trim().replace(/\s+/g,'').replace(',', '.');
  return Number(t);
};
const formatComma = (num, digits=3) =>
  Number(num).toFixed(digits).replace(/\.?0+$/,'').replace('.', ',');
const unitize = (w)=> w>=1_000_000? {v:w/1_000_000,u:'MW'} : w>=1000? {v:w/1000,u:'kW'} : {v:w,u:'W'};
const fmtW = (w)=>{ const u=unitize(w); return formatComma(u.v)+' '+u.u; };

// stav
let step = 0;
let problem = null;
let stats = { ok:0, err:0, accSum:0, accN:0 };

// realistické rozsahy
const DEVICES = [
  {id:'zarovka', name:'Žárovka',      p0W:[5,150],              eta:[5,25]},
  {id:'ledka',   name:'LED žárovka',  p0W:[3,30],               eta:[25,45]},
  {id:'motor',   name:'Elektromotor', p0W:[5_000,500_000],      eta:[60,95]},
  {id:'cerpadlo',name:'Čerpadlo',     p0W:[500,50_000],         eta:[40,80]},
  {id:'turbina', name:'Turbína',      p0W:[1_000_000,50_000_000], eta:[30,60]},
];
const pick = (min,max)=> min + Math.random()*(max-min);
const pickInt = (min,max)=> Math.round(pick(min,max));
const choose = (arr)=> arr[Math.floor(Math.random()*arr.length)];

// ———————————————————————————————————————————
// 1) AUTOFIX DOMU: doplníme chybějící prvky
// ———————————————————————————————————————————
function ensureContentHost(){
  let host = $('#content');
  if (host) return host;

  warn('Nenalezen #content – vytvořím ho dynamicky');
  const flow = document.querySelector('.flow');
  if (!flow){ warn('Nenalezena .flow – nemám kam vložit #content'); return null; }

  const actions = flow.querySelector('.actions');
  host = document.createElement('div');
  host.id = 'content';
  if (actions) flow.insertBefore(host, actions);
  else flow.appendChild(host);
  return host;
}

function ensureAsideBoxes(){
  const aside = document.querySelector('.aside');
  if (!aside){ warn('Nenalezena .aside'); return; }

  let zad = $('#zadaniText');
  if (!zad){
    warn('Nenalezen #zadaniText – vytvořím ho');
    zad = document.createElement('div');
    zad.id = 'zadaniText';
    zad.className = 'zadani';
    // vložím ho za .hr pokud existuje, jinak na konec aside
    const hr = aside.querySelector('.hr');
    if (hr && hr.parentNode) hr.parentNode.insertBefore(zad, hr.nextSibling);
    else aside.appendChild(zad);
  }

  let known = $('#knownBox');
  if (!known){
    warn('Nenalezen #knownBox – vytvořím ho');
    known = document.createElement('div');
    known.id = 'knownBox';
    known.className = 'small';
    aside.appendChild(known);
  }
}

function ensureActionButtons(){
  const actions = document.querySelector('.actions');
  if (!actions){ warn('Nenalezena .actions'); return; }

  // očekáváme 3 tlačítka: Zpět | Zkontrolovat | Pokračovat
  // pokud nemají ID, přidělíme:
  let back  = $('#btnBack')  || actions.querySelector('button.ghost') || actions.querySelector('button');
  let check = $('#btnCheck') || actions.querySelector('button.primary');
  let next  = $('#btnNext')  || actions.querySelectorAll('button')[actions.querySelectorAll('button').length-1];

  if (back  && !back.id)  back.id  = 'btnBack';
  if (check && !check.id) check.id = 'btnCheck';
  if (next  && !next.id)  next.id  = 'btnNext';

  if (!$('#btnBack'))  warn('Po autofixu stále chybí #btnBack');
  if (!$('#btnCheck')) warn('Po autofixu stále chybí #btnCheck');
  if (!$('#btnNext'))  warn('Po autofixu stále chybí #btnNext');
}

// ———————————————————————————————————————————
// 2) GENERÁTOR ÚLOHY
// ———————————————————————————————————————————
function makeProblem(){
  const dev  = choose(DEVICES);
  const type = choose(['eta','P','P0']);
  const P0W  = pick(dev.p0W[0], dev.p0W[1]);
  const eta  = pickInt(dev.eta[0], dev.eta[1]);
  const PW   = P0W * (eta/100);
  const P0 = unitize(P0W), P = unitize(PW);

  let text="", ask="";
  if(type==='eta'){
    text = `${dev.name} odebírá příkon P₀ = ${formatComma(P0.v)} ${P0.u}. Užitečný výkon je P = ${formatComma(P.v)} ${P.u}. Urči účinnost zařízení.`;
    ask  = 'Vypočítej účinnost η v procentech.';
  } else if(type==='P'){
    text = `${dev.name} pracuje s účinností η = ${eta} %. Odebírá příkon P₀ = ${formatComma(P0.v)} ${P0.u}. Urči užitečný výkon P.`;
    ask  = 'Vypočítej P (užitečný výkon).';
  } else {
    text = `${dev.name} má účinnost η = ${eta} %. Dodává užitečný výkon P = ${formatComma(P.v)} ${P.u}. Urči celkový příkon P₀.`;
    ask  = 'Vypočítej P₀ (celkový příkon).';
  }

  const p = {device:dev, type, P0W, PW, eta, P0, P, text, ask};
  log('Vygenerovaná úloha:', JSON.parse(JSON.stringify(p)));
  return p;
}

// ———————————————————————————————————————————
// 3) RENDER
// ———————————————————————————————————————————
function setStepVisual(){
  document.querySelectorAll('.step').forEach((el,i)=> el.classList.toggle('active', i===step));
  const back = $('#btnBack'), next = $('#btnNext');
  if (!back) warn('Nenalezen #btnBack'); else back.disabled = (step===0);
  if (!next) warn('Nenalezen #btnNext'); else next.disabled = (step===3);
}
function renderAside(){
  const zad = document.getElementById('zadaniText');
  const kb  = document.getElementById('knownBox');

  if (!zad) warn('Nenalezen #zadaniText');
  if (!kb)  warn('Nenalezen #knownBox');

  if (zad) {
    const text = problem ? `${problem.text}\n\nÚkol: ${problem.ask}` : '';
    zad.style.display   = 'block';
    zad.style.visibility = 'visible';
    // nahradíme \n -> <br> kvůli zalomení
    zad.innerHTML = (text || '').replace(/\n/g, '<br>');
    log('renderAside(): zapsán text, length =', (text || '').length);
  }

  if (kb && problem){
    const known = [
      (problem.type!=='P0') ? `P₀ = ${formatComma(problem.P0.v)} ${problem.P0.u}` : `P₀ = ?`,
      (problem.type!=='P')  ? `P  = ${formatComma(problem.P.v)} ${problem.P.u}`   : `P  = ?`,
      (problem.type!=='eta')? `η  = ${problem.eta} %` : `η  = ?`
    ].join(' • ');
    kb.style.display = 'block';
    kb.innerHTML     = `<b>Dané:</b> ${known}`;
  }
}


function render(){
  log('render(step)', step);
  setStepVisual();
  renderAside();

  const content = ensureContentHost();
  if (!content){ warn('Nelze vykreslit – chybí hostitelský element'); return; }
  content.innerHTML='';

  if (step===0){
    content.innerHTML = `<h2>1. Zadání</h2><p class="small">Prostuduj zadání vlevo. Pokračuj na Zápis.</p>`;
    return;
  }

  if (step===1){
    content.innerHTML = `
      <h2>2. Zápis</h2>
      <div class="grid2">
        <div>
          <label>P₀ (příkon)</label>
          <div class="row gap">
            <input id="p0Val" class="input" type="text" inputmode="decimal" placeholder="hodnota">
            <select id="p0Unit" class="input"><option>W</option><option>kW</option><option>MW</option></select>
          </div>
        </div>
        <div>
          <label>P (užitečný výkon)</label>
          <div class="row gap">
            <input id="pVal" class="input" type="text" inputmode="decimal" placeholder="hodnota">
            <select id="pUnit" class="input"><option>W</option><option>kW</option><option>MW</option></select>
          </div>
        </div>
      </div>
      <div class="grid2" style="margin-top:10px">
        <div>
          <label>η (účinnost v %)</label>
          <input id="etaWrite" class="input" type="text" inputmode="decimal" placeholder="např. 75">
        </div>
      </div>
      <p class="small">Opíšete pouze <b>dané</b> hodnoty ze zadání. Neznámé nevyplňujte.</p>
      <div id="writeMsg" class="small"></div>`;
    return;
  }

  if (step===2){
    content.innerHTML = `<h2>3. Výpočet</h2><p class="small">Zapiš vzorec a spočítej neznámou veličinu (η, P nebo P₀).</p><div id="calcMsg" class="small"></div>`;
    return;
  }

  if (step===3){
    content.innerHTML = `
      <h2>4. Odpověď</h2>
      <div class="badge ok"><b>Tip:</b> Odpověď zapiš ve tvaru „Užitečný výkon je …“ nebo „Účinnost je … %“.</div>
      <div class="row gap" style="margin-top:8px">
        <input id="ansVal" class="input" type="text" inputmode="decimal" placeholder="výsledek">
        <select id="ansUnit" class="input"><option>%</option><option>W</option><option>kW</option><option>MW</option></select>
      </div>
      <div id="ansMsg" class="small"></div>`;
    return;
  }
}

// statistiky (zatím jen vykreslení)
function setStats(){
  const ok=$('#okCount'), er=$('#errCount'), av=$('#avgAcc');
  if (ok) ok.textContent = stats.ok;
  if (er) er.textContent = stats.err;
  if (av) av.textContent = stats.accN ? (stats.accSum/stats.accN).toFixed(1).replace('.', ',')+' %' : '–';
}

// ovládání
function wire(){
  // přidělíme ID i když v HTML nebyla
  ensureActionButtons();

  const on = (id, fn)=>{
    const el = $(id);
    if (!el) { warn('wire: nenalezen', id); return; }
    el.addEventListener('click', (e)=>{ log('klik', id); fn(e); });
  };
  on('btnNew',  ()=>{ problem = makeProblem(); step=0; render(); });
  on('btnReset',()=>{ stats={ok:0,err:0,accSum:0,accN:0}; setStats(); problem = makeProblem(); step=0; render(); });
  on('btnBack', ()=>{ if(step>0){ step--; render(); }});
  on('btnNext', ()=>{ if(step<3){ step++; render(); }});
  on('btnCheck',()=>{ /* sem později doplníme detailní kontrolu */ });
}

// init
function init(){
  log('init()');

  // 1) jistota DOMu – vytvořím chybějící boxy a #content
  ensureAsideBoxes();
  ensureContentHost();
  ensureActionButtons();   // tlačítka dřív, než poprvé renderujeme

  // 2) data
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
  problem = makeProblem();

  // 3) hned po vygenerování explicitně zapiš zadání do levého panelu
  renderAside();

  // 4) pravý panel + statistiky
  setStats();
  render();

  // 5) ovládací prvky až na hotový DOM
  wire();

  window.__ucinnost = { get step(){return step;}, get problem(){return problem;}, stats };
  log('window.__ucinnost dostupné', window.__ucinnost);
}
