// script.js — MVP pro P0/P/η s úpravami kroků a „gatingem“
"use strict";

/*=============================*
 * Pomocné funkce a konstanty  *
 *=============================*/
const F = { W: 1, kW: 1000, MW: 1_000_000 };
const DIFF = {
  lehka:    { p0W: [  50,   500], eta: [60, 95] },
  normalni: { p0W: [ 500, 50000], eta: [35, 90] },
};
let difficulty = "lehka"; // lze přepnout přes <select id="difficulty">

const toNum = (s) => s==null ? NaN : Number(String(s).trim().replace(/\s+/g,"").replace(",",".")); 
const fmtComma = (x, d=3) => Number(x).toFixed(d).replace(/\.?0+$/,"").replace(".",",");
const pick = (min,max)=> min + Math.random()*(max-min);
const pickInt = (min,max)=> Math.round(pick(min,max));
const choose = (arr)=> arr[Math.floor(Math.random()*arr.length)];
const unitize = (w)=> w>=1_000_000? {v:w/1_000_000,u:"MW"} : w>=1000? {v:w/1000,u:"kW"} : {v:w,u:"W"};
const fmtW = (w)=>{ const u=unitize(w); return `${fmtComma(u.v)} ${u.u}`; };

/*=============================*
 * Data                        *
 *=============================*/
const DEVICES = [
  { id:"zarovka", name:"Žárovka",      p0W:[5,150],                 eta:[5,25]  },
  { id:"ledka",   name:"LED žárovka",  p0W:[3,30],                  eta:[25,45] },
  { id:"motor",   name:"Elektromotor", p0W:[5_000,500_000],         eta:[60,95] },
  { id:"cerpadlo",name:"Čerpadlo",     p0W:[500,50_000],            eta:[40,80] },
  { id:"turbina", name:"Turbína",      p0W:[1_000_000,50_000_000],  eta:[30,60] },
];

/*=============================*
 * Stav                        *
 *=============================*/
let step = 0;        // 0..3
let problem = null;
let stats = { ok:0, err:0, accSum:0, accN:0 };
let gates = { writeOk:false, calcOk:false }; // „zámky“ na Next

/*=============================*
 * DOM binding                 *
 *=============================*/
const E = {};
function bindElements(){
  E.zadaniText = document.getElementById("zadaniText");
  E.knownBox   = document.getElementById("knownBox");
  E.content    = document.getElementById("content");

  E.btnBack    = document.getElementById("btnBack");
  E.btnNext    = document.getElementById("btnNext");
  E.btnCheck   = document.getElementById("btnCheck");
  E.btnNew     = document.getElementById("btnNew");
  E.btnReset   = document.getElementById("btnReset");

  E.okCount = document.getElementById("okCount");
  E.errCount= document.getElementById("errCount");
  E.avgAcc  = document.getElementById("avgAcc");

  // volitelný přepínač obtížnosti (když nebude v HTML, nic se neděje)
  E.diffSel   = document.getElementById("difficulty");
}

/*=============================*
 * Generování příkladu         *
 *=============================*/
function makeProblem(){
  const r = DIFF[difficulty] || DIFF.lehka;
  const dev = choose(DEVICES);
  const type = choose(["eta","P","P0"]);
  const P0W  = pick(r.p0W[0], r.p0W[1]);
  const eta  = pickInt(r.eta[0], r.eta[1]);
  const PW   = P0W * (eta/100);
  const P0   = unitize(P0W);
  const P    = unitize(PW);

  let text="", ask="";
  if (type==="eta"){
    text = `${dev.name} odebírá příkon P₀ = ${fmtComma(P0.v)} ${P0.u}. Užitečný výkon je P = ${fmtComma(P.v)} ${P.u}.`;
    ask  = "Urči účinnost zařízení η v procentech.";
  } else if (type==="P"){
    text = `${dev.name} pracuje s účinností η = ${eta} %. Odebírá příkon P₀ = ${fmtComma(P0.v)} ${P0.u}.`;
    ask  = "Urči užitečný výkon P.";
  } else {
    text = `${dev.name} má účinnost η = ${eta} %. Dodává užitečný výkon P = ${fmtComma(P.v)} ${P.u}.`;
    ask  = "Urči celkový příkon P₀.";
  }
  return { device:dev, type, P0W, PW, eta, P0, P, text, ask };
}

/*=============================*
 * Levý panel                  *
 *=============================*/
