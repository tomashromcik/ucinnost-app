// script.js — Účinnost: P₀, P, η (dva kroky: Zápis + Výpočet a odpověď)
"use strict";

// ---------- Pomocné ----------
const F = { W: 1, kW: 1000, MW: 1_000_000 };

const DIFF = {
  lehka:    { p0W: [  50,   500], eta: [60, 95] },
  normalni: { p0W: [ 500, 50000], eta: [35, 90] },
};

let difficulty = "lehka";

// krok 1 = Zápis, krok 2 = Výpočet a odpověď
let step = 1;

// aktuální úloha + statistika
let problem = null;
let stats = { ok: 0, err: 0, accSum: 0, accN: 0 };

// stav zápisu z kroku 1 (pro shrnutí)
let writeState = null;

// "zámky" na Next (striktní průchod)
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

// ---------- Reálné rozsahy ----------

const DEVICES = [
  { id: "zarovka", name: "Žárovka",      p0W: [5, 150],                eta: [5, 25] },
  { id: "ledka",   name: "LED žárovka",  p0W: [3, 30],                 eta: [25, 45] },
  { id: "motor",   name: "Elektromotor", p0W: [5_000, 500_000],        eta: [60, 95] },
  { id: "cerpadlo",name: "Čerpadlo",     p0W: [500, 50_000],           eta: [40, 80] },
  { id: "turbina", name: "Turbína",      p0W: [1_000_000, 50_000_000], eta: [30, 60] },
];

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
    text = `${dev.name} pracuje s účinností η = ${eta} %. Odebírá příkon P₀ = ${fmtComma(P0.v)} ${P0.u}. Urči užitečný výkon P.`;
    ask  = "Urči užitečný výkon P.";
  } else {
    text = `${dev.name} má účinnost η = ${eta} %. Dodává užitečný výkon P = ${fmtComma(P.v)} ${P.u}. Urči celkový příkon P₀.`;
    ask  = "Urči celkový příkon P₀.";
  }

  return { device: dev, type, P0W, PW, eta, P0, P, text, ask };
}

// ---------- UI prvky ----------

const E = {};

function bindElements() {
  E.zadaniText = document.getElementById("zadaniText");
  E.content    = document.getElementById("content");

  E.btnBack  = document.getElementById("btnBack");
  E.btnNext  = document.getElementById("btnNext");
  E.btnCheck = document.getElementById("btnCheck");
  E.btnNew   = document.getElementById("btnNew");
  E.btnReset = document.getElementById("btnReset");
  E.diffSel  = document.getElementById("difficulty");

  E.okCount  = document.getElementById("okCount");
  E.errCount = document.getElementById("errCount");
  E.avgAcc   = document.getElementById("avgAcc");
}

// ---------- Zadání ----------

function renderZadani() {
  if (!E.zadaniText) return;
  if (!problem) {
    E.zadaniText.innerHTML = '<span class="small muted">Něco se pokazilo, zkuste „Nová úloha“.</span>';
    return;
  }
  // pouze slovní úloha, bez „Úkol:“ / „Dané:“
  E.zadaniText.innerHTML = `<p>${problem.text}</p><p><b>Otázka:</b> ${problem.ask}</p>`;
}

// ---------- Krok 1: Zápis ----------

