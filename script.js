// script.js — minimální, funkční MVP pro P0/P/η cvičebnici
"use strict";

// ---------- Pomocné ----------
const F = { W: 1, kW: 1000, MW: 1_000_000 };
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
  { id: "zarovka", name: "Žárovka", p0W: [5, 150], eta: [5, 25] },
  { id: "ledka", name: "LED žárovka", p0W: [3, 30], eta: [25, 45] },
  { id: "motor", name: "Elektromotor", p0W: [5_000, 500_000], eta: [60, 95] },
  { id: "cerpadlo", name: "Čerpadlo", p0W: [500, 50_000], eta: [40, 80] },
  { id: "turbina", name: "Turbína", p0W: [1_000_000, 50_000_000], eta: [30, 60] },
];

// ---------- Stav ----------
let step = 0; // 0..3
let problem = null;
let stats = { ok: 0, err: 0, accSum: 0, accN: 0 };

// ---------- Generování úlohy ----------
function makeProblem() {
  const dev = choose(DEVICES);
  const type = choose(["eta", "P", "P0"]); // neznámá
  const P0W = pick(dev.p0W[0], dev.p0W[1]);
  const eta = pickInt(dev.eta[0], dev.eta[1]); // v %
  const PW = P0W * (eta / 100);

  const P0 = unitize(P0W);
  const P = unitize(PW);

  let text = "",
    ask = "";
  if (type === "eta") {
    text = `${dev.name} odebírá příkon P₀ = ${fmtComma(P0.v)} ${P0.u}. Užitečný výkon je P = ${fmtComma(P.v)} ${P.u}.`;
    ask = "Urči účinnost zařízení η v procentech.";
  } else if (type === "P") {
    text = `${dev.name} pracuje s účinností η = ${eta} %. Odebírá příkon P₀ = ${fmtComma(P0.v)} ${P0.u}.`;
    ask = "Urči užitečný výkon P.";
  } else {
    text = `${dev.name} má účinnost η = ${eta} %. Dodává užitečný výkon P = ${fmtComma(P.v)} ${P.u}.`;
    ask = "Urči celkový příkon P₀.";
  }

  return {
    device: dev,
    type,
    P0W,
    PW,
    eta, // %
    P0, // {v,u}
    P, // {v,u}
    text,
    ask,
  };
}

// ---------- UI elementy ----------
let E = {};
function bindElements() {
  E.zadaniText = document.getElementById("zadaniText");
  E.knownBox = document.getElementById("knownBox");
  E.content = document.getElementById("content");

  E.btnBack = document.getElementById("btnBack");
  E.btnNext = document.getElementById("btnNext");
  E.btnCheck = document.getElementById("btnCheck");
  E.btnNew = document.getElementById("btnNew");
  E.btnReset = document.getElementById("btnReset");

  E.okCount = document.getElementById("okCount");
  E.errCount = document.getElementById("errCount");
  E.avgAcc = document.getElementById("avgAcc");
}

// ---------- Render levého panelu ----------
function renderAside() {
  if (!E.zadaniText || !E.knownBox) return;
  if (!problem) {
    E.zadaniText.textContent = "";
    E.knownBox.textContent = "";
    return;
  }
  const known = [
    problem.type !== "P0"
      ? `P₀ = ${fmtComma(problem.P0.v)} ${problem.P0.u}`
      : `P₀ = ?`,
    problem.type !== "P"
      ? `P = ${fmtComma(problem.P.v)} ${problem.P.u}`
      : `P = ?`,
    problem.type !== "eta" ? `η = ${problem.eta} %` : `η = ?`,
  ].join(" • ");

  E.zadaniText.innerHTML = `<p>${problem.text}</p><p><b>Úkol:</b> ${problem.ask}</p>`;
  E.knownBox.innerHTML = `<b>Dané:</b> ${known}`;
}

