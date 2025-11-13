// script.js — P₀/P/η cvičebnice
"use strict";

// ---------- Pomocné ----------
const F = { W: 1, kW: 1000, MW: 1_000_000 };

// obtížnosti (zatím provizorní)
const DIFF = {
  lehka:    { p0W: [   50,   500],   eta: [60, 95] },
  normalni: { p0W: [  500, 50000],   eta: [35, 90] },
};

let difficulty = "lehka";

// přísný průchod kroky
const STRICT_FLOW = true;
let gates = { writeOk: false, calcOk: false };

const toNum = (s) => {
  if (s == null) return NaN;
  return Number(String(s).trim().replace(/\s+/g, "").replace(",", "."));
};
const fmtComma = (x, d = 3) =>
  Number(x).toFixed(d).replace(/\.?0+$/, "").replace(".", ",");

const pick = (min, max) => min + Math.random() * (max - min);
const pickInt = (min, max) => Math.round(pick(min, max));
const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
const unitize = (w) =>
  w >= 1_000_000
    ? { v: w / 1_000_000, u: "MW" }
    : w >= 1000
    ? { v: w / 1000, u: "kW" }
    : { v: w, u: "W" };
const fmtW = (w) => {
  const u = unitize(w);
  return `${fmtComma(u.v)} ${u.u}`;
};

// reálné rozsahy
const DEVICES = [
  { id: "zarovka", name: "Žárovka",      p0W: [5, 150],               eta: [5, 25] },
  { id: "ledka",   name: "LED žárovka",  p0W: [3, 30],                eta: [25, 45] },
  { id: "motor",   name: "Elektromotor", p0W: [5_000, 500_000],       eta: [60, 95] },
  { id: "cerpadlo",name: "Čerpadlo",     p0W: [500, 50_000],          eta: [40, 80] },
  { id: "turbina", name: "Turbína",      p0W: [1_000_000, 50_000_000],eta: [30, 60] },
];

// ---------- Stav ----------
let step = 0; // 0..3
let problem = null;
let stats = { ok: 0, err: 0, accSum: 0, accN: 0 };

// ---------- Generování úlohy ----------
function makeProblem() {
  const ranges = DIFF[difficulty] || DIFF.lehka;
  const dev    = choose(DEVICES);
  const type   = choose(["eta", "P", "P0"]); // neznámá veličina

  const P0W = pick(ranges.p0W[0], ranges.p0W[1]);
  const eta = pickInt(ranges.eta[0], ranges.eta[1]);
  const PW  = P0W * (eta / 100);

  const P0 = unitize(P0W);
  const P  = unitize(PW);

  let text = "", ask = "";

  if (type === "eta") {
    text = `${dev.name} odebírá příkon P₀ = ${fmtComma(P0.v)} ${P0.u}. Užitečný výkon je P = ${fmtComma(P.v)} ${P.u}.`;
    ask  = "Urči účinnost zařízení η v procentech.";
  } else if (type === "P") {
    text = `${dev.name} pracuje s účinností η = ${eta} %. Odebírá příkon P₀ = ${fmtComma(P0.v)} ${P0.u}.`;
    ask  = "Urči užitečný výkon P.";
  } else {
    text = `${dev.name} má účinnost η = ${eta} %. Dodává užitečný výkon P = ${fmtComma(P.v)} ${P.u}.`;
    ask  = "Urči celkový příkon P₀.";
  }

  return { device: dev, type, P0W, PW, eta, P0, P, text, ask };
}

// ---------- UI elementy ----------
let E = {};
function bindElements() {
  E.zadaniText = document.getElementById("zadaniText");
  E.knownBox   = document.getElementById("knownBox");
  E.content    = document.getElementById("content");

  E.btnBack  = document.getElementById("btnBack");
  E.btnNext  = document.getElementById("btnNext");
  E.btnCheck = document.getElementById("btnCheck");
  E.btnNew   = document.getElementById("btnNew");
  E.btnReset = document.getElementById("btnReset");

  E.okCount = document.getElementById("okCount");
  E.errCount = document.getElementById("errCount");
  E.avgAcc = document.getElementById("avgAcc");
}

