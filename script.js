// ---- SMOKE TEST skriptu ----
console.log('[UCINNOST] script.js LOADED at', new Date().toISOString());

document.addEventListener('DOMContentLoaded', () => {
  console.log('[UCINNOST] DOMContentLoaded');

  // Zkusíme najít základní prvky podle ID
  const ids = ['btnNew','btnReset','btnBack','btnNext','btnCheck','content','zadaniText','knownBox'];
  const found = Object.fromEntries(ids.map(id => [id, !!document.getElementById(id)]));
  console.log('[UCINNOST] elements present:', found);

  // Připíchneme logování kliků
  ['btnNew','btnReset','btnBack','btnNext','btnCheck'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => console.log('[UCINNOST] klik', id));
  });

  // Pro vizuální potvrzení, že umíme měnit DOM
  const zad = document.getElementById('zadaniText');
  if (zad) zad.innerHTML = '✅ Smoke test: skript běží, DOM měnit UMÍM.';
});