// ---------- Render kroků ----------
function render() {
  renderAside();
  if (!E.content) return;
  const S = (html) => (E.content.innerHTML = html);

  // zvýraznění kroku v "steps"
  document.querySelectorAll(".steps .step").forEach((el, i) => {
    el.classList.toggle("active", i === step);
  });

  // tlačítka back/next
  if (E.btnBack) E.btnBack.disabled = step === 0;
  if (E.btnNext) E.btnNext.disabled = step === 3;

  if (step === 0) {
    S(`
      <h2>1. Zadání</h2>
      <p class="small muted">Prostuduj zadání vlevo. Pokračuj na <b>Zápis</b>.</p>
    `);
    return;
  }

  if (step === 1) {
    S(`
      <h2>2. Zápis</h2>
      <div class="grid2">
        <div>
          <label>P₀ (příkon)</label>
          <div class="row gap">
            <input id="p0Val" class="input" type="text" inputmode="decimal" placeholder="${
              problem.type === "P0" ? "?" : fmtComma(problem.P0.v)
            }">
            <select id="p0Unit" class="input">
              <option>W</option><option>kW</option><option>MW</option>
            </select>
          </div>
        </div>
        <div>
          <label>P (užitečný výkon)</label>
          <div class="row gap">
            <input id="pVal" class="input" type="text" inputmode="decimal" placeholder="${
              problem.type === "P" ? "?" : fmtComma(problem.P.v)
            }">
            <select id="pUnit" class="input">
              <option>W</option><option>kW</option><option>MW</option>
            </select>
          </div>
        </div>
      </div>
      <div class="grid2" style="margin-top:10px">
        <div>
          <label>η (účinnost v %)</label>
          <input id="etaWrite" class="input" type="text" inputmode="decimal" placeholder="${
            problem.type === "eta" ? "?" : String(problem.eta)
          }">
        </div>
      </div>
      <p class="small muted">Do zápisu opisuj <b>dané</b> hodnoty. Neznámé ponech prázdné.</p>
      <div id="writeMsg" class="small"></div>
    `);

    // default jednotky
    const p0U = document.getElementById("p0Unit");
    const pU = document.getElementById("pUnit");
    if (p0U) p0U.value = problem.P0.u;
    if (pU) pU.value = problem.P.u;

    const checker = () => {
      const box = document.getElementById("writeMsg");
      if (!box) return;

      let ok = true,
        msg = [];

      // P0
      const p0V = document.getElementById("p0Val");
      const p0Unit = document.getElementById("p0Unit");
      const vP0 = toNum(p0V?.value);
      const uP0 = p0Unit?.value || "W";

      if (problem.type !== "P0") {
        const want = problem.P0W;
        const got = isNaN(vP0) ? NaN : vP0 * F[uP0];
        if (!(isFinite(got) && Math.abs(got - want) <= Math.max(1e-6, want * 0.001))) {
          ok = false;
          msg.push("P₀ neodpovídá zadání.");
        }
      } else if (p0V && p0V.value.trim() !== "") {
        ok = false;
        msg.push("P₀ je neznámé – nevyplňuj.");
      }

      // P
      const pV = document.getElementById("pVal");
      const pUnit = document.getElementById("pUnit");
      const vP = toNum(pV?.value);
      const uP = pUnit?.value || "W";

      if (problem.type !== "P") {
        const want = problem.PW;
        const got = isNaN(vP) ? NaN : vP * F[uP];
        if (!(isFinite(got) && Math.abs(got - want) <= Math.max(1e-6, want * 0.001))) {
          ok = false;
          msg.push("P neodpovídá zadání.");
        }
      } else if (pV && pV.value.trim() !== "") {
        ok = false;
        msg.push("P je neznámé – nevyplňuj.");
      }

      // η
      const eW = document.getElementById("etaWrite");
      const vEta = toNum(eW?.value);
      if (problem.type !== "eta") {
        if (
          !(
            isFinite(vEta) &&
            Math.abs(vEta - problem.eta) <= Math.max(1e-6, problem.eta * 0.001)
          )
        ) {
          ok = false;
          msg.push("η neodpovídá zadání.");
        }
      } else if (eW && eW.value.trim() !== "") {
        ok = false;
        msg.push("η je neznámé – nevyplňuj.");
      }

      box.innerHTML = ok
        ? '<span class="success">✅ Zápis je v pořádku.</span>'
        : '<span class="error">❌ ' + msg.join(" ") + "</span>";
      return ok;
    };

    ["input", "change", "keyup"].forEach((ev) => {
      ["p0Val", "p0Unit", "pVal", "pUnit", "etaWrite"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(ev, checker);
      });
    });
    checker();
    return;
  }

  if (step === 2) {
    const zapis = [
      problem.type !== "P0"
        ? `P₀ = ${fmtComma(problem.P0.v)} ${problem.P0.u}`
        : "P₀ = ?",
      problem.type !== "P"
        ? `P = ${fmtComma(problem.P.v)} ${problem.P.u}`
        : "P = ?",
      problem.type !== "eta" ? `η = ${problem.eta} %` : "η = ?",
    ].join(" • ");

    const formulaHint =
      problem.type === "eta"
        ? 'η = P / P₀ (povoleno i "η = P : P₀")'
        : problem.type === "P"
        ? 'P = η · P₀ (η zapiš jako 0,75) nebo "P = (η : 100) · P₀"'
        : 'P₀ = P / (η : 100) nebo "P₀ = P : (η : 100)"';

    let inner = `
      <h2>3. Výpočet</h2>
      <div class="badge wip"><b>Zápis:</b> ${zapis}</div>
      <div class="inline-buttons">
        <button data-ins="η">η</button><button data-ins="P">P</button><button data-ins="P₀">P₀</button>
        <button data-ins=" · ">·</button><button data-ins=" / ">/</button><button data-ins=" : ">:</button><button data-ins=" = ">=</button>
      </div>
      <label>Zapiš vzorec</label>
      <input id="formula" class="input" type="text" placeholder="${formulaHint}">
    `;

    if (problem.type === "eta") {
      inner += `
        <label>Výsledek — η (%)</label>
        <input id="eta" class="input" type="text" inputmode="decimal" placeholder="např. 75">
        <div id="calcMsg" class="small"></div>
      `;
    } else if (problem.type === "P") {
      inner += `
        <label>Výsledek — P</label>
        <div class="row gap">
          <input id="pCalc" class="input" type="text" inputmode="decimal" placeholder="hodnota">
          <select id="pCalcUnit" class="input"><option>W</option><option>kW</option><option>MW</option></select>
        </div>
        <div id="calcMsg" class="small"></div>
      `;
    } else {
      inner += `
        <label>Výsledek — P₀</label>
        <div class="row gap">
          <input id="p0Calc" class="input" type="text" inputmode="decimal" placeholder="hodnota">
          <select id="p0CalcUnit" class="input"><option>W</option><option>kW</option><option>MW</option></select>
        </div>
        <div id="calcMsg" class="small"></div>
      `;
    }

    S(inner);

    const f = document.getElementById("formula");
    document.querySelectorAll(".inline-buttons button").forEach((b) => {
      b.addEventListener("click", () => {
        if (!f) return;
        const ins = b.getAttribute("data-ins") || "";
        const pos = f.selectionStart ?? f.value.length;
        f.value = f.value.slice(0, pos) + ins + f.value.slice(pos);
        f.focus();
        f.selectionStart = f.selectionEnd = pos + ins.length;
      });
    });

    if (document.getElementById("pCalcUnit"))
      document.getElementById("pCalcUnit").value = problem.P.u;
    if (document.getElementById("p0CalcUnit"))
      document.getElementById("p0CalcUnit").value = problem.P0.u;

    return;
  }

  if (step === 3) {
    const zapis = [
      problem.type !== "P0"
        ? `P₀ = ${fmtComma(problem.P0.v)} ${problem.P0.u}`
        : "P₀ = ?",
      problem.type !== "P"
        ? `P = ${fmtComma(problem.P.v)} ${problem.P.u}`
        : "P = ?",
      problem.type !== "eta" ? `η = ${problem.eta} %` : "η = ?",
    ].join(" • ");

    const template =
      problem.type === "eta"
        ? `Účinnost ${problem.device.name.toLowerCase()} je __ %.`
        : problem.type === "P"
        ? `Užitečný výkon zařízení je __.`
        : `Celkový příkon zařízení je __.`;
    const unitSuggestion =
      problem.type === "eta" ? "%" : problem.type === "P" ? problem.P.u : problem.P0.u;

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
    return;
  }
}