function renderAside(){
  if (!E.zadaniText || !E.knownBox) return;
  if (!problem){ E.zadaniText.textContent=""; E.knownBox.textContent=""; return; }

  const known = [
    (problem.type!=="P0") ? `P₀ = ${fmtComma(problem.P0.v)} ${problem.P0.u}` : `P₀ = ?`,
    (problem.type!=="P")  ? `P  = ${fmtComma(problem.P.v)} ${problem.P.u}`   : `P  = ?`,
    (problem.type!=="eta")? `η  = ${problem.eta} %`                           : `η  = ?`,
  ].join(" • ");
  E.zadaniText.innerHTML = `<p>${problem.text}</p><p><b>Úkol:</b> ${problem.ask}</p>`;
  E.knownBox.innerHTML   = `<b>Dané:</b> ${known}`;
}

/*=============================*
 * Gating „Next“               *
 *=============================*/
function toggleNext(){
  const locked =
    (step===1 && !gates.writeOk) ||
    (step===2 && !gates.calcOk);
  if (E.btnNext) E.btnNext.disabled = locked || step===3;
}

/*=============================*
 * Pomocné rendery polí        *
 *=============================*/
function rowWrite(id, label, placeholder, wantUnit = true){
  const unit = wantUnit ? `
    <select id="${id}Unit" class="input">
      <option value="">Vyber</option>
      <option>W</option><option>kW</option><option>MW</option>
    </select>` : "";
  return `
  <div class="row wrap gap" style="align-items:center">
    <label class="small" style="min-width:7rem">${label}</label>
    <input id="${id}Val" class="input" type="text" inputmode="decimal" placeholder="${placeholder}">
    ${unit}
    <label class="small" style="display:inline-flex;gap:.4rem;align-items:center">
      <input id="${id}Chk" type="checkbox"> hledaná veličina
    </label>
  </div>`;
}

/*=============================*
 * Render kroků                *
 *=============================*/
