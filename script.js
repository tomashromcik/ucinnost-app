// Účinnost – generátor slovních úloh (P₀, P) s podrobným logováním
// Pozn.: čísla lze psát s čárkou; vše je "null-safe"; DOM se drátuje až po DOMContentLoaded.

document.addEventListener('DOMContentLoaded', () => {
  console.info('[UCINNOST] DOMContentLoaded');
  setTimeout(() => {
    if (typeof init === 'function') {
      console.info('[UCINNOST] init() spouštím po načtení DOM');
      init();
    } else {
      console.error('[UCINNOST] Funkce init() není definována!');
    }
  }, 100);
});



const $ = (id) => document.getElementById(id);
const log = (...a) => console.log("[UCINNOST]", ...a);
const warn = (...a) => console.warn("[UCINNOST][WARN]", ...a);

// ——— Pomocné funkce: jednotky, čárka/tečka ———
const F = { W:1, kW:1000, MW:1_000_000 };
const toNumber = (s) => {
  if (s == null) return NaN;
  const t = String(s).trim().replace(/\s+/g,'').replace(',', '.');
  return Number(t);
};
const formatComma = (num, digits=3) =>
  Number(num).toFixed(digits).replace(/\.?0+$/,'').replace('.', ',');
const fmtW = (w) => {
  const num = (w>=1_000_000) ? (w/1_000_000) : (w>=1000) ? (w/1000) : w;
  const unit = (w>=1_000_000) ? 'MW' : (w>=1000) ? 'kW' : 'W';
  return formatComma(num) + ' ' + unit;
};
const unitize = (w)=> w>=1_000_000? {v:w/1_000_000,u:'MW'} : w>=1000? {v:w/1000,u:'kW'} : {v:w,u:'W'};

// ——— Stav ———
let step = 0;
let problem = null;
let stats = { ok:0, err:0, accSum:0, accN:0 };

// ——— Reálné rozsahy ———
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

// ——— Generování úlohy ———
function makeProblem(){
  const dev = choose(DEVICES);
  const type = choose(['eta','P','P0']); // neznámá veličina
  const P0W = pick(dev.p0W[0], dev.p0W[1]);
  const eta = pickInt(dev.eta[0], dev.eta[1]); // celé %
  const PW  = P0W * (eta/100);
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
  log("Vygenerovaná úloha:", JSON.parse(JSON.stringify(p)));
  return p;
}

// ——— UI ———
function setStepVisual(){
  document.querySelectorAll('.step').forEach((el,i)=> el.classList.toggle('active', i===step));
  const back = $('#btnBack'), next = $('#btnNext');
  if (!back) warn("Nenalezen #btnBack"); else back.disabled = (step===0);
  if (!next) warn("Nenalezen #btnNext"); else next.disabled = (step===3);
}
function renderAside(){
  const zad = $('#zadaniText'), kb = $('#knownBox');
  if (!zad) warn("Nenalezen #zadaniText");
  if (!kb)  warn("Nenalezen #knownBox");
  if (zad) zad.textContent = problem ? `${problem.text}\n\nÚkol: ${problem.ask}` : '';
  if (kb && problem){
    const known = [
      (problem.type!=='P0') ? `P₀ = ${formatComma(problem.P0.v)} ${problem.P0.u}` : `P₀ = ?`,
      (problem.type!=='P')  ? `P  = ${formatComma(problem.P.v)} ${problem.P.u}`   : `P  = ?`,
      (problem.type!=='eta')? `η  = ${problem.eta} %` : `η  = ?`
    ].join(' • ');
    kb.innerHTML = `<b>Dané:</b> ${known}`;
  }
}

