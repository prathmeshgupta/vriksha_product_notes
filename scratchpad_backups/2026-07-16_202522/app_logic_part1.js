// ============================================================================
// Vriksha Product Note Studio — Application Logic
// Persistence: localStorage (auto) + manual JSON snapshot export/import (backup)
// ============================================================================

const STORAGE_KEY = "vriksha_pns_state_v1";

// ---------- STATE ----------
// state.products[id] = { current: {...editableFields}, status: 'draft'|'published', archived: bool, versions: [{...snapshot, meta}] }
let state = { products: {}, lastSaved: null };

function initState() {
  const saved = loadFromLocalStorage();
  if (saved) {
    state = saved;
    // migrate older snapshots that predate the `archived` flag
    Object.values(state.products).forEach(entry => {
      if (entry.archived === undefined) entry.archived = false;
    });
    return;
  }
  // bootstrap from BASE_PRODUCTS (static seed data)
  BASE_PRODUCTS.forEach(p => {
    state.products[p.id] = {
      current: JSON.parse(JSON.stringify(p)),
      status: "draft",
      archived: false,
      versions: []
    };
  });
  saveToLocalStorage();
}

function saveToLocalStorage() {
  try {
    state.lastSaved = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("localStorage save failed", e);
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("localStorage load failed", e);
    return null;
  }
}

function getProduct(id) { return state.products[id].current; }
function getEntry(id) { return state.products[id]; }
function getAllProducts(opts) {
  opts = opts || {};
  const includeArchived = !!opts.includeArchived;
  return Object.keys(state.products)
    .map(id => state.products[id])
    .filter(entry => includeArchived || !entry.archived)
    .map(entry => entry.current)
    .sort((a,b)=> a.id.localeCompare(b.id, undefined, {numeric:true}));
}
function getArchivedProducts() {
  return Object.keys(state.products)
    .map(id => state.products[id])
    .filter(entry => entry.archived)
    .map(entry => entry.current)
    .sort((a,b)=> a.id.localeCompare(b.id, undefined, {numeric:true}));
}

// ---------- ID GENERATION ----------
// Existing products use P1..P9. New products get PN10, PN11, ... (PN = "product, new")
// to keep them visually distinguishable from the original seed set at a glance.
function nextProductId() {
  const existing = Object.keys(state.products);
  let n = 10;
  while (existing.includes("PN" + n)) n++;
  return "PN" + n;
}

// ---------- CREATE (template-based) ----------
function createProductFromTemplate(templateId, newName, newCode) {
  const template = getProduct(templateId);
  const newId = nextProductId();
  const cloned = JSON.parse(JSON.stringify(template));
  cloned.id = newId;
  cloned.code = newCode || (template.code + "-NEW");
  cloned.name = newName || (template.name + " (Copy)");
  cloned.shortName = newName || (template.shortName ? template.shortName + " (Copy)" : cloned.name);
  state.products[newId] = {
    current: cloned,
    status: "draft",
    archived: false,
    versions: []
  };
  saveToLocalStorage();
  return newId;
}

// ---------- ARCHIVE / UNARCHIVE ----------
function archiveProduct(id) {
  state.products[id].archived = true;
  saveToLocalStorage();
}
function unarchiveProduct(id) {
  state.products[id].archived = false;
  saveToLocalStorage();
}

// ---------- NAV / ROUTING ----------
let currentView = "overview";
let currentProductId = null;
let uploadedConstituents = {};