function render(){
  renderAside();
  if (!E.content) return;
  const S = (html)=> (E.content.innerHTML = html);

  // highlight kroku
  document.querySelectorAll(".steps .step").forEach((el,i)=>{
    el.classList.toggle("active", i===step);
  });

  // Zobrazuj/skrývej tlačítko Zkontrolovat dle kroku (#7)
  if (E.btnCheck) E.btnCheck.style.display = (step===3 ? "" : "none");

  if (E.btnBack) E.btnBack.disabled = step===0;
  toggleNext();

  if (step===0){
    S(`<h2>1. Zadání</h2><p class="small muted">Prostuduj zadání vlevo. Pokračuj na <b>Zápis</b>.</p>`);
    return;
  }

  if (step===1){
    // Zápis (#2, #3, #4)
    S(`
      <h2>2. Zápis</h2>
      ${rowWrite("p0",  "P₀ (příkon)",        "111", true)}
      ${rowWrite("p",   "P (užitečný výkon)", "111", true)}
      ${rowWrite("eta", "η (účinnost v %)",   "např. 75", false)}
      <div id="writeMsg" class="small muted"></div>
    `);

    const W = {
      p0:  { chk: document.getElementById("p0Chk"),  val: document.getElementById("p0Val"),  unit: document.getElementById("p0Unit") },
      p:   { chk: document.getElementById("pChk"),   val: document.getElementById("pVal"),   unit: document.getElementById("pUnit")  },
      eta: { chk: document.getElementById("etaChk"), val: document.getElementById("etaVal"), unit: null }
    };

    function setRowState(row){
      const unk = row.chk.checked;
      row.val.disabled = unk;
      row.val.placeholder = unk ? "?" : (row.val.placeholder || "111");
      if (row.unit){ row.unit.disabled = unk; if (unk) row.unit.value=""; }
      if (unk){ row.val.value = ""; }
    }

    function validateWrite(){
      const box = document.getElementById("writeMsg");
      const unknown = ["p0","p","eta"].filter(k => W[k].chk && W[k].chk.checked);
      if (unknown.length !== 1){
        gates.writeOk = false;
        box.textContent = "Zaškrtni přesně jednu hledanou veličinu.";
        toggleNext(); return;
      }
      const okKnown = ["p0","p","eta"].every(k=>{
        const r = W[k];
        if (r.chk.checked) return true;
        const v = toNum(r.val.value);
        if (!isFinite(v)) return false;
        if (r.unit && !["W","kW","MW"].includes(r.unit.value)) return false;
        return true;
      });
      gates.writeOk = okKnown;
      box.textContent = okKnown ? "Zápis v pořádku." : "Doplň číselné hodnoty a zvol jednotky.";
      toggleNext();
    }

    // default jednotky (jen jako nabídka – nic nevyplňuju, viz #4)
    // eventy
    ["p0","p","eta"].forEach(k=>{
      const r = W[k];
      if (r.chk)  r.chk.addEventListener("change", ()=>{ setRowState(r); validateWrite(); });
      if (r.val)  r.val.addEventListener("input", validateWrite);
      if (r.unit) r.unit.addEventListener("change", validateWrite);
      if (r.chk)  setRowState(r);
    });
    validateWrite();
    return;
  }

  if (step===2){
    // Výpočet (#5, #6)

    // ZÁPIS PO ŘÁDCÍCH
    const zapisLines = [
      (problem.type!=="P0") ? `P₀ = ${fmtComma(problem.P0.v)} ${problem.P0.u}` : "P₀ = ?",
      (problem.type!=="P")  ? `P = ${fmtComma(problem.P.v)} ${problem.P.u}`    : "P = ?",
      (problem.type!=="eta")? `η = ${problem.eta} %`                           : "η = ?",
    ];
    const zapisHtml = zapisLines.map(l => `<div>${l}</div>`).join("");

    const formulaHint =
      problem.type==="eta" ? 'η = P / P₀ (povoleno i "η = P : P₀")' :
      problem.type==="P"   ? 'P = η · P₀ (η napiš jako 0,75) nebo "P = (η : 100) · P₀"' :
                             'P₀ = P / (η : 100) nebo "P₀ = P : (η : 100)"';

    let inner = `
      <h2>3. Výpočet</h2>
      <div class="badge wip">
        <b>Zápis:</b><br>
        ${zapisHtml}
      </div>
      <hr>

      <!-- TLAČÍTKA PRO VKLÁDÁNÍ SYMBOLŮ -->
      <div class="inline-buttons" style="margin-bottom:6px">
        <button type="button" data-ins="η">η</button>
        <button type="button" data-ins="P">P</button>
        <button type="button" data-ins="P₀">P₀</button>
        <button type="button" data-ins=" · ">·</button>
        <button type="button" data-ins=" / ">/</button>
        <button type="button" data-ins=" : ">:</button>
        <button type="button" data-ins=" = ">=</button>
      </div>

      <label>Zapiš vzorec</label>
      <input id="formula" class="input" type="text" placeholder="${formulaHint}">
      <label>Dosaď do vzorce</label>
      <input id="subst" class="input" type="text" placeholder="např. η = P / P₀">
      <hr>
    `;

    if (problem.type==="eta"){
      inner += `
        <label>Výsledek — η (%)</label>
        <input id="etaVal" class="input" type="text" inputmode="decimal" placeholder="např. 75">
      `;
    } else if (problem.type==="P"){
      inner += `
        <label>Výsledek — P</label>
        <div class="row gap">
          <input id="pCalc" class="input" type="text" inputmode="decimal" placeholder="hodnota">
          <select id="pCalcUnit" class="input"><option>W</option><option>kW</option><option>MW</option></select>
        </div>
      `;
    } else {
      inner += `
        <label>Výsledek — P₀</label>
        <div class="row gap">
          <input id="p0Calc" class="input" type="text" inputmode="decimal" placeholder="hodnota">
          <select id="p0CalcUnit" class="input"><option>W</option><option>kW</option><option>MW</option></select>
        </div>
      `;
    }

    inner += `<div id="calcMsg" class="small muted"></div>`;
    S(inner);

    // ====== Vkládací tlačítka (η, P, P₀, …) ======
    const formulaInput = document.getElementById("formula");
    const substInput   = document.getElementById("subst");

    function targetInput() {
      // pokud je fokus v "Dosaď do vzorce", vkládáme tam; jinak do "Zapiš vzorec"
      if (document.activeElement === substInput && substInput) return substInput;
      return formulaInput;
    }

    document.querySelectorAll(".inline-buttons button").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = targetInput();
        if (!input) return;
        const ins = btn.getAttribute("data-ins") || "";
        const start = input.selectionStart ?? input.value.length;
        const end   = input.selectionEnd ?? input.value.length;
        input.value = input.value.slice(0,start) + ins + input.value.slice(end);
        const pos = start + ins.length;
        input.focus();
        input.selectionStart = input.selectionEnd = pos;
      });
    });

    // ====== live-check pro odemčení Next (zbytek kódu zůstává stejný) ======
    function validateCalc() {
      let ok = false;
      if (problem.type==="eta"){
        const v = toNum(document.getElementById("etaVal")?.value);
        ok = isFinite(v);
      } else if (problem.type==="P"){
        const v = toNum(document.getElementById("pCalc")?.value);
        const u = document.getElementById("pCalcUnit")?.value;
        ok = isFinite(v) && ["W","kW","MW"].includes(u||"");
      } else {
        const v = toNum(document.getElementById("p0Calc")?.value);
        const u = document.getElementById("p0CalcUnit")?.value;
        ok = isFinite(v) && ["W","kW","MW"].includes(u||"");
      }
      gates.calcOk = !!ok;
      toggleNext();
    }

    ["input","change"].forEach(ev=>{
      E.content.querySelectorAll("input,select").forEach(el=>{
        el.addEventListener(ev, validateCalc);
      });
    });
    validateCalc();
    return;
  }


  if (step===3){
    // Odpověď (Zkontrolovat je tady – #7)
    const zapis = [
      (problem.type!=="P0") ? `P₀ = ${fmtComma(problem.P0.v)} ${problem.P0.u}` : "P₀ = ?",
      (problem.type!=="P")  ? `P = ${fmtComma(problem.P.v)} ${problem.P.u}`    : "P = ?",
      (problem.type!=="eta")? `η = ${problem.eta} %`                           : "η = ?",
    ].join(" • ");

    const template =
      problem.type==="eta" ? `Účinnost ${problem.device.name.toLowerCase()} je __ %.` :
      problem.type==="P"   ? `Užitečný výkon zařízení je __.` :
                             `Celkový příkon zařízení je __.`;
    const unitSuggestion = (problem.type==="eta" ? "%" : problem.type==="P" ? problem.P.u : problem.P0.u);

    S(`
      <h2>4. Odpověď</h2>
      <div class="badge ok"><b>Zápis:</b> ${zapis}</div>
      <label>Šablona odpovědi</label>
      <div class="note">${template.replace("__", '<b id="placeholder">[doplň výsledek]</b>')}</div>
      <div class="row gap" style="margin-top:8px">
        <input id="ansVal" class="input" type="text" inputmode="decimal" placeholder="výsledek">
        <select id="ansUnit" class="input"><option>%</option><option>W</option><option>kW</option><option>MW</option></select>
      </div>
      <div id="ansMsg" class="small"></div>
    `);
    const ansUnit = document.getElementById("ansUnit");
    if (ansUnit) ansUnit.value = unitSuggestion;
    toggleNext();
    return;
  }
}

