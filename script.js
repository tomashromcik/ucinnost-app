// Generátor slovních úloh na účinnost — P₀ (příkon) a P (užitečný výkon)
// Splňuje: viditelné zadání, zápis s live-checkingem, vzorec s η/P/P₀, odpověď předvyplněná,
// desetinná čárka, reálné rozsahy hodnot.

const $ = (id)=>document.getElementById(id);
const yearEl = $('#year'); if (yearEl) yearEl.textContent = new Date().getFullYear();

// —————————————————— Jednotky, čárka/tečka ——————————————————
const F = { W:1, kW:1000, MW:1_000_000 };
const toNumber = (s) => {
  if (s == null) return NaN;
  // povol čárku i tečku, mezery tisíců ignoruj
  const t = String(s).trim().replace(/\s+/g,'').replace(',', '.');
  return Number(t);
};
const fmtW = (w) => {
  const num = (w >= 1_000_000) ? (w/1_000_000) : (w >= 1000) ? (w/1000) : w;
  const unit = (w >= 1_000_000) ? 'MW' : (w >= 1000) ? 'kW' : 'W';
  return formatComma(num) + ' ' + unit;
};
const formatComma = (num, digits=3) => {
  // číslo → řetězec s desetinnou čárkou (max digits)
  const s = Number(num).toFixed(digits);
  // odstraníme zbytečné nuly a tečku → čárku
  return s.replace(/\.?0+$/,'').replace('.', ',');
};

// —————————————————— Stav ——————————————————
let step = 0;
let problem = null;
let stats = { ok:0, err:0, accSum:0, accN:0 };

// Reálné rozsahy: zařízení → rozsah P₀, rozumné η
const DEVICES = [
  {id:'zarovka', name:'Žárovka',      p0W:[5,150],         eta:[5,25]},       // stará žárovka ≈ 5–25 %
  {id:'ledka',   name:'LED žárovka',  p0W:[3,30],          eta:[25,45]},      // LED ≈ 25–45 % (záleží na definici užitku)
  {id:'motor',   name:'Elektromotor', p0W:[5_000,500_000], eta:[60,95]},      // 5 kW–500 kW
  {id:'cerpadlo',name:'Čerpadlo',     p0W:[500,50_000],    eta:[40,80]},      // 0.5–50 kW
  {id:'turbina', name:'Turbína',      p0W:[1_000_000,50_000_000], eta:[30,60]} // 1–50 MW
];

const pick = (min,max)=> min + Math.random()*(max-min);
const pickInt = (min,max)=> Math.round(pick(min,max));
const choose = (arr)=> arr[Math.floor(Math.random()*arr.length)];
const unitize = (w)=> w>=1_000_000? {v:w/1_000_000,u:'MW'} : w>=1000? {v:w/1000,u:'kW'} : {v:w,u:'W'};

// —————————————————— Tvorba úlohy ——————————————————
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
  return {device:dev, type, P0W, PW, eta, P0, P, text, ask};
}