// ---------- SIDEBAR COLLAPSE ----------
const SIDEBAR_COLLAPSE_KEY = "vriksha_pns_sidebar_collapsed_v1";
function toggleSidebar(){
  const sb = document.getElementById("appSidebar");
  const btn = document.getElementById("sidebarToggle");
  const collapsed = sb.classList.toggle("collapsed");
  btn.textContent = collapsed ? "›" : "‹";
  btn.title = collapsed ? "Expand menu" : "Collapse menu";
  try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? "1" : "0"); } catch(e){}
}
function initSidebarCollapse(){
  let collapsed = false;
  try { collapsed = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1"; } catch(e){}
  if(collapsed){
    const sb = document.getElementById("appSidebar");
    const btn = document.getElementById("sidebarToggle");
    if(sb) sb.classList.add("collapsed");
    if(btn){ btn.textContent = "›"; btn.title = "Expand menu"; }
  }
}

function riskClass(r){
  if(!r) return "risk-var";
  const s = r.toLowerCase();
  if(s.includes("variant") || s.includes("time-varying")) return "risk-var";
  if(s.includes("high")) return "risk-high";
  if(s.includes("moderate") || s.includes("mod")) return "risk-mod";
  if(s.includes("low")) return "risk-low";
  return "risk-var";
}

function renderNav(){
  const q = (document.getElementById("navSearch").value || "").toLowerCase();
  const list = document.getElementById("navList");
  list.innerHTML = "";
  const all = getAllProducts();
  const discretionary = all.filter(p=>p.category.startsWith("Discretionary"));
  const systematic = all.filter(p=>p.category.startsWith("Systematic"));
  const other = all.filter(p=>!p.category.startsWith("Discretionary") && !p.category.startsWith("Systematic"));
  function group(title, arr){
    const filtered = arr.filter(p => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    if(!filtered.length) return;
    const h = document.createElement("div");
    h.className = "nav-group-title";
    h.textContent = title;
    list.appendChild(h);
    filtered.forEach(p=>{
      const entry = getEntry(p.id);
      const el = document.createElement("div");
      el.className = "nav-item" + (currentProductId===p.id && (currentView==="product"||currentView==="edit"||currentView==="history") ? " active" : "");
      el.innerHTML = `<span>${p.shortName || p.name}<br><span class="code">${p.code} · ${p.id}</span></span><span class="status-dot ${entry.status}" title="${entry.status}"></span>`;
      el.onclick = ()=>showProduct(p.id);
      list.appendChild(el);
    });
  }
  group("Discretionary", discretionary);
  group("Systematic", systematic);
  group("Other / Custom", other);
  const archivedCount = getArchivedProducts().length;
  if(archivedCount){
    const h = document.createElement("div");
    h.className = "nav-group-title";
    h.textContent = `Archived (${archivedCount})`;
    list.appendChild(h);
    const el = document.createElement("div");
    el.className = "nav-item";
    el.style.color = "var(--text-faint)";
    el.textContent = "View archived products →";
    el.onclick = ()=>showView("archive");
    list.appendChild(el);
  }
}

function showView(v){
  currentView = v;
  document.querySelectorAll(".sidebar > .nav-item").forEach(n=>n.classList.remove("active"));
  const navEl = document.getElementById("nav-"+v);
  if(navEl) navEl.classList.add("active");
  if(v==="overview") renderOverview();
  if(v==="csv") renderCsvView();
  if(v==="roadmap") renderRoadmap();
  if(v==="backup") renderBackupView();
  if(v==="archive") renderArchiveView();
  if(v==="create") renderCreateView();
  renderNav();
}

function showProduct(id){
  currentView = "product";
  currentProductId = id;
  renderProduct(id);
  renderNav();
}

function showEdit(id){
  currentView = "edit";
  currentProductId = id;
  renderEdit(id);
  renderNav();
}

function showHistory(id){
  currentView = "history";
  currentProductId = id;
  renderHistory(id);
  renderNav();
}

// ---------- OVERVIEW ----------
function renderOverview(){
  const main = document.getElementById("main");
  const all = getAllProducts();
  const publishedCount = all.filter(p=>getEntry(p.id).status==="published").length;
  const archivedCount = getArchivedProducts().length;
  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Product Note Studio</h1>
        <div class="topbar-sub">${all.length} active products · ${publishedCount} published · ${all.length-publishedCount} draft${archivedCount ? ` · ${archivedCount} archived` : ""}</div>
      </div>
      <div class="toolbar">
        <button class="btn primary" onclick="showView('create')">+ New Product</button>
        <button class="btn" onclick="exportAllXlsx()">Export All → Excel</button>
        <button class="btn" onclick="showView('backup')">Backup / Sync</button>
      </div>
    </div>
    <div class="callout">${all.length} active discretionary &amp; systematic portfolio products, India-focused, smallcase-ready. Click a card to view, edit, publish, or export. Amber dot = draft, green dot = published.</div>
    <div class="grid-overview" id="overviewGrid"></div>
  `;
  const grid = document.getElementById("overviewGrid");
  all.forEach(p=>{
    const isSys = p.category.startsWith("Systematic");
    const entry = getEntry(p.id);
    const card = document.createElement("div");
    card.className = "p-card";
    card.onclick = ()=>showProduct(p.id);
    card.innerHTML = `
      <span class="tag ${isSys?'sys':''}">${p.id} · ${p.code} <span class="status-pill ${entry.status}" style="margin-left:auto;"><span class="dot"></span>${entry.status}</span></span>
      <h3>${p.name}</h3>
      <p>${(p.objective||"").slice(0,130)}...</p>
      <div class="meta">
        <span class="risk-badge ${riskClass(p.riskProfile)}">${p.riskProfile}</span>
        <span>${p.assetClasses.length} asset class${p.assetClasses.length>1?'es':''}</span>
        <span>v${entry.versions.length}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ---------- CREATE NEW PRODUCT ----------
function renderCreateView(){
  const main = document.getElementById("main");
  const all = getAllProducts();
  const options = all.map(p=>`<option value="${p.id}">${p.id} — ${p.name} (${p.category})</option>`).join("");
  main.innerHTML = `
    <div class="topbar"><div><h1>New Product Note</h1><div class="topbar-sub">Clone the closest existing product as a starting shape, then edit</div></div></div>
    <div class="callout">Choose whichever existing product has the closest structure to what you're building — a risk-profiled variant set, a goal-based glide path, a style-sleeve equity product, etc. This copies its field structure (not its content) so you're editing, not building from a blank form.</div>
    <div class="card">
      <div class="field-row"><div class="field-label">Template</div>
        <select id="createTemplateSelect">${options}</select>
      </div>
      <div class="field-row"><div class="field-label">New Product Name</div>
        <input type="text" id="createNameInput" placeholder="e.g. Discretionary Multi-Asset Portfolio — Aggressive Growth Variant">
      </div>
      <div class="field-row"><div class="field-label">New Product Code</div>
        <input type="text" id="createCodeInput" placeholder="e.g. DMAP-AGV" class="input-sm">
      </div>
      <div style="margin-top:16px;">
        <button class="btn primary" onclick="handleCreateProduct()">Create &amp; Open for Editing</button>
        <button class="btn" onclick="showView('overview')">Cancel</button>
      </div>
    </div>
  `;
}

function handleCreateProduct(){
  const templateId = document.getElementById("createTemplateSelect").value;
  const name = document.getElementById("createNameInput").value.trim();
  const code = document.getElementById("createCodeInput").value.trim();
  if(!name){ alert("Please enter a name for the new product."); return; }
  const newId = createProductFromTemplate(templateId, name, code || undefined);
  showEdit(newId);
}

// ---------- ARCHIVE VIEW ----------
function renderArchiveView(){
  const main = document.getElementById("main");
  const archived = getArchivedProducts();
  main.innerHTML = `
    <div class="topbar"><div><h1>Archived Products</h1><div class="topbar-sub">${archived.length} archived · excluded from main overview and bulk exports · fully recoverable</div></div></div>
    <div class="callout">Archiving never deletes data — everything here can be restored to the active list at any time. Nothing in this studio permanently deletes a product note.</div>
    <div class="grid-overview" id="archiveGrid"></div>
  `;
  const grid = document.getElementById("archiveGrid");
  if(!archived.length){
    grid.innerHTML = `<div class="card"><p style="color:var(--text-faint);">No archived products.</p></div>`;
    return;
  }
  archived.forEach(p=>{
    const entry = getEntry(p.id);
    const card = document.createElement("div");
    card.className = "p-card";
    card.innerHTML = `
      <span class="tag">${p.id} · ${p.code}</span>
      <h3>${p.name}</h3>
      <p>${(p.objective||"").slice(0,130)}...</p>
      <div class="toolbar" style="margin-top:10px;">
        <button class="btn small" onclick="event.stopPropagation(); showProduct('${p.id}')">View</button>
        <button class="btn small primary" onclick="event.stopPropagation(); handleUnarchive('${p.id}')">Restore</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function handleUnarchive(id){
  unarchiveProduct(id);
  renderNav();
  showView("archive");
}

function handleArchive(id){
  if(!confirm("Archive this product? It will move out of the main overview and bulk exports, but stays fully recoverable from the Archived section.")) return;
  archiveProduct(id);
  renderNav();
  showView("overview");
}