/*=============================*
 * Kontroly (tlačítko)         *
 *=============================*/
function doCheck(){
  if (step!==3) return; // kontrolujeme až v Odpovědi

  const box  = document.getElementById("ansMsg");
  const ans  = document.getElementById("ansVal");
  const unit = document.getElementById("ansUnit");
  if (!box || !ans || !unit) return;

  const txt = (ans.value||"").trim();
  const numeric = isFinite(toNum(txt));
  const wantStr = (unit.value==="%") ? `${fmtComma(problem.eta)} %`
                 : (problem.type==="P") ? fmtW(problem.PW) : fmtW(problem.P0W);

  box.innerHTML = numeric
    ? `<span class="success">✅ Odpověď dopsána. Vzor: <i>${wantStr}</i></span>`
    : `<span class="error">❌ Doplň číselný výsledek a vyber správnou jednotku.</span>`;
}

/*=============================*
 * Statistiky                  *
 *=============================*/
function setStats(){
  if (E.okCount)  E.okCount.textContent  = String(stats.ok);
  if (E.errCount) E.errCount.textContent = String(stats.err);
  if (E.avgAcc)   E.avgAcc.textContent   = stats.accN ? fmtComma(stats.accSum/stats.accN,1)+" %" : "–";
}

/*=============================*
 * Ovládání                    *
 *=============================*/
function newTask(resetStats=false){
  if (resetStats) { stats={ok:0,err:0,accSum:0,accN:0}; setStats(); }
  problem = makeProblem();
  step = 0;
  gates = { writeOk:false, calcOk:false };
  render();
}

function wire(){
  if (E.btnBack)  E.btnBack.addEventListener("click", ()=>{ if (step>0) step--; render(); });
  if (E.btnNext)  E.btnNext.addEventListener("click", ()=>{ if (step<3) step++; render(); });
  if (E.btnCheck) E.btnCheck.addEventListener("click", doCheck);
  if (E.btnNew)   E.btnNew.addEventListener("click", ()=> newTask(false));
  if (E.btnReset) E.btnReset.addEventListener("click", ()=> newTask(true));

  if (E.diffSel){
    E.diffSel.value = difficulty;
    E.diffSel.addEventListener("change", ()=>{
      difficulty = E.diffSel.value || "lehka";
      newTask(false);
    });
  }
}

/*=============================*
 * Start                       *
 *=============================*/
document.addEventListener("DOMContentLoaded", ()=>{
  bindElements();
  const y = document.getElementById("year"); if (y) y.textContent = String(new Date().getFullYear());
  setStats();
  wire();
  // #1 – vygenerovat hned první příklad
  newTask(false);
});