function renderStep1() {
  if (!E.content) return;
  const S = (html) => (E.content.innerHTML = html);

  S(`
    <h2 class="subtitle">1. Zápis</h2>
    <p class="small muted">Zapiš dané veličiny ze zadání. Jednu z nich označ jako <b>hledanou</b>.</p>

    <div class="write-row">
      <label class="title">P₀ (příkon)</label>
      <input id="p0Val" class="input" type="text" inputmode="decimal" placeholder="111">
      <select id="p0Unit" class="input unit-select">
        <option value="">Vyber</option>
        <option>W</option><option>kW</option><option>MW</option>
      </select>
      <label class="unknown-label">
        <input id="p0Chk" type="checkbox"> hledaná veličina
      </label>
    </div>

    <div class="write-row">
      <label class="title">P (užitečný výkon)</label>
      <input id="pVal" class="input" type="text" inputmode="decimal" placeholder="111">
      <select id="pUnit" class="input unit-select">
        <option value="">Vyber</option>
        <option>W</option><option>kW</option><option>MW</option>
      </select>
      <label class="unknown-label">
        <input id="pChk" type="checkbox"> hledaná veličina
      </label>
    </div>

    <div class="write-row">
      <label class="title">η (účinnost)</label>
      <input id="etaPct" class="input" type="text" inputmode="decimal" placeholder="např. 75">
      <span class="eta-eq">% =</span>
      <input id="etaDec" class="input" type="text" inputmode="decimal" placeholder="např. 0,75">
      <label class="unknown-label">
        <input id="etaChk" type="checkbox"> hledaná veličina
      </label>
    </div>

    <div id="writeMsg" class="feedback muted"></div>
  `);

  const p0Val  = document.getElementById("p0Val");
  const p0Unit = document.getElementById("p0Unit");
  const p0Chk  = document.getElementById("p0Chk");

  const pVal   = document.getElementById("pVal");
  const pUnit  = document.getElementById("pUnit");
  const pChk   = document.getElementById("pChk");

  const etaPct = document.getElementById("etaPct");
  const etaDec = document.getElementById("etaDec");
  const etaChk = document.getElementById("etaChk");

  const msgBox = document.getElementById("writeMsg");

  function setRowStatePower(valEl, unitEl, chkEl) {
    const unknown = chkEl.checked;
    if (unknown) {
      valEl.value = "";
      valEl.disabled = true;
      valEl.placeholder = "?";
      unitEl.disabled = false; // žák vybírá jednotku i pro hledanou (abychom věděli jednotky výsledku)
    } else {
      valEl.disabled = false;
      valEl.placeholder = "111";
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

  setRowStatePower(p0Val, p0Unit, p0Chk);
  setRowStatePower(pVal, pUnit, pChk);
  setRowStateEta();

  function validateWrite() {
    if (!msgBox) return;

    // 1) přesně jedna hledaná
    const unknowns = [];
    if (p0Chk.checked) unknowns.push("P0");
    if (pChk.checked)  unknowns.push("P");
    if (etaChk.checked)unknowns.push("eta");

    if (unknowns.length !== 1) {
      gates.writeOk = false;
      msgBox.textContent = "Zaškrtni přesně jednu hledanou veličinu.";
      writeState = null;
      toggleNext();
      return;
    }

    // 2) musí odpovídat tomu, co je opravdu neznámé v zadání
    const typeMap = { P0: "P0", P: "P", eta: "eta" };
    const unknownKey = unknowns[0];
    const problemType = problem.type; // "P0" | "P" | "eta"
    if (typeMap[unknownKey] !== problemType) {
      gates.writeOk = false;
      msgBox.textContent = "Hledaná veličina neodpovídá otázce v zadání.";
      writeState = null;
      toggleNext();
      return;
    }

    let ok = true;
    const tolRel = 0.001; // 0,1 %

    // ----- P₀ -----
    if (!p0Chk.checked) {
      const v = toNum(p0Val.value);
      const u = p0Unit.value;
      if (!isFinite(v) || !["W", "kW", "MW"].includes(u)) {
        ok = false;
      } else {
        const got = v * F[u];
        const want = problem.P0W;
        if (!(isFinite(got) && Math.abs(got - want) <= Math.max(1e-6, want * tolRel))) {
          ok = false;
        }
      }
    } else {
      // hledaná P₀ → chceme mít aspoň jednotku
      if (!["W", "kW", "MW"].includes(p0Unit.value)) ok = false;
    }

    // ----- P -----
    if (!pChk.checked) {
      const v = toNum(pVal.value);
      const u = pUnit.value;
      if (!isFinite(v) || !["W", "kW", "MW"].includes(u)) {
        ok = false;
      } else {
        const got = v * F[u];
        const want = problem.PW;
        if (!(isFinite(got) && Math.abs(got - want) <= Math.max(1e-6, want * tolRel))) {
          ok = false;
        }
      }
    } else {
      if (!["W", "kW", "MW"].includes(pUnit.value)) ok = false;
    }

    // ----- η -----
    if (!etaChk.checked) {
      const pct = toNum(etaPct.value);
      const dec = toNum(etaDec.value);
      if (!isFinite(pct) || !isFinite(dec)) {
        ok = false;
      } else {
        // (a) vnitřní kontrola: dec = pct/100
        if (Math.abs(dec - pct / 100) > 1e-3) ok = false;
        // (b) proti zadání
        if (Math.abs(pct - problem.eta) > Math.max(1e-6, problem.eta * tolRel)) {
          ok = false;
        }
      }
    }

    gates.writeOk = ok;
    msgBox.textContent = ok
      ? "Zápis odpovídá zadání a η je správně převedena na desetinné číslo."
      : "Zápis není v pořádku — zkontroluj hodnoty, jednotky a převod η.";

    if (ok) {
      writeState = {
        unknown: unknownKey, // "P0" | "P" | "eta"
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

  [
    p0Val, p0Unit, p0Chk,
    pVal,  pUnit,  pChk,
    etaPct, etaDec, etaChk
  ].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", validateWrite);
    el.addEventListener("change", () => {
      if (el === p0Chk || el === p0Val || el === p0Unit)
        setRowStatePower(p0Val, p0Unit, p0Chk);
      if (el === pChk || el === pVal || el === pUnit)
        setRowStatePower(pVal, pUnit, pChk);
      if (el === etaChk || el === etaPct || el === etaDec)
        setRowStateEta();
      validateWrite();
    });
  });

  validateWrite();
}

// ---------- Krok 2: Výpočet + odpověď ----------

function renderStep2() {
  if (!E.content) return;
  const S = (html) => (E.content.innerHTML = html);

  // shrnutí zápisu
  const lines = [];
  if (writeState) {
    // P₀
    if (writeState.p0.unknown) {
      lines.push(`P₀ = ? ${writeState.p0.unit}`.trim());
    } else {
      lines.push(
        `P₀ = ${fmtComma(writeState.p0.value)} ${writeState.p0.unit}`.trim()
      );
    }
    // P
    if (writeState.p.unknown) {
      lines.push(`P = ? ${writeState.p.unit}`.trim());
    } else {
      lines.push(
        `P = ${fmtComma(writeState.p.value)} ${writeState.p.unit}`.trim()
      );
    }
    // η
    if (writeState.eta.unknown) {
      lines.push("η = ?");
    } else {
      lines.push(
        `η = ${fmtComma(writeState.eta.pct)} % = ${fmtComma(writeState.eta.dec)}`
      );
    }
  } else {
    // záloha, kdyby bylo něco špatně
    lines.push(
      `P₀ = ${fmtComma(problem.P0.v)} ${problem.P0.u}`,
      `P  = ${fmtComma(problem.P.v)} ${problem.P.u}`,
      `η  = ${problem.eta} %`
    );
  }

  const formulaHint =
    problem.type === "eta"
      ? 'η = P / P₀ (povoleno i „η = P : P₀“)'
      : problem.type === "P"
      ? 'P = η · P₀ (η napiš jako 0,75) nebo „P = (η : 100) · P₀“'
      : 'P₀ = P / (η : 100) nebo „P₀ = P : (η : 100)“';

  // šablona odpovědi
  const template =
    problem.type === "eta"
      ? `Účinnost ${problem.device.name.toLowerCase()} je __ %.`
      : problem.type === "P"
      ? `Užitečný výkon zařízení je __.`
      : `Celkový příkon zařízení je __.`;

  let resultBlock = "";
  if (problem.type === "eta") {
    resultBlock = `
      <label>Výsledek — η (%)</label>
      <input id="resVal" class="input" type="text" inputmode="decimal" placeholder="např. 75">
    `;
  } else if (problem.type === "P") {
    resultBlock = `
      <label>Výsledek — P</label>
      <div class="row gap">
        <input id="resVal" class="input" type="text" inputmode="decimal" placeholder="hodnota">
        <select id="resUnit" class="input unit-select">
          <option value="">Vyber</option>
          <option>W</option><option>kW</option><option>MW</option>
        </select>
      </div>
    `;
  } else {
    resultBlock = `
      <label>Výsledek — P₀</label>
      <div class="row gap">
        <input id="resVal" class="input" type="text" inputmode="decimal" placeholder="hodnota">
        <select id="resUnit" class="input unit-select">
          <option value="">Vyber</option>
          <option>W</option><option>kW</option><option>MW</option>
        </select>
      </div>
    `;
  }

  S(`
    <h2 class="subtitle">2. Výpočet a odpověď</h2>

    <div class="summary-box">
      <div class="summary-title">Shrnutí zápisu</div>
      ${lines.map((t) => `<div class="summary-line">${t}</div>`).join("")}
    </div>

    <!-- Vzorec -->
    <div>
      <label>Vzorec</label>
      <div class="inline-buttons" data-target="formula">
        <button type="button" data-ins="η">η</button>
        <button type="button" data-ins="P">P</button>
        <button type="button" data-ins="P₀">P₀</button>
        <button type="button" data-ins=" · ">·</button>
        <button type="button" data-ins=" / ">/</button>
        <button type="button" data-ins=" : ">:</button>
        <button type="button" data-ins=" = ">=</button>
      </div>
      <input id="formula" class="input" type="text" placeholder="${formulaHint}">
    </div>

    <!-- Dosaď do vzorce -->
    <div>
      <label>Dosaď do vzorce</label>
      <div class="inline-buttons" data-target="subst">
        <button type="button" data-ins="η">η</button>
        <button type="button" data-ins="P">P</button>
        <button type="button" data-ins="P₀">P₀</button>
        <button type="button" data-ins=" · ">·</button>
        <button type="button" data-ins=" / ">/</button>
        <button type="button" data-ins=" : ">:</button>
        <button type="button" data-ins=" = ">=</button>
      </div>
      <input id="subst" class="input" type="text" placeholder="např. η = P / P₀">
    </div>

    <!-- Výsledek -->
    <div>
      ${resultBlock}
    </div>

    <!-- Odpověď -->
    <div>
      <label>Šablona odpovědi</label>
      <div class="summary-box">
        ${template.replace("__", '<b id="answerPlaceholder">[doplň výsledek]</b>')}
      </div>
      <div id="autoAnswer" class="feedback muted"></div>
    </div>

    <div id="calcMsg" class="feedback muted"></div>
  `);

  // symbolová tlačítka
  document.querySelectorAll(".inline-buttons").forEach((group) => {
    const targetId = group.getAttribute("data-target");
    group.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        let target = document.activeElement;
        if (!(target && target.id === targetId)) {
          target = document.getElementById(targetId);
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
  });

  // základní kontrola (aby se dal Next odemknout, pokud budeš chtít)
  function validateCalc() {
    let ok = true;
    const resVal  = document.getElementById("resVal");
    const resUnit = document.getElementById("resUnit");

    if (problem.type === "eta") {
      const v = toNum(resVal?.value);
      if (!isFinite(v)) ok = false;
    } else {
      const v = toNum(resVal?.value);
      const u = resUnit?.value || "";
      if (!isFinite(v) || !["W", "kW", "MW"].includes(u)) ok = false;
    }
    gates.calcOk = ok;
    toggleNext();
  }

  E.content.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", validateCalc);
    el.addEventListener("change", validateCalc);
  });
  validateCalc();
}

// ---------- Render hlavní ----------

function render() {
  renderZadani();
  if (!E.content) return;

  // kroky v headeru
  document.querySelectorAll(".step").forEach((el) => {
    const s = Number(el.getAttribute("data-step"));
    el.classList.toggle("active", s === step);
  });

  // back tlačítko
  if (E.btnBack) E.btnBack.disabled = step === 1;

  // Zkontrolovat viditelný jen ve Výpočtu
  if (E.btnCheck) {
    E.btnCheck.style.display = step === 2 ? "" : "none";
  }

  if (step === 1) {
    renderStep1();
  } else {
    renderStep2();
  }

  toggleNext();
}

// ---------- Next/Back ----------

function toggleNext() {
  if (!STRICT_FLOW || !E.btnNext) return;
  let allow = true;
  if (step === 1) allow = gates.writeOk;
  // krok 2 už je poslední, Next může být vždy, nebo můžeme nechat allow = true
  E.btnNext.disabled = !allow;
}

// ---------- Statistiky ----------

function setStats() {
  if (E.okCount)  E.okCount.textContent  = String(stats.ok);
  if (E.errCount) E.errCount.textContent = String(stats.err);
  if (E.avgAcc)
    E.avgAcc.textContent = stats.accN
      ? fmtComma(stats.accSum / stats.accN, 1) + " %"
      : "–";
}

// ---------- Kontrola (krok 2) ----------

function doCheck() {
  if (step !== 2 || !problem) return;
  const box = document.getElementById("calcMsg");
  const ansBox = document.getElementById("autoAnswer");
  if (box) {
    box.textContent = "";
    box.className = "feedback";
  }
  if (ansBox) {
    ansBox.textContent = "";
    ansBox.className = "feedback";
  }

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

  const resVal  = document.getElementById("resVal");
  const resUnit = document.getElementById("resUnit");

  let ok = false;
  let acc = 0;
  let msg = "";
  const tolRel = 0.005; // 0,5 %

  if (problem.type === "eta") {
    const v = toNum(resVal?.value);
    if (isFinite(v)) {
      acc = 100 - Math.min(100, Math.abs(v - problem.eta));
      ok  = Math.abs(v - problem.eta) <= Math.max(1e-6, problem.eta * tolRel);
    }
    msg =
      goodFormula && ok
        ? `Vzorec i výsledek jsou v pořádku. η ≈ ${fmtComma(problem.eta)} %.`
        : !goodFormula
        ? "Vzorec není zapsán správně."
        : `Výsledek nesouhlasí. Očekává se přibližně ${fmtComma(problem.eta)} %.`;
  } else if (problem.type === "P") {
    const v = toNum(resVal?.value);
    const u = resUnit?.value || "W";
    const got  = v * (F[u] || 1);
    const want = problem.PW;
    if (isFinite(got)) {
      acc = 100 - Math.min(100, (Math.abs(got - want) / want) * 100);
      ok  = Math.abs(got - want) <= Math.max(1e-6, want * tolRel);
    }
    msg =
      goodFormula && ok
        ? `Vzorec i výsledek jsou v pořádku. P ≈ ${fmtW(want)}.`
        : !goodFormula
        ? "Vzorec není zapsán správně."
        : `Výsledek nesouhlasí. Očekává se přibližně ${fmtW(want)}.`;
  } else {
    const v = toNum(resVal?.value);
    const u = resUnit?.value || "W";
    const got  = v * (F[u] || 1);
    const want = problem.P0W;
    if (isFinite(got)) {
      acc = 100 - Math.min(100, (Math.abs(got - want) / want) * 100);
      ok  = Math.abs(got - want) <= Math.max(1e-6, want * tolRel);
    }
    msg =
      goodFormula && ok
        ? `Vzorec i výsledek jsou v pořádku. P₀ ≈ ${fmtW(want)}.`
        : !goodFormula
        ? "Vzorec není zapsán správně."
        : `Výsledek nesouhlasí. Očekává se přibližně ${fmtW(want)}.`;
  }

  if (box) {
    box.textContent = msg;
    box.classList.add(ok ? "success" : "error");
  }

  if (ok) {
    stats.ok++;
    stats.accSum += acc;
    stats.accN++;
  } else {
    stats.err++;
  }
  setStats();

  // automaticky generovaná slovní odpověď
  if (ansBox) {
    let answer = "";
    if (problem.type === "eta") {
      answer = `Účinnost ${problem.device.name.toLowerCase()} je přibližně ${fmtComma(problem.eta)} %.`;
    } else if (problem.type === "P") {
      answer = `Užitečný výkon zařízení je přibližně ${fmtW(problem.PW)}.`;
    } else {
      answer = `Celkový příkon zařízení je přibližně ${fmtW(problem.P0W)}.`;
    }
    ansBox.textContent = answer;
    ansBox.classList.add(ok ? "success" : "error");
  }
}

// ---------- Ovládání ----------

function newTask(keepStats = true) {
  problem = makeProblem();
  step = 1;
  writeState = null;
  gates.writeOk = false;
  gates.calcOk = false;
  if (!keepStats) {
    stats = { ok: 0, err: 0, accSum: 0, accN: 0 };
    setStats();
  }
  render();
}

function wire() {
  if (E.btnBack) {
    E.btnBack.addEventListener("click", () => {
      if (step > 1) {
        step = 1;
        render();
      }
    });
  }

  if (E.btnNext) {
    E.btnNext.addEventListener("click", () => {
      if (step === 1 && gates.writeOk) {
        step = 2;
        render();
      }
    });
  }

  if (E.btnCheck) {
    E.btnCheck.addEventListener("click", doCheck);
  }

  if (E.btnNew) {
    E.btnNew.addEventListener("click", () => {
      newTask(true);
    });
  }

  if (E.btnReset) {
    E.btnReset.addEventListener("click", () => {
      newTask(false);
    });
  }

  if (E.diffSel) {
    E.diffSel.value = difficulty;
    E.diffSel.addEventListener("change", () => {
      difficulty = E.diffSel.value || "lehka";
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
  newTask(true); // hned vygeneruj první úlohu
});