function render(){
  log("render(step)", step);
  setStepVisual(); renderAside();
  const screen = $('#screen');
  if (!screen){ warn("Nenalezen #screen – render stop"); return; }
  screen.innerHTML='';

  if (step===0){
    screen.innerHTML = `<h2>1. Zadání</h2><p class="small muted">Prostuduj zadání vlevo. Pokračuj na Zápis.</p>`;
    return;
  }

  if (step===1){
    screen.innerHTML = `
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
      <p class="small muted">Opíšete pouze <b>dané</b> hodnoty ze zadání. Neznámé nevyplňujte.</p>
      <div id="writeMsg" class="small"></div>`;

    const p0U = $('#p0Unit'), pU = $('#pUnit'), p0V = $('#p0Val'), pV = $('#pVal'), eW = $('#etaWrite');
    if (!p0U||!pU||!p0V||!pV||!eW) warn("Zápis – chybí některé prvky", {p0U, pU, p0V, pV, eW});

    if (p0U) p0U.value = problem.P0.u;
    if (pU)  pU.value  = problem.P.u;
    if (p0V) p0V.placeholder = (problem.type==='P0') ? '?' : formatComma(problem.P0.v);
    if (pV)  pV.placeholder  = (problem.type==='P')  ? '?' : formatComma(problem.P.v);
    if (eW)  eW.placeholder  = (problem.type==='eta')? '?' : String(problem.eta);

    const checkWrite = ()=>{
      const box = $('#writeMsg'); if (!box){ warn("Chybí #writeMsg"); return false; }
      let ok=true, msg=[];

      // P₀
      const vP0 = toNumber(p0V && p0V.value), uP0 = p0U && p0U.value || 'W';
      if (problem.type!=='P0'){
        const want = problem.P0.v*F[problem.P0.u];
        const got  = (isNaN(vP0)?NaN:vP0)*F[uP0];
        if (!(isFinite(got) && Math.abs(got-want) <= Math.max(1e-6, want*0.001))) { ok=false; msg.push('P₀ neodpovídá zadání.'); }
      } else if (p0V && p0V.value.trim()!==''){ ok=false; msg.push('P₀ v zadání chybí – nevyplňuj.'); }

      // P
      const vP = toNumber(pV && pV.value), uP = pU && pU.value || 'W';
      if (problem.type!=='P'){
        const want = problem.P.v*F[problem.P.u];
        const got  = (isNaN(vP)?NaN:vP)*F[uP];
        if (!(isFinite(got) && Math.abs(got-want) <= Math.max(1e-6, want*0.001))) { ok=false; msg.push('P neodpovídá zadání.'); }
      } else if (pV && pV.value.trim()!==''){ ok=false; msg.push('P v zadání chybí – nevyplňuj.'); }

      // η
      const vEta = toNumber(eW && eW.value);
      if (problem.type!=='eta'){
        if (!(isFinite(vEta) && Math.abs(vEta - problem.eta) <= Math.max(1e-6, problem.eta*0.001))) { ok=false; msg.push('η neodpovídá zadání.'); }
      } else if (eW && eW.value.trim()!==''){ ok=false; msg.push('η v zadání chybí – nevyplňuj.'); }

      box.innerHTML = ok ? '<span class="success">✅ Zápis odpovídá zadání.</span>'
                         : '<span class="error">❌ '+msg.join(' ')+'</span>';
      log("live-check Zápis:", {ok, msg, vP0, uP0, vP, uP, vEta});
      return ok;
    };
    ['input','change','keyup'].forEach(ev=>{
      [p0V,p0U,pV,pU,eW].forEach(el=> el && el.addEventListener(ev, checkWrite));
    });
    checkWrite();
    return;
  }

  if (step===2){
    const zapis = [
      (problem.type!=='P0') ? `P₀ = ${formatComma(problem.P0.v)} ${problem.P0.u}` : 'P₀ = ?',
      (problem.type!=='P')  ? `P = ${formatComma(problem.P.v)} ${problem.P.u}`   : 'P = ?',
      (problem.type!=='eta')? `η = ${problem.eta} %` : 'η = ?'
    ].join(' • ');

    const formulaHelp = (problem.type==='eta')
      ? 'η = P / P₀ (povolené i "η = P : P₀")'
      : (problem.type==='P')
        ? 'P = η · P₀ (η v desetinném tvaru, např. 0,75) nebo P = (η : 100) · P₀'
        : 'P₀ = P / η (η v desetinném tvaru) nebo P₀ = P : (η : 100)';

    let inner='';
    if (problem.type==='eta'){
      inner = `
        <div class="badge wip"><b>Zápis:</b> ${zapis}</div>
        <div class="inline-buttons">
          <button data-ins="η">η</button><button data-ins="P">P</button><button data-ins="P₀">P₀</button>
          <button data-ins=" / ">/</button><button data-ins=" : ">:</button><button data-ins=" = ">=</button>
        </div>
        <label>Zapiš vzorec</label>
        <input id="formula" class="input" type="text" placeholder="${formulaHelp}">
        <label>Výsledek — η (%)</label>
        <input id="eta" class="input" type="text" inputmode="decimal" placeholder="např. 75">`;
    } else if (problem.type==='P'){
      inner = `
        <div class="badge wip"><b>Zápis:</b> ${zapis}</div>
        <div class="inline-buttons">
          <button data-ins="η">η</button><button data-ins="P">P</button><button data-ins="P₀">P₀</button>
          <button data-ins=" · ">·</button><button data-ins=" / ">/</button><button data-ins=" : ">:</button><button data-ins=" = ">=</button>
        </div>
        <label>Zapiš vzorec</label>
        <input id="formula" class="input" type="text" placeholder="${formulaHelp}">
        <label>Výsledek — P</label>
        <div class="row gap">
          <input id="pCalc" class="input" type="text" inputmode="decimal" placeholder="hodnota">
          <select id="pCalcUnit" class="input"><option>W</option><option>kW</option><option>MW</option></select>
        </div>`;
    } else {
      inner = `
        <div class="badge wip"><b>Zápis:</b> ${zapis}</div>
        <div class="inline-buttons">
          <button data-ins="η">η</button><button data-ins="P">P</button><button data-ins="P₀">P₀</button>
          <button data-ins=" · ">·</button><button data-ins=" / ">/</button><button data-ins=" : ">:</button><button data-ins=" = ">=</button>
        </div>
        <label>Zapiš vzorec</label>
        <input id="formula" class="input" type="text" placeholder="${formulaHelp}">
        <label>Výsledek — P₀</label>
        <div class="row gap">
          <input id="p0Calc" class="input" type="text" inputmode="decimal" placeholder="hodnota">
          <select id="p0CalcUnit" class="input"><option>W</option><option>kW</option><option>MW</option></select>
        </div>`;
    }
    screen.innerHTML = `<h2>3. Výpočet</h2>${inner}<div id="calcMsg" class="small"></div>`;
    if ($('#pCalcUnit'))  $('#pCalcUnit').value  = problem.P.u;
    if ($('#p0CalcUnit')) $('#p0CalcUnit').value = problem.P0.u;

    // vkládání symbolů + auto η
    document.querySelectorAll('.inline-buttons button').forEach(b=>{
      b.addEventListener('click', ()=>{
        const f = $('#formula'); if(!f){ warn("Chybí #formula"); return; }
        const ins = b.getAttribute('data-ins') || '';
        const pos = f.selectionStart || f.value.length;
        f.value = (f.value.slice(0,pos) + ins + f.value.slice(pos));
        f.focus(); f.selectionStart = f.selectionEnd = pos + ins.length;
        liveFormulaCheck();
      });
    });
    const formulaEl = $('#formula');
    function liveFormulaCheck(){
      const box = $('#calcMsg'); if(!box) return;
      const f = (formulaEl ? formulaEl.value : '').replace(/\s+/g,'');
      let ok=false;
      if (problem.type==='eta') ok = (f==='η=P/P₀' || f==='η=P:P₀');
      if (problem.type==='P')   ok = (f==='P=η·P₀' || f==='P=(η:100)·P₀' || f==='P=η*P₀');
      if (problem.type==='P0')  ok = (f==='P₀=P/η' || f==='P₀=P:(η:100)');
      box.innerHTML = ok ? '<span class="success">✅ Vzorec v pořádku.</span>' :
                           '<span class="error">❌ Zapiš správný vzorec (viz nápověda).</span>';
      log("live-check Vzorec:", f, {ok});
      return ok;
    }
    if (formulaEl){
      formulaEl.addEventListener('input', ()=>{
        formulaEl.value = formulaEl.value.replace(/(^|[^a-zA-Z])eta([^a-zA-Z]|$)/g, '$1η$2');
        liveFormulaCheck();
      });
      liveFormulaCheck();
    }
    return;
  }

  if (step===3){
    const zapis = [
      (problem.type!=='P0') ? `P₀ = ${formatComma(problem.P0.v)} ${problem.P0.u}` : 'P₀ = ?',
      (problem.type!=='P')  ? `P = ${formatComma(problem.P.v)} ${problem.P.u}`   : 'P = ?',
      (problem.type!=='eta')? `η = ${problem.eta} %` : 'η = ?'
    ].join(' • ');
    const template =
      (problem.type==='eta') ? `Účinnost ${problem.device.name.toLowerCase()} je __ %.` :
      (problem.type==='P')   ? `Užitečný výkon zařízení je __.` :
                               `Celkový příkon zařízení je __.`;
    const unitSuggestion = (problem.type==='eta') ? '%' :
      (problem.type==='P')  ? problem.P.u : problem.P0.u;

    screen.innerHTML = `
      <h2>4. Odpověď</h2>
      <div class="badge ok"><b>Zápis:</b> ${zapis}</div>
      <label>Šablona odpovědi</label>
      <div class="note">${template.replace('__', '<b id="placeholder">[doplň výsledek]</b>')}</div>
      <div class="row gap" style="margin-top:8px">
        <input id="ansVal" class="input" type="text" inputmode="decimal" placeholder="výsledek">
        <select id="ansUnit" class="input"><option>%</option><option>W</option><option>kW</option><option>MW</option></select>
      </div>
      <div id="ansMsg" class="small"></div>`;
    const ansUnit = $('#ansUnit'); if (ansUnit) ansUnit.value = unitSuggestion;
    return;
  }
}

