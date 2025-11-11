// Generátor slovních úloh na účinnost (výkony W/kW/MW)
const $ = (id)=>document.getElementById(id);
const screen = document.getElementById('screen');
document.getElementById('year').textContent = new Date().getFullYear();

const F = { W:1, kW:1000, MW:1_000_000 };
const fmtW = (w)=> w>=1_000_000? (w/1_000_000).toFixed(3)+' MW' : w>=1000? (w/1000).toFixed(3)+' kW' : w.toFixed(2)+' W';

let step = 0;
let problem = null;
let stats = { ok:0, err:0, accSum:0, accN:0 };

const DEVICES=[
  {id:'zarovka',name:'Žárovka'}, {id:'motor',name:'Motor'}, {id:'turbina',name:'Turbína'},
  {id:'cerpadlo',name:'Čerpadlo'}, {id:'pec',name:'Elektrická pec'}
];

function makeProblem(){
  const dev = DEVICES[Math.floor(Math.random()*DEVICES.length)];
  const type = ['eta','puse','pin'][Math.floor(Math.random()*3)];
  const PinW = [200, 5000, 60, 2_000_000][Math.floor(Math.random()*4)];
  const eta = [35,55,60,75,85][Math.floor(Math.random()*5)];
  const PuseW = PinW * (eta/100);
  let p = { device:dev, type, PinW, PuseW, eta };
  const pick = (w)=> w>=1_000_000? {v:w/1_000_000,u:'MW'} : w>=1000? {v:w/1000,u:'kW'} : {v:w,u:'W'};
  p.Pin = pick(PinW); p.Puse = pick(PuseW);
  if(type==='eta'){
    p.text = `${dev.name} odebírá celkový příkon ${p.Pin.v.toFixed(3)} ${p.Pin.u}. Užitečný výkon je ${p.Puse.v.toFixed(3)} ${p.Puse.u}. Urči účinnost zařízení.`;
    p.ask = 'Vypočítej účinnost η v procentech.';
  }else if(type==='puse'){
    p.text = `${dev.name} má účinnost ${eta}% a odebírá celkový příkon ${p.Pin.v.toFixed(3)} ${p.Pin.u}. Urči užitečný výkon.`;
    p.ask = 'Vypočítej P\u209C\u2096\u2090\u209C (užitečný výkon).';
  }else{
    p.text = `${dev.name} má účinnost ${eta}% a dodává užitečný výkon ${p.Puse.v.toFixed(3)} ${p.Puse.u}. Urči celkový příkon.`;
    p.ask = 'Vypočítej P\u209B\u2099 (celkový příkon).';
  }
  return p;
}

function setStepVisual(){
  document.querySelectorAll('.step').forEach((el,i)=> el.classList.toggle('active', i===step));
  $('#btnBack').disabled = step===0;
  $('#btnNext').disabled = step===3;
}

function render(){
  setStepVisual();
  screen.innerHTML='';
  if(step===0){
    screen.innerHTML = `<h2>1. Zadání</h2>
      <p>${problem.text}</p>
      <div class="badge wip">Úkol: ${problem.ask}</div>
      <div class="hr"></div>
      <p class="small muted">Tip: vyznač si dané a neznámé veličiny. Pracujeme s výkony (W, kW, MW).</p>`;
  }
  if(step===1){
    screen.innerHTML = `<h2>2. Zápis</h2>
      <div class="grid2">
        <div>
          <label>Celkový příkon P<sub>in</sub></label>
          <div class="row gap">
            <input id="pinVal" class="input" type="number" inputmode="decimal" placeholder="hodnota">
            <select id="pinUnit" class="input"><option>W</option><option>kW</option><option>MW</option></select>
          </div>
        </div>
        <div>
          <label>Užitečný výkon P<sub>užit</sub></label>
          <div class="row gap">
            <input id="puseVal" class="input" type="number" inputmode="decimal" placeholder="hodnota">
            <select id="puseUnit" class="input"><option>W</option><option>kW</option><option>MW</option></select>
          </div>
        </div>
      </div>
      <p class="small muted">Opíšete hodnoty ze zadání. Pokud v zadání chybí, pole nechte prázdné.</p>
      <div id="writeMsg" class="small"></div>`;
    $('#pinUnit').value = problem.Pin.u; $('#puseUnit').value = problem.Puse.u;
    $('#pinVal').placeholder = problem.type==='pin' ? '?' : problem.Pin.v.toFixed(3);
    $('#puseVal').placeholder = problem.type==='puse' ? '?' : problem.Puse.v.toFixed(3);
  }
  if(step===2){
    let input = '';
    if(problem.type==='eta'){
      input = `<label>Výsledek – účinnost η (%)</label>
               <input id="eta" class="input" type="number" inputmode="decimal" placeholder="např. 75">
               <p class="small muted">η = P<sub>užit</sub> / P<sub>in</sub> × 100 %</p>`;
    }else if(problem.type==='puse'){
      input = `<label>Výsledek – P<sub>užit</sub></label>
               <div class="row gap">
                 <input id="puseCalc" class="input" type="number" inputmode="decimal" placeholder="hodnota">
                 <select id="puseCalcUnit" class="input"><option>W</option><option>kW</option><option>MW</option></select>
               </div>
               <p class="small muted">P<sub>užit</sub> = η · P<sub>in</sub></p>`;
    }else{
      input = `<label>Výsledek – P<sub>in</sub></label>
               <div class="row gap">
                 <input id="pinCalc" class="input" type="number" inputmode="decimal" placeholder="hodnota">
                 <select id="pinCalcUnit" class="input"><option>W</option><option>kW</option><option>MW</option></select>
               </div>
               <p class="small muted">P<sub>in</sub> = P<sub>užit</sub> / η</p>`;
    }
    screen.innerHTML = `<h2>3. Výpočet</h2>${input}<div id="calcMsg" class="small"></div>`;
    if($('#puseCalcUnit')) $('#puseCalcUnit').value = problem.Puse.u;
    if($('#pinCalcUnit')) $('#pinCalcUnit').value = problem.Pin.u;
  }
  if(step===3){
    screen.innerHTML = `<h2>4. Odpověď</h2>
      <textarea id="ans" rows="3" class="input" placeholder="Zapíšete stručnou odpověď celou větou..."></textarea>
      <div class="small muted">Např.: „Účinnost motoru je 75 %.“</div>
      <div id="ansMsg" class="small"></div>`;
  }
}

