// PWA app logic (mobile-first)
const STORAGE_KEY = "aseguradosDataV1";
const VERSION = "1.0.2";

const state = { data: [], editIndex: null };

const els = {
  search: document.getElementById("searchInput"),
  clearSearch: document.getElementById("clearSearch"),
  tbody: document.getElementById("tbody"),
  emptyMsg: document.getElementById("emptyMsg"),
  modal: document.getElementById("modal"),
  modalForm: document.getElementById("modalForm"),
  modalTitle: document.getElementById("modalTitle"),
  dniInput: document.getElementById("dniInput"),
  apellidoInput: document.getElementById("apellidoInput"),
  nombreInput: document.getElementById("nombreInput"),
  estadoInput: document.getElementById("estadoInput"),
  addBtn: document.getElementById("addBtn"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  importJsonInput: document.getElementById("importJsonInput"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  alertDebtorsBtn: document.getElementById("alertDebtorsBtn"),
  installBtn: document.getElementById("installBtn"),
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(console.error);
  });
}

let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.installBtn.hidden = false;
});
els.installBtn?.addEventListener("click", async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installBtn.hidden = true;
  }
});

function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data)); }

async function load(){
  let cache = localStorage.getItem(STORAGE_KEY);
  let fromCache = false;
  if (cache) {
    try {
      const parsed = JSON.parse(cache);
      if (Array.isArray(parsed) && parsed.length > 0) { state.data = parsed; fromCache = true; }
    } catch(e){ /* ignore */ }
  }
  if (!fromCache) {
    const res = await fetch("data.json?v=" + Date.now());
    state.data = await res.json(); save();
  }
  render();
}