// ---------- Kontroly ----------
function doCheck() {
  if (step === 1) {
    const box = document.getElementById("writeMsg");
    if (!box) return;
    // už se dělá live-check; jen vyvoláme render, aby se zobrazila aktuální zpráva
    render();
    return;
  }
  if (step === 2) {
    const box = document.getElementById("calcMsg");
    if (!box) return;

    const formula = (document.getElementById("formula")?.value || "")
      .replace(/\s+/g, "")
      .replace(/eta/gi, "η");
    let good = false,
      ok = false,
      msg = "",
      acc = 0;

    if (problem.type === "eta")
      good = formula === "η=P/P₀" || formula === "η=P:P₀";
    if (problem.type === "P")
      good = ["P=η·P₀", "P=(η:100)·P₀", "P=η*P₀"].includes(formula);
    if (problem.type === "P0")
      good = ["P₀=P/(η:100)", "P₀=P:((η:100))", "P₀=P: (η:100)".replace(/\s/g, "")]
        .includes(formula) || formula === "P₀=P/η"; // tolerujeme i P₀=P/η s η v desetinném tvaru

    const tol = 0.005;

    if (problem.type === "eta") {
      const v = toNum(document.getElementById("eta")?.value);
      if (isFinite(v)) {
        acc = 100 - Math.min(100, Math.abs(v - problem.eta));
        ok = Math.abs(v - problem.eta) <= Math.max(1e-6, problem.eta * tol);
      }
      msg = good && ok
        ? `✅ Vzorec i výsledek v pořádku. η = ${fmtComma(problem.eta)} %.`
        : !good
        ? "❌ Zapiš správný vzorec."
        : `❌ Nesouhlasí výsledek. Očekává se ~${fmtComma(problem.eta)} %.`;
    } else if (problem.type === "P") {
      const v = toNum(document.getElementById("pCalc")?.value);
      const u = document.getElementById("pCalcUnit")?.value || "W";
      const got = v * F[u],
        want = problem.PW;
      if (isFinite(got)) {
        acc = 100 - Math.min(100, (Math.abs(got - want) / want) * 100);
        ok = Math.abs(got - want) <= Math.max(1e-6, want * tol);
      }
      msg = good && ok
        ? `✅ Vzorec i výsledek v pořádku. P = ${fmtW(want)}.`
        : !good
        ? "❌ Zapiš správný vzorec."
        : `❌ Nesouhlasí výsledek. Očekává se ~${fmtW(want)}.`;
    } else {
      const v = toNum(document.getElementById("p0Calc")?.value);
      const u = document.getElementById("p0CalcUnit")?.value || "W";
      const got = v * F[u],
        want = problem.P0W;
      if (isFinite(got)) {
        acc = 100 - Math.min(100, (Math.abs(got - want) / want) * 100);
        ok = Math.abs(got - want) <= Math.max(1e-6, want * tol);
      }
      msg = good && ok
        ? `✅ Vzorec i výsledek v pořádku. P₀ = ${fmtW(want)}.`
        : !good
        ? "❌ Zapiš správný vzorec."
        : `❌ Nesouhlasí výsledek. Očekává se ~${fmtW(want)}.`;
    }

    box.innerHTML = ok ? `<span class="success">${msg}</span>` : `<span class="error">${msg}</span>`;
    if (ok) {
      stats.ok++;
      stats.accSum += acc;
      stats.accN++;
      setStats();
    } else {
      stats.err++;
      setStats();
    }
    return;
  }
  if (step === 3) {
    const ans = document.getElementById("ansVal");
    const unit = document.getElementById("ansUnit");
    const box = document.getElementById("ansMsg");
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

// ---------- Statistiky ----------
function setStats() {
  if (E.okCount) E.okCount.textContent = String(stats.ok);
  if (E.errCount) E.errCount.textContent = String(stats.err);
  if (E.avgAcc)
    E.avgAcc.textContent = stats.accN
      ? fmtComma(stats.accSum / stats.accN, 1) + " %"
      : "–";
}

// ---------- Ovládání ----------
function wire() {
  if (E.btnBack)
    E.btnBack.addEventListener("click", () => {
      if (step > 0) step--;
      render();
    });
  if (E.btnNext)
    E.btnNext.addEventListener("click", () => {
      if (step < 3) step++;
      render();
    });
  if (E.btnCheck) E.btnCheck.addEventListener("click", doCheck);
  if (E.btnNew)
    E.btnNew.addEventListener("click", () => {
      problem = makeProblem();
      step = 0;
      render();
    });
  if (E.btnReset)
    E.btnReset.addEventListener("click", () => {
      stats = { ok: 0, err: 0, accSum: 0, accN: 0 };
      setStats();
      problem = makeProblem();
      step = 0;
      render();
    });
}

// ---------- Start ----------
document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  // drobný smoke-test v levém panelu: zobrazí se hned po startu
  if (E.zadaniText && !problem) {
    E.zadaniText.innerHTML =
      '<span class="small muted">Klikni <b>Nová úloha</b> a začni.</span>';
  }
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
  setStats();
  wire();
  render();
});
