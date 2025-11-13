// script.js — P₀ / P / η cvičebnice
"use strict";

// ---------- Pomocné ----------
const F = { W: 1, kW: 1000, MW: 1_000_000 };

const DIFF = {
  lehka:    { p0W: [   50,   500],   eta: [60, 95] },
  normalni: { p0W: [  500, 50000],   eta: [35, 90] },
};

let difficulty = "lehka";

// přísný průchod kroky
const STRICT_FLOW = true;
let gates = { writeOk: false, calcOk: false };

// stav zápisu z kroku 2 (použijeme ve Výpočtu)
let writeState = null;

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

// řádek pro P₀/P v Zápisu
function writeRowPower(id, label, placeholder) {
  return `
    <div class="row wrap gap" style="align-items:center">
      <label class="small" style="min-width:7rem">${label}</label>
      <input id="${id}Val" class="input" type="text" inputmode="decimal" placeholder="${placeholder}">
      <select id="${id}Unit" class="input">
        <option value="">Vyber</option>
        <option>W</option><option>kW</option><option>MW</option>
      </select>
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

  // viditelnost tlačítka ZKONTROLOVAT
  if (E.btnCheck) {
    if (step === 2 || step === 3) {
      E.btnCheck.style.display = "";
    } else {
      E.btnCheck.style.display = "none";
    }
  }

  // krok 0 – Zadání
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

  // krok 1 – Zápis
  if (step === 1) {
    gates.calcOk = false;

    S(`
      <h2>2. Zápis</h2>
      ${writeRowPower("p0", "P₀ (příkon)", "111")}
      ${writeRowPower("p",  "P (užitečný výkon)", "111")}
      <div class="row wrap gap" style="align-items:center">
        <label class="small" style="min-width:7rem">η (účinnost)</label>
        <input id="etaPct" class="input" type="text" inputmode="decimal" placeholder="např. 75">
        <span>% =</span>
        <input id="etaDec" class="input" type="text" inputmode="decimal" placeholder="např. 0,75">
        <label class="small" style="display:inline-flex;gap:.4rem;align-items:center">
          <input id="etaChk" type="checkbox"> hledaná veličina
        </label>
      </div>
      <div id="writeMsg" class="small muted"></div>
    `);

    // DOM prvky
    const p0Val  = document.getElementById("p0Val");
    const p0Unit = document.getElementById("p0Unit");
    const p0Chk  = document.getElementById("p0Chk");

    const pVal  = document.getElementById("pVal");
    const pUnit = document.getElementById("pUnit");
    const pChk  = document.getElementById("pChk");

    const etaPct = document.getElementById("etaPct");
    const etaDec = document.getElementById("etaDec");
    const etaChk = document.getElementById("etaChk");

    const writeMsg = document.getElementById("writeMsg");

    function setRowStatePower(valEl, unitEl, chkEl, defaultPlaceholder) {
      const unknown = chkEl.checked;
      if (unknown) {
        valEl.value = "";
        valEl.disabled = true;
        valEl.placeholder = "?";
        unitEl.disabled = false;   // hledaná -> zadává se jen jednotka
      } else {
        valEl.disabled = false;
        valEl.placeholder = defaultPlaceholder;
        unitEl.disabled = false;
      }
    }

    function setRowStateEta() {
      const unknown = etaChk.checked;
      if (unknown) {
        etaPct.value = "";
        etaDec.value = "";
        etaPct.disabled = true;
        etaDec.disabled = true;
        etaPct.placeholder = "?";
        etaDec.placeholder = "?";
      } else {
        etaPct.disabled = false;
        etaDec.disabled = false;
        etaPct.placeholder = "např. 75";
        etaDec.placeholder = "např. 0,75";
      }
    }

    setRowStatePower(p0Val, p0Unit, p0Chk, "111");
    setRowStatePower(pVal, pUnit, pChk, "111");
    setRowStateEta();

    function validateWrite() {
      const unknowns = [];
      if (p0Chk.checked)  unknowns.push("p0");
      if (pChk.checked)   unknowns.push("p");
      if (etaChk.checked) unknowns.push("eta");

      if (unknowns.length !== 1) {
        gates.writeOk = false;
        writeMsg.textContent = "Zaškrtni přesně jednu hledanou veličinu.";
        toggleNext();
        return;
      }

      let ok = true;
      const tol = 1e-3;

      // P₀
      if (!p0Chk.checked) {
        const v = toNum(p0Val.value);
        const u = p0Unit.value;
        if (!isFinite(v) || !["W","kW","MW"].includes(u)) ok = false;
      } else {
        // hledaná P₀ – vyžadujeme aspoň jednotku
        if (!["W","kW","MW"].includes(p0Unit.value)) ok = false;
      }

      // P
      if (!pChk.checked) {
        const v = toNum(pVal.value);
        const u = pUnit.value;
        if (!isFinite(v) || !["W","kW","MW"].includes(u)) ok = false;
      } else {
        if (!["W","kW","MW"].includes(pUnit.value)) ok = false;
      }

      // η
      if (!etaChk.checked) {
        const pct = toNum(etaPct.value);
        const dec = toNum(etaDec.value);
        if (!isFinite(pct) || !isFinite(dec)) ok = false;
        else {
          if (Math.abs(dec - pct / 100) > tol) ok = false;
        }
      }

      gates.writeOk = ok;
      writeMsg.textContent = ok
        ? "Zápis je formálně v pořádku (η je převedena na desetinné číslo)."
        : "Doplň hodnoty, jednotky a zkontroluj převod η na desetinné číslo.";

      // uložíme stav pro Shrnutí zápisu ve Výpočtu
      if (ok) {
        writeState = {
          p0: {
            unknown: p0Chk.checked,
            value:  p0Chk.checked ? null : toNum(p0Val.value),
            unit:   p0Unit.value || ""
          },
          p: {
            unknown: pChk.checked,
            value:  pChk.checked ? null : toNum(pVal.value),
            unit:   pUnit.value || ""
          },
          eta: {
            unknown: etaChk.checked,
            pct:  etaChk.checked ? null : toNum(etaPct.value),
            dec:  etaChk.checked ? null : toNum(etaDec.value)
          }
        };
      } else {
        writeState = null;
      }

      toggleNext();
    }

    [p0Chk, p0Val, p0Unit, pChk, pVal, pUnit, etaChk, etaPct, etaDec]
      .forEach((el) => {
        if (!el) return;
        el.addEventListener("change", () => {
          if (el === p0Chk || el === p0Val || el === p0Unit)
            setRowStatePower(p0Val, p0Unit, p0Chk, "111");
          if (el === pChk || el === pVal || el === pUnit)
            setRowStatePower(pVal, pUnit, pChk, "111");
          if (el === etaChk || el === etaPct || el === etaDec)
            setRowStateEta();
          validateWrite();
        });
        el.addEventListener("input", () => {
          validateWrite();
        });
      });

    validateWrite();
    return;
  }

  // krok 2 – Výpočet
  if (step === 2) {
    // Shrnutí zápisu z writeState
    const lines = [];
    if (writeState) {
      // P₀
      if (writeState.p0.unknown) {
        lines.push(`P₀ = ? ${writeState.p0.unit}`.trim());
      } else {
        lines.push(`P₀ = ${fmtComma(writeState.p0.value)} ${writeState.p0.unit}`.trim());
      }
      // P
      if (writeState.p.unknown) {
        lines.push(`P = ? ${writeState.p.unit}`.trim());
      } else {
        lines.push(`P = ${fmtComma(writeState.p.value)} ${writeState.p.unit}`.trim());
      }
      // η
      if (writeState.eta.unknown) {
        lines.push("η = ?");
      } else {
        lines.push(
          `η = ${fmtComma(writeState.eta.pct)} % = ${fmtComma(writeState.eta.dec)}`
        );
      }
    }

    const formulaHint =
      problem.type === "eta"
        ? 'η = P / P₀ (povoleno i „η = P : P₀“)'
        : problem.type === "P"
        ? 'P = η · P₀ (η napiš jako 0,75) nebo „P = (η : 100) · P₀“'
        : 'P₀ = P / (η : 100) nebo „P₀ = P : (η : 100)“';

    let inner = `
      <h2>3. Výpočet</h2>
      <div class="badge wip">
        <b>Shrnutí zápisu</b><br>
        ${lines.join("<br>")}
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

    function validateCalc() {
      let ok = false;
      if (problem.type === "eta") {
        const v = toNum(document.getElementById("eta")?.value);
        ok = isFinite(v);
      } else if (problem.type === "P") {
        const v = toNum(document.getElementById("pCalc")?.value);
        const u = document.getElementById("pCalcUnit")?.value;
        ok = isFinite(v) && ["W","kW","MW"].includes(u || "");
      } else {
        const v = toNum(document.getElementById("p0Calc")?.value);
        const u = document.getElementById("p0CalcUnit")?.value;
        ok = isFinite(v) && ["W","kW","MW"].includes(u || "");
      }
      gates.calcOk = !!ok;
      toggleNext();
    }

    E.content.querySelectorAll("input,select").forEach((el) => {
      el.addEventListener("input", validateCalc);
      el.addEventListener("change", validateCalc);
    });
    validateCalc();
    return;
  }

  // krok 3 – Odpověď
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

// ---------- Statistika + Kontrola ----------
function setStats() {
  if (E.okCount)  E.okCount.textContent  = String(stats.ok);
  if (E.errCount) E.errCount.textContent = String(stats.err);
  if (E.avgAcc)
    E.avgAcc.textContent = stats.accN
      ? fmtComma(stats.accSum / stats.accN, 1) + " %"
      : "–";
}

function doCheck() {
  if (!problem) return;

  // krok 2 – výpočet
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
  writeState = null;
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
      newTask(true);
    });

  if (E.btnReset)
    E.btnReset.addEventListener("click", () => {
      newTask(false);
    });

  const diffSel = document.getElementById("difficulty");
  if (diffSel) {
    diffSel.value = difficulty;
    diffSel.addEventListener("change", () => {
      difficulty = diffSel.value || "lehka";
      newTask(true);
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