function check(){
  if(step===1){
    const pinV = Number($('#pinVal').value), pinU = $('#pinUnit').value;
    const puseV = Number($('#puseVal').value), puseU = $('#puseUnit').value;
    let ok=true, msg=[];
    if(problem.type!=='pin'){
      const want = problem.Pin.v*F[problem.Pin.u], got = pinV*F[pinU];
      if(!(isFinite(got) && Math.abs(got-want) < Math.max(1e-6,want*0.001))){ ok=false; msg.push('P_in neodpovídá zadání.'); }
    } else if($('#pinVal').value.trim()!==''){ ok=false; msg.push('P_in v zadání chybí – v zápisu ho nevyplňuj.'); }
    if(problem.type!=='puse'){
      const want = problem.Puse.v*F[problem.Puse.u], got = puseV*F[puseU];
      if(!(isFinite(got) && Math.abs(got-want) < Math.max(1e-6,want*0.001))){ ok=false; msg.push('P_užit neodpovídá zadání.'); }
    } else if($('#puseVal').value.trim()!==''){ ok=false; msg.push('P_užit v zadání chybí – v zápisu ho nevyplňuj.'); }
    $('#writeMsg').innerHTML = ok ? '<span class="success">✅ Zápis odpovídá zadání.</span>'
                                  : '<span class="error">❌ '+msg.join(' ')+'</span>';
    return ok;
  }
  if(step===2){
    const tolRel = 0.005;
    let ok=false, acc=0, message='';
    if(problem.type==='eta'){
      const eta = Number($('#eta').value);
      if(isFinite(eta)){ acc = 100 - Math.min(100, Math.abs(eta-problem.eta)); ok = Math.abs(eta-problem.eta) <= problem.eta*tolRel; }
      message = ok? `✅ Správně. η = ${problem.eta.toFixed(1)} %.` : `❌ Nesouhlasí. Očekává se ~${problem.eta.toFixed(1)} %.`;
    }else if(problem.type==='puse'){
      const v = Number($('#puseCalc').value), u = $('#puseCalcUnit').value;
      const gotW = v*F[u], wantW = problem.PuseW;
      if(isFinite(gotW)){ acc = 100 - Math.min(100, Math.abs(gotW-wantW)/wantW*100); ok = Math.abs(gotW-wantW) <= wantW*tolRel; }
      message = ok? `✅ Správně. P_užit = ${fmtW(wantW)}.` : `❌ Nesouhlasí. Očekává se ~${fmtW(wantW)}.`;
    }else{
      const v = Number($('#pinCalc').value), u = $('#pinCalcUnit').value;
      const gotW = v*F[u], wantW = problem.PinW;
      if(isFinite(gotW)){ acc = 100 - Math.min(100, Math.abs(gotW-wantW)/wantW*100); ok = Math.abs(gotW-wantW) <= wantW*tolRel; }
      message = ok? `✅ Správně. P_in = ${fmtW(wantW)}.` : `❌ Nesouhlasí. Očekává se ~${fmtW(wantW)}.`;
    }
    $('#calcMsg').innerHTML = ok? '<span class="success">'+message+'</span>' : '<span class="error">'+message+'</span>';
    if(ok){ stats.ok++; stats.accSum+=acc; stats.accN++; } else { stats.err++; }
    updateStats(); return ok;
  }
  if(step===3){
    const txt = ($('#ans').value||'').trim();
    const ok = txt.length>0;
    let sample='';
    if(problem.type==='eta') sample = `Účinnost ${problem.device.name.toLowerCase()} je ${problem.eta.toFixed(1)} %.`;
    if(problem.type==='puse') sample = `Užitečný výkon je přibližně ${fmtW(problem.PuseW)}.`;
    if(problem.type==='pin') sample = `Celkový příkon je přibližně ${fmtW(problem.PinW)}.`;
    $('#ansMsg').innerHTML = ok? '<span class="success">✅ Odpověď zapsána.</span> <span class="badge ok">Vzorem: '+sample+'</span>'
                               : '<span class="error">❌ Doplň slovní odpověď v jedné větě.</span>';
    return ok;
  }
  return true;
}

function updateStats(){
  $('#okCount').textContent = stats.ok;
  $('#errCount').textContent = stats.err;
  $('#avgAcc').textContent = stats.accN ? (stats.accSum/stats.accN).toFixed(1)+' %' : '–';
}

document.getElementById('btnNew').addEventListener('click', ()=>{ problem = makeProblem(); step=0; render(); });
document.getElementById('btnReset').addEventListener('click', ()=>{ stats={ok:0,err:0,accSum:0,accN:0}; updateStats(); problem = makeProblem(); step=0; render(); });
document.getElementById('btnBack').addEventListener('click', ()=>{ if(step>0){ step--; render(); }});
document.getElementById('btnNext').addEventListener('click', ()=>{ if(step<3){ step++; render(); }});
document.getElementById('btnCheck').addEventListener('click', ()=>{ check(); });

// init
problem = makeProblem();
render();
updateStats();