// ---------- Levý panel ----------
function renderAside() {
  if (!E.zadaniText || !E.knownBox) return;
  if (!problem) {
    E.zadaniText.textContent = "";
    E.knownBox.textContent   = "";
    return;
  }
  const known = [
    problem.type !== "P0"
      ? `P₀ = ${fmtComma(problem.P0.v)} ${problem.P0.u}`
      : "P₀ = ?",
    problem.type !== "P"
      ? `P = ${fmtComma(problem.P.v)} ${problem.P.u}`
      : "P = ?",
    problem.type !== "eta"
      ? `η = ${problem.eta} %`
      : "η = ?",
  ].join(" • ");

  E.zadaniText.innerHTML = `<p>${problem.text}</p><p><b>Úkol:</b> ${problem.ask}</p>`;
  E.knownBox.innerHTML   = `<b>Dané:</b> ${known}`;
}

// řádek pro zápis (step 1)
function writeRow(id, label, placeholder, showUnit = true) {
  const unitSelect = showUnit
    ? `<select id="${id}Unit" class="input">
         <option value="">Vyber</option>
         <option>W</option><option>kW</option><option>MW</option>
       </select>`
    : "";

  return `
    <div class="row wrap gap" style="align-items:center">
      <label class="small" style="min-width:7rem">${label}</label>
      <input id="${id}Val" class="input" type="text" inputmode="decimal" placeholder="${placeholder}">
      ${unitSelect}
      <label class="small" style="display:inline-flex;gap:.4rem;align-items:center">
        <input id="${id}Chk" type="checkbox"> hledaná veličina
      </label>
    </div>
  `;
}

// ---------- Toggle Next ----------
function toggleNext() {
  if (!STRICT_FLOW || !E.btnNext) return;
  let allow = true;
  if (step === 1) allow = gates.writeOk;
  else if (step === 2) allow = gates.calcOk;
  E.btnNext.disabled = !allow;
}