function render(items=null){
  const arr = items || state.data;
  els.tbody.innerHTML = "";
  if (!arr.length){ els.emptyMsg.hidden = false; return; }
  els.emptyMsg.hidden = true;
  for (const [idx, item] of arr.entries()){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.dni}</td>
      <td>${item.apellido}</td>
      <td>${item.nombre}</td>
      <td><span class="status ${item.estado}">${item.estado}</span></td>
      <td class="row-actions">
        <button class="btn tiny" data-action="toggle" data-idx="${idx}">${item.estado === "PAGO" ? "Marcar DEBE" : "Marcar PAGO"}</button>
        <button class="btn tiny danger" data-action="delete" data-idx="${idx}">Quitar</button>
        <button class="btn tiny" data-action="edit" data-idx="${idx}">Editar</button>
      </td>`;
    els.tbody.appendChild(tr);
  }
}

function filter(){
  const q = els.search.value.trim().toLowerCase();
  if (!q) return render();
  const out = state.data.filter(p => 
    p.dni.includes(q) || p.nombre.toLowerCase().includes(q) || p.apellido.toLowerCase().includes(q)
  );
  render(out);
}

function to8Digits(dni){ const only=(dni||"").replace(/\D/g,""); return only.slice(-8); }

function parseCSV(text){
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].toLowerCase().split(",").map(s=>s.trim());
  const idxDni = header.indexOf("dni");
  const idxApe = header.indexOf("apellido");
  const idxNom = header.indexOf("nombre");
  const idxEst = header.indexOf("estado");
  if (idxDni<0 || idxApe<0 || idxNom<0 || idxEst<0) throw new Error("CSV debe tener encabezado dni,apellido,nombre,estado");
  const out=[];
  for (let i=1;i<lines.length;i++){
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(",").map(s=>s.trim());
    out.push({ dni: to8Digits(cols[idxDni]||""), apellido: cols[idxApe]||"", nombre: cols[idxNom]||"", estado: (cols[idxEst]||"PAGO").toUpperCase()==="DEBE"?"DEBE":"PAGO" });
  }
  return out;
}

function openModal(editIndex=null){
  state.editIndex = editIndex;
  if (editIndex===null){ els.modalTitle.textContent="Agregar Persona"; els.modalForm.reset(); }
  else { const p = state.data[editIndex]; els.modalTitle.textContent="Editar Persona"; els.dniInput.value=p.dni; els.apellidoInput.value=p.apellido; els.nombreInput.value=p.nombre; els.estadoInput.value=p.estado; }
  els.modal.showModal();
}

function upsertFromModal(e){
  e.preventDefault();
  const dni = to8Digits(els.dniInput.value), apellido=els.apellidoInput.value.trim(), nombre=els.nombreInput.value.trim(), estado=els.estadoInput.value;
  if (!dni || dni.length<7 || !apellido || !nombre){ alert("Completa DNI (7/8), Apellido y Nombre."); return; }
  const person = { dni, apellido, nombre, estado };
  if (state.editIndex===null){
    const i = state.data.findIndex(p=>p.dni===dni);
    if (i>=0){ if (!confirm("Ya existe un registro con ese DNI. ¿Reemplazar?")) return; state.data[i]=person; }
    else state.data.push(person);
  } else { state.data[state.editIndex]=person; }
  save(); els.modal.close(); filter();
}

els.tbody.addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-action]"); if (!btn) return;
  const idx = Number(btn.dataset.idx); const action = btn.dataset.action;
  if (action==="toggle"){ state.data[idx].estado = state.data[idx].estado==="PAGO"?"DEBE":"PAGO"; save(); filter(); }
  if (action==="delete"){ if (confirm("¿Quitar esta persona?")){ state.data.splice(idx,1); save(); filter(); } }
  if (action==="edit"){ openModal(idx); }
});

els.search.addEventListener("input", filter);
els.clearSearch.addEventListener("click", ()=>{ els.search.value=""; filter(); });
els.addBtn.addEventListener("click", ()=>openModal(null));
els.modalForm.addEventListener("submit", upsertFromModal);

els.exportJsonBtn.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(state.data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="asegurados-backup.json"; a.click(); URL.revokeObjectURL(url);
});

els.importJsonInput.addEventListener("change", async (e)=>{
  const file = e.target.files?.[0]; if (!file) return;
  try{
    const text = await file.text(); let arr;
    if (file.name.toLowerCase().endsWith(".csv")) arr = parseCSV(text); else arr = JSON.parse(text);
    if (!Array.isArray(arr)) throw new Error("Formato inválido");
    for (const it of arr){
      if (!it.dni || !it.apellido || !it.nombre || !it.estado) throw new Error("Campos faltantes");
      it.dni = to8Digits(it.dni); it.estado = it.estado==="DEBE"?"DEBE":"PAGO";
    }
    state.data = arr; save(); filter(); alert("Backup importado correctamente.");
  }catch(err){ alert("Error al importar: " + err.message); }
  finally{ e.target.value=""; }
});

els.exportPdfBtn.addEventListener("click", ()=>window.print());

function countDebtors(){ return state.data.filter(p=>p.estado==="DEBE").length; }
els.alertDebtorsBtn.addEventListener("click", async ()=>{
  const n = countDebtors(); alert(`Deudores: ${n}`);
  if ("Notification" in window){
    try{
      let perm = Notification.permission; if (perm==="default") perm = await Notification.requestPermission();
      if (perm==="granted"){ new Notification("Asegurados", { body: `Tenés ${n} deudor(es).`, icon: "icons/icon-192.png" }); }
    }catch(e){}
  }
});

// Restore bundled dataset on demand
document.getElementById("resetDataBtn")?.addEventListener("click", async () => {
  if (!confirm("Esto reemplazará todos los datos locales por el padrón inicial. ¿Continuar?")) return;
  try{
    const res = await fetch("data.json?reset=" + Date.now());
    const json = await res.json();
    if (!Array.isArray(json) || json.length===0) throw new Error("data.json vacío o inválido");
    state.data = json; save(); filter(); alert("Padrón restaurado correctamente.");
  }catch(err){ alert("No se pudo restaurar el padrón: " + err.message); }
});

// Install help visibility
const helpEl = document.getElementById("installHelp");
setTimeout(()=>{
  const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  if (helpEl) helpEl.style.display = isStandalone ? 'none' : 'block';
}, 1200);

load();