// —————————————————— UI: stav, levý panel, kroky ——————————————————
function setStepVisual(){
  document.querySelectorAll('.step').forEach((el,i)=> el.classList.toggle('active', i===step));
  const back = $('#btnBack'); if (back) back.disabled = (step===0);
  const next = $('#btnNext'); if (next) next.disabled = (step===3);
}
function renderAside(){
  const zad = $('#zadaniText'); if (zad) zad.textContent = problem ? `${problem.text}\n\nÚkol: ${problem.ask}` : '';
  const kb = $('#knownBox');
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
  setStepVisual(); renderAside();
  const screen = $('#screen'); if (!screen) return;
  screen.innerHTML = '';

  if (step===0){
    screen.innerHTML = `<h2>1. Zadání</h2>
      <p class="small muted">Prostuduj zadání vlevo. Pokračuj na Zápis.</p>`;
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

    // Předvolby + placeholdery z textu zadání
    const p0U = $('#p0Unit'),  pU  = $('#pUnit');
    if (p0U) p0U.value = problem.P0.u;
    if (pU)  pU.value  = problem.P.u;
    const p0V = $('#p0Val'), pV = $('#pVal'), eW = $('#etaWrite');
    if (p0V) p0V.placeholder = (problem.type==='P0') ? '?' : formatComma(problem.P0.v);
    if (pV)  pV.placeholder  = (problem.type==='P')  ? '?' : formatComma(problem.P.v);
    if (eW)  eW.placeholder  = (problem.type==='eta')? '?' : String(problem.eta);

    // LIVE-CHECKING zápisu
    const checkWrite = ()=>{
      const box = $('#writeMsg'); if (!box) return;
      let ok=true, msg=[];

      // P₀
      const vP0 = toNumber(p0V && p0V.value);
      const uP0 = p0U && p0U.value || 'W';
      if (problem.type!=='P0'){
        const want = problem.P0.v * F[problem.P0.u];
        const got  = (isNaN(vP0)?NaN:vP0) * F[uP0];
        if (!(isFinite(got) && Math.abs(got-want) <= Math.max(1e-6, want*0.001))) { ok=false; msg.push('P₀ neodpovídá zadání.'); }
      } else if (p0V && p0V.value.trim()!==''){ ok=false; msg.push('P₀ v zadání chybí – nevyplňuj.'); }

      // P
      const vP  = toNumber(pV && pV.value);
      const uP  = pU && pU.value || 'W';
      if (problem.type!=='P'){
        const want = problem.P.v * F[problem.P.u];
        const got  = (isNaN(vP)?NaN:vP) * F[uP];
        if (!(isFinite(got) && Math.abs(got-want) <= Math.max(1e-6, want*0.001))) { ok=false; msg.push('P neodpovídá zadání.'); }
      } else if (pV && pV.value.trim()!==''){ ok=false; msg.push('P v zadání chybí – nevyplňuj.'); }

      // η
      const vEta = toNumber(eW && eW.value);
      if (problem.type!=='eta'){
        if (!(isFinite(vEta) && Math.abs(vEta - problem.eta) <= Math.max(1e-6, problem.eta*0.001))) { ok=false; msg.push('η neodpovídá zadání.'); }
      } else if (eW && eW.value.trim()!==''){ ok=false; msg.push('η v zadání chybí – nevyplňuj.'); }

      box.innerHTML = ok ? '<span class="success">✅ Zápis odpovídá zadání.</span>'
                         : '<span class="error">❌ '+msg.join(' ')+'</span>';

      // vizuální zpětná vazba polí
      [p0V,pV,eW].forEach((el)=>{ if(!el) return; el.classList.remove('live-ok','live-bad'); });
      const mark = (el, good)=>{ if(!el) return; el.classList.add(good?'live-ok':'live-bad'); };
      if (problem.type!=='P0') mark(p0V, msg.every(m=>!m.includes('P₀')));
      if (problem.type!=='P')  mark(pV,  msg.every(m=>!m.includes('P neodp')));
      if (problem.type!=='eta')mark(eW,  msg.every(m=>!m.includes('η neodp')));

      return ok;
    };
    ['input','change','keyup'].forEach(ev=>{
      [p0V,p0U,pV,pU,eW].forEach(el=> el && el.addEventListener(ev, checkWrite));
    });
    checkWrite();
    return;
  }

  if (step===2){
    // Výpočet — shrnutí zápisu + vzorec + vkládací tlačítka symbolů
    let inner='';
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

    // vkládání symbolů
    document.querySelectorAll('.inline-buttons button').forEach(b=>{
      b.addEventListener('click', ()=>{
        const f = $('#formula'); if(!f) return;
        const ins = b.getAttribute('data-ins') || '';
        const pos = f.selectionStart || f.value.length;
        f.value = (f.value.slice(0,pos) + ins + f.value.slice(pos));
        f.focus(); f.selectionStart = f.selectionEnd = pos + ins.length;
        liveFormulaCheck();
      });
    });

    // Pokud žák napíše "eta", automaticky nahradíme za η
    const formulaEl = $('#formula');
    if (formulaEl){
      formulaEl.addEventListener('input', ()=>{
        formulaEl.value = formulaEl.value.replace(/(^|[^a-zA-Z])eta([^a-zA-Z]|$)/g, '$1η$2');
        liveFormulaCheck();
      });
    }
    const liveFormulaCheck = ()=>{
      const box = $('#calcMsg'); if(!box) return;
      const f = formulaEl ? formulaEl.value.replace(/\s+/g,'') : '';
      let ok=false;
      if (problem.type==='eta'){
        ok = (f === 'η=P/P₀' || f === 'η=P:P₀');
      } else if (problem.type==='P'){
        ok = (f === 'P=η·P₀' || f === 'P=(η:100)·P₀' || f === 'P=η*P₀');
      } else {
        ok = (f === 'P₀=P/η' || f === 'P₀=P:(η:100)');
      }
      box.innerHTML = ok ? '<span class="success">✅ Vzorec v pořádku.</span>' :
                           '<span class="error">❌ Zapiš správný vzorec (viz nápověda).</span>';
      return ok;
    };
    liveFormulaCheck();
    return;
  }

  if (step===3){
    // Předgenerovaná odpověď + shrnutí zápisu/výpočtu; žák doplní výsledek
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

// —————————————————— Kontroly kroků ——————————————————
function check(){
  if (step===1){
    const p0v=$('#p0Val'), p0u=$('#p0Unit');
    const pv=$('#pVal'),   pu=$('#pUnit');
    const et=$('#etaWrite');
    const box=$('#writeMsg'); if (!box) return false;

    let ok=true, msg=[];

    // P₀
    if (problem.type!=='P0'){
      const want = problem.P0.v * F[problem.P0.u];
      const got  = toNumber(p0v && p0v.value) * F[(p0u && p0u.value) || 'W'];
      if (!(isFinite(got) && Math.abs(got-want) <= Math.max(1e-6, want*0.001))) { ok=false; msg.push('P₀ neodpovídá zadání.'); }
    } else if (p0v && p0v.value.trim()!==''){ ok=false; msg.push('P₀ v zadání chybí – v zápisu ho nevyplňuj.'); }

    // P
    if (problem.type!=='P'){
      const want = problem.P.v * F[problem.P.u];
      const got  = toNumber(pv && pv.value) * F[(pu && pu.value) || 'W'];
      if (!(isFinite(got) && Math.abs(got-want) <= Math.max(1e-6, want*0.001))) { ok=false; msg.push('P neodpovídá zadání.'); }
    } else if (pv && pv.value.trim()!==''){ ok=false; msg.push('P v zadání chybí – v zápisu ho nevyplňuj.'); }

    // η
    if (problem.type!=='eta'){
      const got = toNumber(et && et.value);
      if (!(isFinite(got) && Math.abs(got - problem.eta) <= Math.max(1e-6, problem.eta*0.001))) { ok=false; msg.push('η neodpovídá zadání.'); }
    } else if (et && et.value.trim()!==''){ ok=false; msg.push('η v zadání chybí – v zápisu ji nevyplňuj.'); }

    box.innerHTML = ok ? '<span class="success">✅ Zápis odpovídá zadání.</span>'
                       : '<span class="error">❌ '+msg.join(' ')+'</span>';
    return ok;
  }

  if (step===2){
    const tol=0.005; const box=$('#calcMsg'); if(!box) return false;
    let ok=false, acc=0, msg='';

    // kontrola vzorce
    const fEl = $('#formula'); const f = fEl ? fEl.value.replace(/\s+/g,'') : '';
    let goodFormula=false;
    if (problem.type==='eta') goodFormula = (f==='η=P/P₀' || f==='η=P:P₀');
    if (problem.type==='P')   goodFormula = (f==='P=η·P₀' || f==='P=(η:100)·P₀' || f==='P=η*P₀');
    if (problem.type==='P0')  goodFormula = (f==='P₀=P/η' || f==='P₀=P:(η:100)');

    // výsledky
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
    return ok;
  }

  if (step===3){
    const ans = $('#ansVal'), unit = $('#ansUnit'), box = $('#ansMsg'); if (!ans || !unit || !box) return false;
    const txt = (ans.value||'').trim();
    const hasNum = txt !== '' && isFinite(toNumber(txt));
    const valueStr = (unit.value === '%')
      ? formatComma(problem.eta) + ' %'
      : (problem.type==='P') ? fmtW(problem.PW) : fmtW(problem.P0W);

    box.innerHTML = hasNum
      ? `<span class="success">✅ Odpověď dopsána. Vzor: <i>${valueStr}</i></span>`
      : `<span class="error">❌ Doplň číselný výsledek (s desetinnou čárkou) a zvol jednotku.</span>`;
    return hasNum;
  }
  return true;
}

// —————————————————— Ovládání ——————————————————
function wire(){
  const on = (id, fn)=>{ const el = $(id); if (el) el.addEventListener('click', fn); };
  on('btnNew',  ()=>{ problem = makeProblem(); step=0; render(); });
  on('btnReset',()=>{ stats = {ok:0,err:0,accSum:0,accN:0}; setStats(); problem = makeProblem(); step=0; render(); });
  on('btnBack', ()=>{ if(step>0){ step--; render(); }});
  on('btnNext', ()=>{ if(step<3){ step++; render(); }});
  on('btnCheck',()=>{ check(); });
}

// —————————————————— Start ——————————————————
(function start(){
  problem = makeProblem();
  render();
  setStats();
  wire();
})();