// ---------- Render kroků ----------
function render() {
  renderAside();
  if (!E.content) return;
  const S = (html) => (E.content.innerHTML = html);

  document.querySelectorAll(".steps .step").forEach((el, i) => {
    el.classList.toggle("active", i === step);
  });

  if (E.btnBack) E.btnBack.disabled = step === 0;
  if (E.btnNext) E.btnNext.disabled = step === 3 && !STRICT_FLOW;

  // krok 0 – jen info
  if (step === 0) {
    gates.writeOk = false;
    gates.calcOk  = false;
    S(`
      <h2>1. Zadání</h2>
      <p class="small muted">Prostuduj zadání vlevo. Pokračuj na <b>Zápis</b>.</p>
    `);
    toggleNext();
    return;
  }

  // krok 1 – ZÁPIS
  if (step === 1) {
    gates.calcOk = false;
    S(`
      <h2>2. Zápis</h2>
      ${writeRow("p0",  "P₀ (příkon)",        "111")}
      ${writeRow("p",   "P (užitečný výkon)", "111")}
      ${writeRow("eta", "η (účinnost v %)",   "např. 75", false)}
      <div id="writeMsg" class="small muted"></div>
    `);

    const W = {
      p0:  { chk: document.getElementById("p0Chk"),  val: document.getElementById("p0Val"),  unit: document.getElementById("p0Unit") },
      p:   { chk: document.getElementById("pChk"),   val: document.getElementById("pVal"),   unit: document.getElementById("pUnit") },
      eta: { chk: document.getElementById("etaChk"), val: document.getElementById("etaVal"), unit: null },
    };

    function setRowState(row, defPlaceholder) {
      const isUnknown = row.chk && row.chk.checked;
      if (!row.val) return;
      if (isUnknown) {
        row.val.value = "";
        row.val.disabled = true;
        row.val.placeholder = "?";
        if (row.unit) {
          row.unit.value = "";
          row.unit.disabled = true;
        }
      } else {
        row.val.disabled = false;
        row.val.placeholder = defPlaceholder;
        if (row.unit) row.unit.disabled = false;
      }
    }

    setRowState(W.p0, "111");
    setRowState(W.p, "111");
    setRowState(W.eta, "např. 75");

    function validateWrite() {
      const box = document.getElementById("writeMsg");
      if (!box) return;

      const unknown = ["p0", "p", "eta"].filter((k) => W[k].chk && W[k].chk.checked);
      if (unknown.length !== 1) {
        gates.writeOk = false;
        box.textContent = "Zaškrtni přesně jednu hledanou veličinu.";
        toggleNext();
        return;
      }

      let okKnown = true;
      ["p0", "p", "eta"].forEach((k) => {
        const r = W[k];
        if (!r.val) return;
        if (r.chk && r.chk.checked) return; // hledaná
        const v = toNum(r.val.value);
        if (!isFinite(v)) okKnown = false;
        if (r.unit) {
          const u = r.unit.value;
          if (!["W", "kW", "MW"].includes(u)) okKnown = false;
        }
      });

      gates.writeOk = okKnown;
      box.textContent = okKnown
        ? "Zápis formálně v pořádku. (Správnost se vyhodnotí později.)"
        : "Doplň číselné hodnoty a jednotky.";
      toggleNext();
    }

    ["p0", "p", "eta"].forEach((k) => {
      const r = W[k];
      if (r.chk)  r.chk.addEventListener("change", () => { setRowState(r, k==="eta" ? "např. 75" : "111"); validateWrite(); });
      if (r.val)  r.val.addEventListener("input", validateWrite);
      if (r.unit) r.unit.addEventListener("change", validateWrite);
    });

    validateWrite();
    return;
  }

  // krok 2 – VÝPOČET
  if (step === 2) {
    const zapisLines = [
      problem.type !== "P0"
        ? `P₀ = ${fmtComma(problem.P0.v)} ${problem.P0.u}`
        : "P₀ = ?",
      problem.type !== "P"
        ? `P = ${fmtComma(problem.P.v)} ${problem.P.u}`
        : "P = ?",
      problem.type !== "eta"
        ? `η = ${problem.eta} %`
        : "η = ?",
    ];
    const zapisHtml = zapisLines.join("<br>");

    const formulaHint =
      problem.type === "eta"
        ? 'η = P / P₀ (povoleno i „η = P : P₀“)'
        : problem.type === "P"
        ? 'P = η · P₀ (η napiš jako 0,75) nebo „P = (η : 100) · P₀“'
        : 'P₀ = P / (η : 100) nebo „P₀ = P : (η : 100)“';

    let inner = `
      <h2>3. Výpočet</h2>
      <div class="badge wip">
        <b>Zápis:</b><br>${zapisHtml}
      </div>
      <hr>
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

    if (problem.type === "eta") {
      inner += `
        <label>Výsledek — η (%)</label>
        <input id="eta" class="input" type="text" inputmode="decimal" placeholder="např. 75">
      `;
    } else if (problem.type === "P") {
      inner += `
        <label>Výsledek — P</label>
        <div class="row gap">
          <input id="pCalc" class="input" type="text" inputmode="decimal" placeholder="hodnota">
          <select id="pCalcUnit" class="input">
            <option value="">Vyber</option>
            <option>W</option><option>kW</option><option>MW</option>
          </select>
        </div>
      `;
    } else {
      inner += `
        <label>Výsledek — P₀</label>
        <div class="row gap">
          <input id="p0Calc" class="input" type="text" inputmode="decimal" placeholder="hodnota">
          <select id="p0CalcUnit" class="input">
            <option value="">Vyber</option>
            <option>W</option><option>kW</option><option>MW</option>
          </select>
        </div>
      `;
    }

    inner += `<div id="calcMsg" class="small muted"></div>`;
    S(inner);

    // vložení symbolů do aktivního pole (formula/subst)
    const formulaInput = document.getElementById("formula");
    document.querySelectorAll(".inline-buttons button").forEach((btn) => {
      btn.addEventListener("click", () => {
        let target = document.activeElement;
        if (!(target && (target.id === "formula" || target.id === "subst"))) {
          target = formulaInput;
        }
        if (!target) return;
        const ins = btn.getAttribute("data-ins") || "";
        const start = target.selectionStart ?? target.value.length;
        const end   = target.selectionEnd   ?? target.value.length;
        target.value = target.value.slice(0, start) + ins + target.value.slice(end);
        const pos = start + ins.length;
        target.focus();
        target.selectionStart = target.selectionEnd = pos;
      });
    });

    if (document.getElementById("pCalcUnit"))
      document.getElementById("pCalcUnit").value = "";
    if (document.getElementById("p0CalcUnit"))
      document.getElementById("p0CalcUnit").value = "";

    function validateCalc() {
      let ok = false;
      if (problem.type === "eta") {
        const v = toNum(document.getElementById("eta")?.value);
        ok = isFinite(v);
      } else if (problem.type === "P") {
        const v = toNum(document.getElementById("pCalc")?.value);
        const u = document.getElementById("pCalcUnit")?.value;
        ok = isFinite(v) && ["W", "kW", "MW"].includes(u || "");
      } else {
        const v = toNum(document.getElementById("p0Calc")?.value);
        const u = document.getElementById("p0CalcUnit")?.value;
        ok = isFinite(v) && ["W", "kW", "MW"].includes(u || "");
      }
      gates.calcOk = !!ok;
      toggleNext();
    }

    ["input", "change"].forEach((ev) => {
      E.content.querySelectorAll("input,select").forEach((el) =>
        el.addEventListener(ev, validateCalc)
      );
    });
    validateCalc();
    return;
  }

  // krok 3 – ODPověď
  if (step === 3) {
    const zapis = [
      problem.type !== "P0"
        ? `P₀ = ${fmtComma(problem.P0.v)} ${problem.P0.u}`
        : "P₀ = ?",
      problem.type !== "P"
        ? `P = ${fmtComma(problem.P.v)} ${problem.P.u}`
        : "P = ?",
      problem.type !== "eta"
        ? `η = ${problem.eta} %`
        : "η = ?",
    ].join(" • ");

    const template =
      problem.type === "eta"
        ? `Účinnost ${problem.device.name.toLowerCase()} je __ %.`
        : problem.type === "P"
        ? `Užitečný výkon zařízení je __.`
        : `Celkový příkon zařízení je __.`;

    const unitSuggestion =
      problem.type === "eta"
        ? "%"
        : problem.type === "P"
        ? problem.P.u
        : problem.P0.u;

    const valueStr =
      problem.type === "eta"
        ? `${fmtComma(problem.eta)} %`
        : problem.type === "P"
        ? fmtW(problem.PW)
        : fmtW(problem.P0W);

    S(`
      <h2>4. Odpověď</h2>
      <div class="badge ok">
        <b>Zápis:</b> ${zapis}<br>
        <b>Správný výsledek:</b> ${valueStr}
      </div>
      <label>Šablona odpovědi</label>
      <div class="note">${template.replace(
        "__",
        '<b id="placeholder">[doplň výsledek]</b>'
      )}</div>
      <div class="row gap" style="margin-top:8px">
        <input id="ansVal" class="input" type="text" inputmode="decimal" placeholder="výsledek">
        <select id="ansUnit" class="input">
          <option>%</option><option>W</option><option>kW</option><option>MW</option>
        </select>
      </div>
      <div id="ansMsg" class="small"></div>
    `);

    const ansUnit = document.getElementById("ansUnit");
    if (ansUnit) ansUnit.value = unitSuggestion;
    toggleNext();
    return;
  }
}

// ---------- Kontrola + statistika ----------
function setStats() {
  if (E.okCount)  E.okCount.textContent  = String(stats.ok);
  if (E.errCount) E.errCount.textContent = String(stats.err);
  if (E.avgAcc)
    E.avgAcc.textContent = stats.accN
      ? fmtComma(stats.accSum / stats.accN, 1) + " %"
      : "–";
}

function doCheck() {
  // tady ponecháme logiku jen pro krok 2 a 3 (krok 1 kontroluješ živě)
  if (!problem) return;

  // krok 2 – vzorec + výpočet
  if (step === 2) {
    const box = document.getElementById("calcMsg");
    if (!box) return;

    const formula = (document.getElementById("formula")?.value || "")
      .replace(/\s+/g, "")
      .replace(/eta/gi, "η");

    let goodFormula = false;
    if (problem.type === "eta")
      goodFormula = formula === "η=P/P₀" || formula === "η=P:P₀";
    if (problem.type === "P")
      goodFormula = ["P=η·P₀", "P=(η:100)·P₀", "P=η*P₀"].includes(formula);
    if (problem.type === "P0")
      goodFormula =
        formula === "P₀=P/η" ||
        ["P₀=P/(η:100)", "P₀=P:(η:100)"].includes(formula);

    const tol = 0.005;
    let ok = false;
    let msg = "";
    let acc = 0;

    if (problem.type === "eta") {
      const v = toNum(document.getElementById("eta")?.value);
      if (isFinite(v)) {
        acc = 100 - Math.min(100, Math.abs(v - problem.eta));
        ok  = Math.abs(v - problem.eta) <= Math.max(1e-6, problem.eta * tol);
      }
      msg =
        goodFormula && ok
          ? `✅ Vzorec i výsledek v pořádku. η = ${fmtComma(problem.eta)} %.`
          : !goodFormula
          ? "❌ Zapiš správný vzorec."
          : `❌ Nesouhlasí výsledek. Očekává se přibližně ${fmtComma(
              problem.eta
            )} %.`;
    } else if (problem.type === "P") {
      const v = toNum(document.getElementById("pCalc")?.value);
      const u = document.getElementById("pCalcUnit")?.value || "W";
      const got  = v * F[u];
      const want = problem.PW;
      if (isFinite(got)) {
        acc = 100 - Math.min(100, (Math.abs(got - want) / want) * 100);
        ok  = Math.abs(got - want) <= Math.max(1e-6, want * tol);
      }
      msg =
        goodFormula && ok
          ? `✅ Vzorec i výsledek v pořádku. P = ${fmtW(want)}.`
          : !goodFormula
          ? "❌ Zapiš správný vzorec."
          : `❌ Nesouhlasí výsledek. Očekává se přibližně ${fmtW(want)}.`;
    } else {
      const v = toNum(document.getElementById("p0Calc")?.value);
      const u = document.getElementById("p0CalcUnit")?.value || "W";
      const got  = v * F[u];
      const want = problem.P0W;
      if (isFinite(got)) {
        acc = 100 - Math.min(100, (Math.abs(got - want) / want) * 100);
        ok  = Math.abs(got - want) <= Math.max(1e-6, want * tol);
      }
      msg =
        goodFormula && ok
          ? `✅ Vzorec i výsledek v pořádku. P₀ = ${fmtW(want)}.`
          : !goodFormula
          ? "❌ Zapiš správný vzorec."
          : `❌ Nesouhlasí výsledek. Očekává se přibližně ${fmtW(want)}.`;
    }

    box.innerHTML = ok
      ? `<span class="success">${msg}</span>`
      : `<span class="error">${msg}</span>`;

    if (ok) {
      stats.ok++;
      stats.accSum += acc;
      stats.accN++;
    } else {
      stats.err++;
    }
    setStats();
    return;
  }

  // krok 3 – slovní odpověď
  if (step === 3) {
    const ans  = document.getElementById("ansVal");
    const unit = document.getElementById("ansUnit");
    const box  = document.getElementById("ansMsg");
    if (!ans || !unit || !box) return;

    const txt = (ans.value || "").trim();
    const hasNum = txt !== "" && isFinite(toNum(txt));

    const valueStr =
      unit.value === "%"
        ? `${fmtComma(problem.eta)} %`
        : problem.type === "P"
        ? fmtW(problem.PW)
        : fmtW(problem.P0W);

    box.innerHTML = hasNum
      ? `<span class="success">✅ Odpověď dopsána. Vzor: <i>${valueStr}</i></span>`
      : `<span class="error">❌ Doplň číselný výsledek a vyber správnou jednotku.</span>`;
    return;
  }
}

// ---------- Ovládání ----------
function newTask(keepStats = true) {
  problem = makeProblem();
  step    = 0;
  gates.writeOk = false;
  gates.calcOk  = false;
  if (!keepStats) {
    stats = { ok: 0, err: 0, accSum: 0, accN: 0 };
    setStats();
  }
  render();
}

function wire() {
  if (E.btnBack)
    E.btnBack.addEventListener("click", () => {
      if (step > 0) {
        step--;
        render();
      }
    });

  if (E.btnNext)
    E.btnNext.addEventListener("click", () => {
      if (step < 3) {
        step++;
        render();
      }
    });

  if (E.btnCheck) E.btnCheck.addEventListener("click", doCheck);

  if (E.btnNew)
    E.btnNew.addEventListener("click", () => {
      newTask(true); // zachovej statistiku
    });

  if (E.btnReset)
    E.btnReset.addEventListener("click", () => {
      newTask(false); // resetuj statistiku
    });

  // obtížnost
  const diffSel = document.getElementById("difficulty");
  if (diffSel) {
    diffSel.value = difficulty;
    diffSel.addEventListener("change", () => {
      difficulty = diffSel.value || "lehka";
      newTask(true); // jen nová úloha, statistika zůstává
    });
  }
}

// ---------- Start ----------
document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
  setStats();
  wire();
  // automaticky vygeneruje 1. úlohu
  newTask(true);
});