function setStats(){
  const ok=$('#okCount'), er=$('#errCount'), av=$('#avgAcc');
  if (ok) ok.textContent = stats.ok;
  if (er) er.textContent = stats.err;
  if (av) av.textContent = stats.accN ? (stats.accSum/stats.accN).toFixed(1).replace('.', ',')+' %' : '–';
}

function check(){
  log("check(step)", step);
  if (step===1){
    const p0v=$('#p0Val'), p0u=$('#p0Unit');
    const pv=$('#pVal'),   pu=$('#pUnit');
    const et=$('#etaWrite');
    const box=$('#writeMsg'); if (!box){ warn("Chybí #writeMsg"); return false; }

    let ok=true, msg=[];

    if (problem.type!=='P0'){
      const want = problem.P0.v*F[problem.P0.u];
      const got  = toNumber(p0v && p0v.value) * F[(p0u && p0u.value) || 'W'];
      if (!(isFinite(got) && Math.abs(got-want) <= Math.max(1e-6, want*0.001))) { ok=false; msg.push('P₀ neodpovídá zadání.'); }
    } else if (p0v && p0v.value.trim()!==''){ ok=false; msg.push('P₀ v zadání chybí – nevyplňuj.'); }

    if (problem.type!=='P'){
      const want = problem.P.v*F[problem.P.u];
      const got  = toNumber(pv && pv.value) * F[(pu && pu.value) || 'W'];
      if (!(isFinite(got) && Math.abs(got-want) <= Math.max(1e-6, want*0.001))) { ok=false; msg.push('P neodpovídá zadání.'); }
    } else if (pv && pv.value.trim()!==''){ ok=false; msg.push('P v zadání chybí – nevyplňuj.'); }

    if (problem.type!=='eta'){
      const got = toNumber(et && et.value);
      if (!(isFinite(got) && Math.abs(got - problem.eta) <= Math.max(1e-6, problem.eta*0.001))) { ok=false; msg.push('η neodpovídá zadání.'); }
    } else if (et && et.value.trim()!==''){ ok=false; msg.push('η v zadání chybí – nevyplňuj.'); }

    box.innerHTML = ok ? '<span class="success">✅ Zápis odpovídá zadání.</span>'
                       : '<span class="error">❌ '+msg.join(' ')+'</span>';
    log("check Zápis:", {ok, msg});
    return ok;
  }

  if (step===2){
    const tol=0.005; const box=$('#calcMsg'); if(!box){ warn("Chybí #calcMsg"); return false; }

    const formulaEl = $('#formula'); const f = formulaEl ? formulaEl.value.replace(/\s+/g,'') : '';
    let goodFormula=false, ok=false, acc=0, msg='';

    if (problem.type==='eta') goodFormula = (f==='η=P/P₀' || f==='η=P:P₀');
    if (problem.type==='P')   goodFormula = (f==='P=η·P₀' || f==='P=(η:100)·P₀' || f==='P=η*P₀');
    if (problem.type==='P0')  goodFormula = (f==='P₀=P/η' || f==='P₀=P:(η:100)');

    if (problem.type==='eta'){
      const v = toNumber($('#eta') && $('#eta').value);
      if (isFinite(v)){ acc = 100 - Math.min(100, Math.abs(v - problem.eta)); ok = Math.abs(v - problem.eta) <= Math.max(1e-6, problem.eta*tol); }
      msg = (goodFormula && ok)
        ? `✅ Vzorec i výpočet v pořádku. η = ${formatComma(problem.eta)} %`
        : !goodFormula ? '❌ Zapiš správný vzorec.' : `❌ Nesouhlasí výsledek. Očekává se ~${formatComma(problem.eta)} %.`;
    } else if (problem.type==='P'){
      const v = toNumber($('#pCalc') && $('#pCalc').value);
      const u = ($('#pCalcUnit') && $('#pCalcUnit').value) || 'W';
      const got = v * F[u], want = problem.PW;
      if (isFinite(got)){ acc = 100 - Math.min(100, Math.abs(got - want)/want*100); ok = Math.abs(got - want) <= Math.max(1e-6, want*tol); }
      msg = (goodFormula && ok)
        ? `✅ Vzorec i výpočet v pořádku. P = ${fmtW(want)}`
        : !goodFormula ? '❌ Zapiš správný vzorec.' : `❌ Nesouhlasí výsledek. Očekává se ~${fmtW(want)}.`;
    } else {
      const v = toNumber($('#p0Calc') && $('#p0Calc').value);
      const u = ($('#p0CalcUnit') && $('#p0CalcUnit').value) || 'W';
      const got = v * F[u], want = problem.P0W;
      if (isFinite(got)){ acc = 100 - Math.min(100, Math.abs(got - want)/want*100); ok = Math.abs(got - want) <= Math.max(1e-6, want*tol); }
      msg = (goodFormula && ok)
        ? `✅ Vzorec i výpočet v pořádku. P₀ = ${fmtW(want)}`
        : !goodFormula ? '❌ Zapiš správný vzorec.' : `❌ Nesouhlasí výsledek. Očekává se ~${fmtW(want)}.`;
    }

    box.innerHTML = ok ? `<span class="success">${msg}</span>` : `<span class="error">${msg}</span>`;
    if (ok){ stats.ok++; stats.accSum += acc; stats.accN++; } else { stats.err++; }
    setStats();
    log("check Výpočet:", {goodFormula, ok, msg});
    return ok;
  }

  if (step===3){
    const ans = $('#ansVal'), unit = $('#ansUnit'), box = $('#ansMsg');
    if (!ans||!unit||!box){ warn("Chybí ans prvky"); return false; }
    const txt = (ans.value||'').trim();
    const hasNum = txt !== '' && isFinite(toNumber(txt));
    const valueStr = (unit.value === '%')
      ? formatComma(problem.eta) + ' %'
      : (problem.type==='P') ? fmtW(problem.PW) : fmtW(problem.P0W);
    box.innerHTML = hasNum
      ? `<span class="success">✅ Odpověď dopsána. Vzor: <i>${valueStr}</i></span>`
      : `<span class="error">❌ Doplň číselný výsledek (s desetinnou čárkou) a zvol jednotku.</span>`;
    log("check Odpověď:", {hasNum, txt, unit: unit.value});
    return hasNum;
  }
  return true;
}

// ——— Ovládání (s logy kliknutí) ———
function wire(){
  const on = (id, fn)=>{
    const el = $(id);
    if (!el) { warn("wire: nenalezen", id); return; }
    el.addEventListener('click', (e)=>{ log("klik", id); fn(e); });
  };
  on('btnNew',  ()=>{ problem = makeProblem(); step=0; render(); });
  on('btnReset',()=>{ stats={ok:0,err:0,accSum:0,accN:0}; setStats(); problem = makeProblem(); step=0; render(); });
  on('btnBack', ()=>{ if(step>0){ step--; render(); }});
  on('btnNext', ()=>{ if(step<3){ step++; render(); }});
  on('btnCheck',()=>{ check(); });
}

// ——— Start: jistota DOMContentLoaded ———
function init(){
  log("init()");
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  problem = makeProblem();
  render();
  setStats();
  wire();
  // pro ladění v konzoli:
  window.__ucinnost = { get step(){return step;}, get problem(){return problem;}, stats };
  log("window.__ucinnost dostupné", window.__ucinnost);
}
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ()=>{ log("DOMContentLoaded"); init(); });
} else {
  // skript je nejspíš už na konci <body>, ale pro jistotu…
 }
