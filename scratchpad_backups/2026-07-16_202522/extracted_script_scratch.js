const BASE_PRODUCTS = [{"id":"P1","code":"DSOP","name":"Complete Discretionary Stock-Only Portfolio","shortName":"Discretionary Equity (GARP + Value + Special Situations)","category":"Discretionary — Single Asset Class (Equity)","assetClasses":["Indian Equities (direct stocks)"],"objective":"placeholder","philosophy":"placeholder","styleSleeves":[{"name":"GARP","weightRange":"35–55%","criteria":"x","universe":"x","indicativeNames":"x"}],"portfolioConstructionRules":{"stockCountRange":"15-25","singleStockCap":"10%","sectorCap":"30% (25% BFSI)","cashBuffer":"0-5%"},"portfolioConstruction":"x","benchmark":"x","rebalanceFrequency":"x","riskProfile":"High","suitability":"x","minInvestment":"x","fees":"x","taxNote":"x","keyRisks":["a","b"]}];
// ============================================================================
// Vriksha Product Note Studio — Application Logic
// Persistence: Supabase (Postgres + Auth). Auth-gated; no localStorage app data.
// ============================================================================

const SUPABASE_URL = "https://djrzjwhqzenykzfuzfhj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_YMEOr-QkwD2tlkRsWQEYxg_1dSm2ygB";

let sb = null;
let supabaseInitError = null;
try {
  if (typeof window.supabase === "undefined" || !window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Supabase client library did not load from the CDN (cdn.jsdelivr.net). This is usually an ad-blocker, corporate firewall, or network issue blocking that domain.");
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  supabaseInitError = err;
  console.error("Supabase init failed:", err);
}

// ---------- STATE ----------
let state = { products: {}, templates: {}, lastSaved: null };
let currentUser = null; // { id, email }

// ---------- AUTH ----------
function showLoginScreen(errorMsg){
  document.getElementById("bootLoading").style.display = "none";
  document.getElementById("appRoot").style.display = "none";
  document.getElementById("loginScreen").style.display = "flex";
  const errEl = document.getElementById("loginError");
  if(errorMsg){
    errEl.textContent = errorMsg;
    errEl.classList.add("show");
  } else {
    errEl.textContent = "";
    errEl.classList.remove("show");
  }
}

function showAppScreen(){
  document.getElementById("bootLoading").style.display = "none";
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appRoot").style.display = "flex";
  const badge = document.getElementById("userBadgeEmail");
  if(badge) badge.textContent = currentUser ? currentUser.email : "—";
}

async function handleLoginSubmit(evt){
  evt.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const btn = document.getElementById("loginSubmitBtn");
  const errEl = document.getElementById("loginError");
  errEl.classList.remove("show");
  if(!email || !password){
    errEl.textContent = "Enter both email and password.";
    errEl.classList.add("show");
    return false;
  }
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if(error){
      errEl.textContent = error.message || "Invalid email or password.";
      errEl.classList.add("show");
      return false;
    }
    // onAuthStateChange will pick up the new session and boot the app.
  } catch(err){
    errEl.textContent = "Sign-in failed: " + (err && err.message ? err.message : err);
    errEl.classList.add("show");
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
  return false;
}

async function handleSignOut(){
  if(!confirm("Sign out of Vriksha Product Note Studio?")) return;
  try {
    await sb.auth.signOut();
  } catch(err){
    console.warn("signOut failed", err);
  }
  // onAuthStateChange handles the screen swap back to login.
}

// ---------- GLOBAL ERROR BANNER ----------
function showGlobalError(msg){
  const banner = document.getElementById("globalErrorBanner");
  const text = document.getElementById("globalErrorText");
  if(!banner || !text) { console.error(msg); return; }
  text.textContent = msg;
  banner.style.display = "flex";
}
function dismissGlobalError(){
  const banner = document.getElementById("globalErrorBanner");
  if(banner) banner.style.display = "none";
}

// ---------- SUPABASE DATA LAYER ----------
async function loadAllFromSupabase(){
  const { data: productRows, error: prodErr } = await sb
    .from('products')
    .select('*');
  if(prodErr) throw new Error("Failed to load products: " + prodErr.message);

  const { data: versionRows, error: verErr } = await sb
    .from('product_versions')
    .select('*')
    .order('version_number', { ascending: true });
  if(verErr) throw new Error("Failed to load version history: " + verErr.message);

  let templateRows = [];
  try {
    const { data: tRows, error: tErr } = await sb
      .from('templates')
      .select('*');
    if(tErr) throw tErr;
    templateRows = tRows || [];
  } catch(err){
    console.error("Failed to load templates:", err);
    showGlobalError("Could not load archetype templates: " + err.message + " — Create New Product and Manage Templates may be incomplete until this clears.");
  }

  const versionsByProduct = {};
  (versionRows || []).forEach(v=>{
    if(!versionsByProduct[v.product_id]) versionsByProduct[v.product_id] = [];
    versionsByProduct[v.product_id].push({
      version: v.version_number,
      timestamp: v.created_at,
      note: v.note || "",
      data: v.data
    });
  });

  const newProducts = {};
  (productRows || []).forEach(row=>{
    newProducts[row.id] = {
      current: row.data,
      status: row.status,
      archived: !!row.archived,
      versions: versionsByProduct[row.id] || []
    };
  });
  state.products = newProducts;

  const newTemplates = {};
  templateRows.forEach(row=>{
    newTemplates[row.id] = {
      id: row.id,
      name: row.name,
      description: row.description || "",
      archetype: row.archetype,
      data: row.data
    };
  });
  state.templates = newTemplates;

  state.lastSaved = new Date().toISOString();
}

function getAllTemplates(){
  return Object.keys(state.templates)
    .map(id => state.templates[id])
    .sort((a,b)=> a.name.localeCompare(b.name));
}
function getTemplate(id){ return state.templates[id]; }

async function refreshFromSupabase(){
  try {
    await loadAllFromSupabase();
    dismissGlobalError();
    renderNav();
    // Re-render whatever the user is currently looking at so a refresh is visibly useful.
    if(currentView==="overview") renderOverview();
    else if(currentView==="product" && currentProductId) renderProduct(currentProductId);
    else if(currentView==="edit" && currentProductId) renderEdit(currentProductId);
    else if(currentView==="history" && currentProductId) renderHistory(currentProductId);
    else if(currentView==="archive") renderArchiveView();
    else if(currentView==="create") renderCreateView();
    else if(currentView==="templates") renderTemplatesView();
    updateSyncStatus();
  } catch(err){
    showGlobalError("Refresh failed: " + err.message);
  }
}

function updateSyncStatus(){
  const el = document.getElementById("syncStatusText");
  if(!el) return;
  const t = state.lastSaved ? new Date(state.lastSaved) : null;
  el.textContent = t ? ("last synced " + t.toLocaleTimeString()) : "not synced yet";
}

async function persistProduct(id){
  const entry = state.products[id];
  if(!entry) return;
  try {
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user ? userData.user.id : null;
    const { error } = await sb
      .from('products')
      .update({
        data: entry.current,
        status: entry.status,
        archived: entry.archived,
        code: entry.current.code,
        name: entry.current.name,
        short_name: entry.current.shortName || null,
        category: entry.current.category,
        updated_by: uid
      })
      .eq('id', id);
    if(error) throw error;
    state.lastSaved = new Date().toISOString();
    updateSyncStatus();
  } catch(err){
    showGlobalError("Save failed for " + id + ": " + err.message + " — your edit is kept in this browser tab but was NOT saved to the database. Try again or refresh once the issue clears.");
  }
}

function saveToLocalStorage(){
  if(currentProductId && state.products[currentProductId]){
    persistProduct(currentProductId);
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
function nextProductId() {
  const existing = Object.keys(state.products);
  let n = 10;
  while (existing.includes("PN" + n)) n++;
  return "PN" + n;
}

// ---------- CREATE (3 explicit paths: blank / from archetype template / from existing product) ----------
async function insertNewProduct(cloned){
  state.products[cloned.id] = {
    current: cloned,
    status: "draft",
    archived: false,
    versions: []
  };
  try {
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user ? userData.user.id : null;
    const { error } = await sb.from('products').insert({
      id: cloned.id,
      code: cloned.code,
      name: cloned.name,
      short_name: cloned.shortName || null,
      category: cloned.category,
      status: "draft",
      archived: false,
      data: cloned,
      updated_by: uid
    });
    if(error) throw error;
    state.lastSaved = new Date().toISOString();
    updateSyncStatus();
  } catch(err){
    showGlobalError("Failed to create new product in the database: " + err.message + " — the product exists only in this browser tab until this is resolved.");
  }
  return cloned.id;
}

function blankProductShape(){
  return {
    code: "",
    name: "",
    shortName: "",
    category: "Discretionary — Single Asset Class (Equity)",
    assetClasses: [],
    objective: "",
    philosophy: "",
    benchmark: "",
    rebalanceFrequency: "",
    riskProfile: "",
    suitability: "",
    minInvestment: "",
    fees: "",
    taxNote: "",
    keyRisks: []
  };
}
async function createBlankProduct(newName, newCode){
  const newId = nextProductId();
  const cloned = blankProductShape();
  cloned.id = newId;
  cloned.code = newCode || newId;
  cloned.name = newName;
  cloned.shortName = newName;
  return insertNewProduct(cloned);
}

async function createProductFromTemplate(templateId, newName, newCode) {
  const template = getTemplate(templateId);
  if(!template) throw new Error("Template not found: " + templateId);
  const newId = nextProductId();
  const cloned = JSON.parse(JSON.stringify(template.data));
  cloned.id = newId;
  cloned.code = newCode || newId;
  cloned.name = newName;
  cloned.shortName = newName;
  return insertNewProduct(cloned);
}

async function createProductFromExisting(sourceProductId, newName, newCode) {
  const source = getProduct(sourceProductId);
  if(!source) throw new Error("Source product not found: " + sourceProductId);
  const newId = nextProductId();
  const cloned = JSON.parse(JSON.stringify(source));
  cloned.id = newId;
  cloned.code = newCode || (source.code + "-COPY");
  cloned.name = newName;
  cloned.shortName = newName;
  return insertNewProduct(cloned);
}

// ---------- ARCHIVE / UNARCHIVE ----------
async function archiveProduct(id) {
  state.products[id].archived = true;
  await persistProduct(id);
}
async function unarchiveProduct(id) {
  state.products[id].archived = false;
  await persistProduct(id);
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
  if(v==="templates") renderTemplatesView();
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

// ---------- CREATE NEW PRODUCT (3 explicit paths) ----------
let createPath = "blank"; // "blank" | "template" | "existing"

function renderCreateView(){
  createPath = "blank";
  renderCreateViewBody();
}

function setCreatePath(path){
  createPath = path;
  renderCreateViewBody();
}

function renderCreateViewBody(){
  const main = document.getElementById("main");
  const all = getAllProducts();
  const templates = getAllTemplates();

  const tabBtn = (path, label) =>
    `<button class="btn ${createPath===path ? 'primary' : ''}" onclick="setCreatePath('${path}')">${label}</button>`;

  let bodyHtml = "";
  if(createPath === "blank"){
    bodyHtml = `
      <div class="callout">Starts from an empty product with no pre-filled sleeves, variants, or allocation ranges. Use this when the product doesn't match any existing archetype and you want to build the structure yourself in the editor.</div>
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
    `;
  } else if(createPath === "template"){
    const options = templates.map(t=>`<option value="${t.id}">${t.name}</option>`).join("");
    const selectedId = templates.length ? templates[0].id : null;
    bodyHtml = templates.length ? `
      <div class="callout">Starts from a clean archetype structure — style-sleeve equity, strategic allocation, risk-profiled variants, or goal-based glide path — with placeholder text, not real client content. Manage the available archetypes from <a href="#" onclick="showView('templates');return false;">Manage Templates</a>.</div>
      <div class="field-row"><div class="field-label">Archetype Template</div>
        <select id="createTemplateSelect" onchange="renderCreateTemplateDescription()">${options}</select>
      </div>
      <div class="callout" id="createTemplateDescription" style="margin-top:-8px;"></div>
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
    ` : `
      <div class="callout">No archetype templates exist yet. <a href="#" onclick="showView('templates');return false;">Create one in Manage Templates</a> first, or use "Start Blank" instead.</div>
    `;
  } else if(createPath === "existing"){
    const options = all.map(p=>`<option value="${p.id}">${p.id} — ${p.name} (${p.category})</option>`).join("");
    bodyHtml = `
      <div class="callout">Full copy of a live product's actual content (objective, philosophy, allocation, risk text — everything), given a new ID. Use this when you're building a close variant of something that already exists, not a fresh archetype.</div>
      <div class="field-row"><div class="field-label">Copy From</div>
        <select id="createExistingSelect">${options}</select>
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
    `;
  }

  main.innerHTML = `
    <div class="topbar"><div><h1>New Product Note</h1><div class="topbar-sub">Choose how to start — blank, from an archetype template, or copied from an existing product</div></div></div>
    <div class="card" style="margin-bottom:16px;">
      <div class="toolbar">
        ${tabBtn("blank", "Start Blank")}
        ${tabBtn("template", "From Archetype Template")}
        ${tabBtn("existing", "From Existing Product")}
      </div>
    </div>
    <div class="card">${bodyHtml}</div>
  `;
  if(createPath === "template" && templates.length) renderCreateTemplateDescription();
}

function renderCreateTemplateDescription(){
  const sel = document.getElementById("createTemplateSelect");
  const descEl = document.getElementById("createTemplateDescription");
  if(!sel || !descEl) return;
  const t = getTemplate(sel.value);
  descEl.textContent = t && t.description ? t.description : "";
}

async function handleCreateProduct(){
  const name = document.getElementById("createNameInput").value.trim();
  const code = document.getElementById("createCodeInput").value.trim();
  if(!name){ alert("Please enter a name for the new product."); return; }
  const btn = event && event.target;
  if(btn) { btn.disabled = true; btn.textContent = "Creating…"; }
  try {
    let newId;
    if(createPath === "blank"){
      newId = await createBlankProduct(name, code || undefined);
    } else if(createPath === "template"){
      const templateId = document.getElementById("createTemplateSelect").value;
      newId = await createProductFromTemplate(templateId, name, code || undefined);
    } else if(createPath === "existing"){
      const sourceId = document.getElementById("createExistingSelect").value;
      newId = await createProductFromExisting(sourceId, name, code || undefined);
    }
    showEdit(newId);
  } catch(err){
    showGlobalError("Failed to create product: " + err.message);
  } finally {
    if(btn) { btn.disabled = false; btn.textContent = "Create & Open for Editing"; }
  }
}

// ---------- MANAGE TEMPLATES ----------
let editingTemplateId = null; // null = not editing; "__new__" = creating new

function renderTemplatesView(){
  editingTemplateId = null;
  renderTemplatesViewBody();
}

function renderTemplatesViewBody(){
  const main = document.getElementById("main");
  const templates = getAllTemplates();

  if(editingTemplateId !== null){
    renderTemplateEditor();
    return;
  }

  main.innerHTML = `
    <div class="topbar">
      <div><h1>Manage Templates</h1><div class="topbar-sub">Archetype starting structures used by "New Product → From Archetype Template." Kept separate from live products.</div></div>
      <div class="toolbar"><button class="btn primary" onclick="startNewTemplate()">+ New Template</button></div>
    </div>
    <div class="callout">Templates hold placeholder structure only — never real client content. Editing or deleting a template has no effect on any already-created product; the clone happens once, at creation time.</div>
    <div class="grid-overview" id="templatesGrid"></div>
  `;
  const grid = document.getElementById("templatesGrid");
  if(!templates.length){
    grid.innerHTML = `<div class="callout">No templates yet. Click "+ New Template" to create the first one.</div>`;
    return;
  }
  templates.forEach(t=>{
    const card = document.createElement("div");
    card.className = "p-card";
    card.innerHTML = `
      <span class="tag">${t.archetype}</span>
      <h3>${t.name}</h3>
      <p>${(t.description||"").slice(0,160)}</p>
      <div class="meta" style="margin-top:12px;">
        <button class="btn" onclick="editTemplate('${t.id}')">Edit</button>
        <button class="btn" onclick="handleDeleteTemplate('${t.id}')">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function startNewTemplate(){
  editingTemplateId = "__new__";
  renderTemplateEditor();
}
function editTemplate(id){
  editingTemplateId = id;
  renderTemplateEditor();
}

function renderTemplateEditor(){
  const main = document.getElementById("main");
  const isNew = editingTemplateId === "__new__";
  const t = isNew ? null : getTemplate(editingTemplateId);
  if(!isNew && !t){
    showGlobalError("Template not found — it may have been deleted in another tab.");
    editingTemplateId = null;
    renderTemplatesViewBody();
    return;
  }
  main.innerHTML = `
    <div class="topbar"><div><h1>${isNew ? "New Template" : "Edit Template — " + t.name}</h1><div class="topbar-sub">Structure only — no real client content</div></div></div>
    <div class="card">
      <div class="field-row"><div class="field-label">Template Name</div>
        <input type="text" id="tplNameInput" value="${isNew ? '' : (t.name||'').replace(/"/g,'&quot;')}" placeholder="e.g. Single-Sleeve Equity">
      </div>
      <div class="field-row"><div class="field-label">Description</div>
        <textarea id="tplDescInput" rows="2" placeholder="Shown to users choosing this template on the Create screen">${isNew ? '' : (t.description||'')}</textarea>
      </div>
      <div class="field-row"><div class="field-label">Archetype Tag</div>
        <select id="tplArchetypeInput">
          ${["single-sleeve","strategic-allocation","risk-variant","goal-based","other"].map(a=>
            `<option value="${a}" ${!isNew && t.archetype===a ? 'selected':''}>${a}</option>`).join("")}
        </select>
      </div>
      <div class="field-row"><div class="field-label">Structure (JSON)</div>
        <textarea id="tplDataInput" rows="18" style="font-family:monospace;font-size:12.5px;" placeholder='{"code":"","name":"","...":"..."}'>${isNew ? blankTemplateDataPlaceholder() : JSON.stringify(t.data, null, 2)}</textarea>
        <div class="topbar-sub" style="margin-top:6px;">Same field shape as a product's data (e.g. <code>styleSleeves</code>, <code>variants</code>, <code>portfolioConstructionRules</code>). Must be valid JSON.</div>
      </div>
      <div style="margin-top:16px;">
        <button class="btn primary" onclick="handleSaveTemplate()">Save Template</button>
        <button class="btn" onclick="editingTemplateId=null;renderTemplatesViewBody();">Cancel</button>
      </div>
    </div>
  `;
}

function blankTemplateDataPlaceholder(){
  return JSON.stringify({
    code: "NEW-CODE", name: "New Template Product", shortName: "Short name",
    category: "Discretionary — Single Asset Class (Equity)", assetClasses: [],
    objective: "", philosophy: "", benchmark: "", rebalanceFrequency: "",
    riskProfile: "", suitability: "", minInvestment: "", fees: "", taxNote: "",
    keyRisks: []
  }, null, 2);
}

async function handleSaveTemplate(){
  const name = document.getElementById("tplNameInput").value.trim();
  const description = document.getElementById("tplDescInput").value.trim();
  const archetype = document.getElementById("tplArchetypeInput").value;
  const rawData = document.getElementById("tplDataInput").value;
  if(!name){ alert("Please enter a template name."); return; }
  let parsedData;
  try {
    parsedData = JSON.parse(rawData);
  } catch(err){
    alert("Structure field is not valid JSON: " + err.message);
    return;
  }
  const isNew = editingTemplateId === "__new__";
  const id = isNew ? nextTemplateId() : editingTemplateId;
  const btn = event && event.target;
  if(btn) { btn.disabled = true; btn.textContent = "Saving…"; }
  try {
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user ? userData.user.id : null;
    if(isNew){
      const { error } = await sb.from('templates').insert({
        id, name, description: description || null, archetype, data: parsedData, updated_by: uid
      });
      if(error) throw error;
    } else {
      const { error } = await sb.from('templates')
        .update({ name, description: description || null, archetype, data: parsedData, updated_by: uid })
        .eq('id', id);
      if(error) throw error;
    }
    state.templates[id] = { id, name, description, archetype, data: parsedData };
    editingTemplateId = null;
    dismissGlobalError();
    renderTemplatesViewBody();
  } catch(err){
    showGlobalError("Failed to save template: " + err.message);
  } finally {
    if(btn) { btn.disabled = false; btn.textContent = "Save Template"; }
  }
}

async function handleDeleteTemplate(id){
  const t = getTemplate(id);
  if(!t) return;
  if(!confirm(`Delete template "${t.name}"? This does not affect any product already created from it.`)) return;
  try {
    const { error } = await sb.from('templates').delete().eq('id', id);
    if(error) throw error;
    delete state.templates[id];
    renderTemplatesViewBody();
  } catch(err){
    showGlobalError("Failed to delete template: " + err.message);
  }
}

function nextTemplateId(){
  const existing = Object.keys(state.templates);
  let n = 1;
  while (existing.includes("T" + n)) n++;
  return "T" + n;
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

async function handleUnarchive(id){
  await unarchiveProduct(id);
  renderNav();
  showView("archive");
}

async function handleArchive(id){
  if(!confirm("Archive this product? It will move out of the main overview and bulk exports, but stays fully recoverable from the Archived section.")) return;
  await archiveProduct(id);
  renderNav();
  showView("overview");
}


// ---------- PRODUCT VIEW (read-only) ----------
function kv(label, value){
  return `<div class="kv"><div class="k">${label}</div><div class="v">${value}</div></div>`;
}

function renderProduct(id){
  const p = getProduct(id);
  const entry = getEntry(id);
  const main = document.getElementById("main");
  let html = `
    <div class="topbar">
      <div>
        <h1>${p.name}</h1>
        <div class="topbar-sub">${p.category} · Code: ${p.code} · <span class="status-pill ${entry.status}"><span class="dot"></span>${entry.status}</span> · v${entry.versions.length}</div>
      </div>
      <div class="toolbar">
        <button class="btn primary" onclick="showEdit('${p.id}')">Edit</button>
        <button class="btn" onclick="showHistory('${p.id}')">History &amp; Diff</button>
        <button class="btn" onclick="exportDocx('${p.id}')">→ Word</button>
        <button class="btn" onclick="exportXlsx('${p.id}')">→ Excel</button>
        <button class="btn" onclick="exportPdf('${p.id}')">→ PDF (Full Note)</button>
        <button class="btn" onclick="exportClientSummaryPdf('${p.id}')">→ PDF (Client Summary)</button>
        <button class="btn" onclick="emailNote('${p.id}')">✉ Email This Note</button>
        ${entry.archived ? `<button class="btn" onclick="handleUnarchive('${p.id}')">Restore from Archive</button>` : `<button class="btn danger" onclick="handleArchive('${p.id}')">Archive</button>`}
      </div>
    </div>

    <div class="card">
      ${kv("Risk Profile", `<span class="risk-badge ${riskClass(p.riskProfile)}">${p.riskProfile}</span>`)}
      ${kv("Asset Classes", p.assetClasses.map(a=>`<span class="pill">${a}</span>`).join(""))}
      ${kv("Benchmark", p.benchmark)}
      ${kv("Rebalance Frequency", p.rebalanceFrequency)}
      ${kv("Min. Investment", p.minInvestment || "—")}
      ${kv("Fees", p.fees || "—")}
    </div>

    <h2 class="section">Investment Objective</h2>
    <div class="card"><p>${p.objective}</p></div>

    <h2 class="section">Philosophy &amp; Methodology</h2>
    <div class="card"><p>${p.philosophy || p.selectionMethodology || ""}</p>
    ${p.selectionMethodology && p.philosophy ? `<p style="margin-top:12px;"><strong>Selection Methodology:</strong> ${p.selectionMethodology}</p>` : ""}
    ${p.portfolioConstruction ? `<p style="margin-top:12px;"><strong>Portfolio Construction:</strong> ${p.portfolioConstruction}</p>` : ""}
    ${p.portfolioConstructionNote ? `<div class="callout">${p.portfolioConstructionNote}</div>` : ""}
    </div>
  `;

  if(p.styleSleeves){
    html += `<h2 class="section">Style Sleeves</h2><div class="card"><table><tr><th>Sleeve</th><th>Weight Range</th><th>Criteria</th><th>Universe</th><th>Indicative Names</th></tr>`;
    p.styleSleeves.forEach(s=>{
      html += `<tr><td><strong style="color:var(--mist);">${s.name}</strong></td><td>${s.weightRange}</td><td>${s.criteria}</td><td>${s.universe}</td><td>${s.indicativeNames}</td></tr>`;
    });
    html += `</table></div>`;
  }

  if(p.portfolioConstructionRules){
    html += `<h2 class="section">Construction Rules</h2><div class="card">`;
    html += kv("Stock Count Range", p.portfolioConstructionRules.stockCountRange || "—");
    html += kv("Caps &amp; Position Sizing", formatCapsSentence(p.portfolioConstructionRules));
    html += kv("Cash Buffer", p.portfolioConstructionRules.cashBuffer || "—");
    html += `</div>`;
  }

  if(p.strategicAllocationRanges){
    html += `<h2 class="section">Strategic Allocation Ranges</h2><div class="card"><table><tr><th>Sleeve</th><th>Target Range</th></tr>`;
    p.strategicAllocationRanges.forEach(a=>{ html += `<tr><td>${a.sleeve}</td><td>${a.range}</td></tr>`; });
    html += `</table></div>`;
  }

  if(p.variants){
    html += `<h2 class="section">Risk-Profile Variants</h2><div class="card">`;
    html += `<div class="variant-tabs">` + p.variants.map((v,i)=>`<div class="variant-tab ${i===0?'active':''}" onclick="switchVariant('${p.id}',${i})" id="vtab-${p.id}-${i}">${v.profile}</div>`).join("") + `</div>`;
    p.variants.forEach((v,i)=>{
      html += `<div class="variant-panel" id="vpanel-${p.id}-${i}" style="display:${i===0?'block':'none'};">`;
      if(v.targetInvestor) html += `<p style="color:var(--text-dim); font-size:.82rem; margin-bottom:12px;"><strong style="color:var(--pale);">Target investor:</strong> ${v.targetInvestor}</p>`;
      if(v.factorMix){
        html += kv("Factor Mix", v.factorMix) + kv("Universe", v.universe) + kv("Stock Count", v.stockCount) + kv("Reference Index", v.referenceIndex);
        html += `<p style="margin-top:12px; color:var(--text-dim); font-size:.82rem;">${v.rationale}</p>`;
      }
      if(v.allocation){
        html += `<table><tr><th>Sleeve</th><th>Target Range</th></tr>`;
        v.allocation.forEach(a=>{ html += `<tr><td>${a.sleeve}</td><td>${a.range}</td></tr>`; });
        html += `</table>`;
        if(v.expectedEquityLikeExposure) html += kv("Equity-like Exposure", v.expectedEquityLikeExposure);
      }
      html += `</div>`;
    });
    html += `</div>`;
  }

  if(p.goalFramework){
    html += `<h2 class="section">Life Goal Framework (Glide Path)</h2><div class="card">`;
    p.goalFramework.forEach(g=>{
      html += `<div style="margin-bottom:18px; padding-bottom:16px; border-bottom:1px solid var(--canopy);">
        <strong style="color:var(--mist);">${g.goal}</strong> <span class="pill">${g.horizonBand}</span>
        <p style="margin:10px 0 0; color:var(--text-dim); font-size:.82rem;">${g.glidePath}</p>
        ${g.riskProfileAdjustment ? `<p style="margin:8px 0 0; color:var(--text-faint); font-size:.76rem;"><em>Risk-profile adjustment:</em> ${g.riskProfileAdjustment}</p>` : ""}
      </div>`;
    });
    html += `</div>`;
  }

  const instr = p.indicativeInstruments || p.sharedInstrumentUniverse;
  if(instr){
    html += `<h2 class="section">Indicative Instrument Universe</h2><div class="card">`;
    Object.keys(instr).forEach(k=>{
      html += kv(k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()), instr[k]);
    });
    html += `<div class="callout warn">Illustrative universe based on public data as of mid-2026. Reconfirm eligible instruments, tickers, and AUM/liquidity thresholds at each rebalance and before launch.</div>`;
    html += `</div>`;
  }

  html += `<h2 class="section">Suitability</h2><div class="card"><p>${p.suitability}</p></div>`;

  html += `<h2 class="section">Key Risks</h2><div class="card"><ul class="risk-list">`;
  (p.keyRisks||[]).forEach(r=>{ html += `<li>${r}</li>`; });
  html += `</ul></div>`;

  html += `<h2 class="section">Tax &amp; Fees</h2><div class="card">
    ${kv("Fees", p.fees || "—")}
    ${kv("Tax Treatment", p.taxNote || "To be detailed in a future revision.")}
  </div>`;

  html += `<div class="footer-note">Product code ${p.code} · Internal product-development document · Status: ${entry.status.toUpperCase()} · ${entry.versions.length} version(s) published · Not investor-facing until reviewed for SEBI compliance requirements, final fee structure, and tax disclosures.</div>`;

  main.innerHTML = html;
}

function switchVariant(pid, idx){
  const p = getProduct(pid);
  p.variants.forEach((v,i)=>{
    const panel = document.getElementById(`vpanel-${pid}-${i}`);
    const tab = document.getElementById(`vtab-${pid}-${i}`);
    if(panel) panel.style.display = i===idx ? "block":"none";
    if(tab) tab.classList.toggle("active", i===idx);
  });
}

// ---------- CSV VIEW ----------
function renderCsvView(){
  const main = document.getElementById("main");
  const all = getAllProducts();
  const options = all.map(p=>`<option value="${p.id}">${p.id} — ${p.name}</option>`).join("");
  main.innerHTML = `
    <div class="topbar"><div><h1>CSV Constituent Upload</h1><div class="topbar-sub">Attach live constituent/weight data to a product note</div></div></div>
    <div class="callout">Upload a CSV of constituents and weights (columns: <code>symbol, name, weight</code>). Parsed data is held in-session and included in Word/Excel exports for the selected product.</div>
    <div class="card">
      <div class="field-row"><div class="field-label">Target Product</div>
        <select id="csvProductSelect">${options}</select>
      </div>
      <div class="upload-zone" id="dropZone" onclick="document.getElementById('csvFileInput').click()">
        click to choose a csv file, or drag and drop here<br>
        <span style="font-size:.62rem; opacity:.7;">expected columns: symbol, name, weight</span>
      </div>
      <input type="file" id="csvFileInput" accept=".csv" style="display:none" onchange="handleCsvFile(this.files[0])">
      <div id="csvResult"></div>
    </div>
  `;
  const dz = document.getElementById("dropZone");
  dz.addEventListener("dragover", e=>{ e.preventDefault(); dz.style.borderColor="var(--gold)"; });
  dz.addEventListener("dragleave", ()=>{ dz.style.borderColor="var(--moss)"; });
  dz.addEventListener("drop", e=>{
    e.preventDefault(); dz.style.borderColor="var(--moss)";
    if(e.dataTransfer.files.length) handleCsvFile(e.dataTransfer.files[0]);
  });
}

function handleCsvFile(file){
  if(!file) return;
  const pid = document.getElementById("csvProductSelect").value;
  Papa.parse(file, {
    header:true, skipEmptyLines:true,
    complete: function(results){
      const rows = results.data.map(r=>{
        const keys = Object.keys(r).reduce((acc,k)=>{ acc[k.trim().toLowerCase()] = r[k]; return acc; },{});
        return {
          symbol: keys.symbol || keys.ticker || "",
          name: keys.name || keys["company name"] || "",
          weight: keys.weight || keys["weight (%)"] || keys["weight%"] || ""
        };
      }).filter(r=>r.symbol || r.name);
      uploadedConstituents[pid] = rows;
      const p = getProduct(pid);
      let totalWeight = 0;
      rows.forEach(r=>{ const w = parseFloat(r.weight); if(!isNaN(w)) totalWeight += (w>1? w : w*100 <=100 && w<=1 ? w*100 : w); });
      document.getElementById("csvResult").innerHTML = `
        <div class="callout">Loaded <strong>${rows.length}</strong> constituents for <strong>${p.name}</strong>. Approx. total weight: <strong>${totalWeight.toFixed(1)}%</strong> ${Math.abs(totalWeight-100)>2 ? '<span style="color:var(--amber)">— check weights sum to ~100%</span>' : '<span style="color:var(--green)">OK</span>'}</div>
        <table><tr><th>Symbol</th><th>Name</th><th>Weight</th></tr>
        ${rows.slice(0,50).map(r=>`<tr><td>${r.symbol}</td><td>${r.name}</td><td>${r.weight}</td></tr>`).join("")}
        </table>
        ${rows.length>50 ? `<div style="color:var(--text-faint); font-size:.7rem;">Showing first 50 of ${rows.length} rows.</div>` : ""}
        <button class="btn primary" style="margin-top:12px;" onclick="showProduct('${pid}')">View Product Note →</button>
      `;
    },
    error: function(err){
      document.getElementById("csvResult").innerHTML = `<div class="callout danger">Parse error: ${err.message}</div>`;
    }
  });
}

// ---------- ROADMAP ----------
function renderRoadmap(){
  const main = document.getElementById("main");
  main.innerHTML = `
    <div class="topbar"><h1>Upgrade Roadmap</h1></div>
    <div class="callout">This studio runs entirely client-side: product data lives in your browser's local storage plus manual JSON backups — no server, no live pricing feed. Below is the intended path to a fuller system.</div>
    <div class="card">
      <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong style="color:var(--mist);">Backend + database.</strong> Move product definitions and version history from localStorage into a proper backend (e.g., Postgres) with real multi-device sync — no more manual JSON export/import as the backup discipline.</div></div>
      <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong style="color:var(--mist);">Live constituent management UI.</strong> Replace CSV-upload-only with an in-dashboard portfolio builder: search instruments, set weights with real-time sum validation, drag-and-drop sleeve rebalancing, diff view against the prior rebalance.</div></div>
      <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong style="color:var(--mist);">smallcase integration.</strong> Direct API push from the dashboard to smallcase's portfolio management endpoints for constituent/weight updates on publish.</div></div>
      <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong style="color:var(--mist);">Compliance engine.</strong> Automated checks before any rebalance is published: single-stock/sector concentration caps, SEBI disclosure requirements, risk-profile-to-allocation consistency, maker-checker approval workflow.</div></div>
      <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong style="color:var(--mist);">Live pricing &amp; performance tracking.</strong> Daily prices for all constituents to compute live NAV, drawdown, tracking error vs. benchmark, factor exposure drift.</div></div>
      <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong style="color:var(--mist);">Tax module.</strong> STCG/LTCG tracking per lot, REIT/InvIT distribution component split, FoF taxation — explicitly out of scope for this version.</div></div>
      <div class="roadmap-item"><div class="roadmap-dot"></div><div><strong style="color:var(--mist);">Client-facing reporting.</strong> Auto-generated, investor-ready factsheets (distinct from these internal product notes), refreshed on each rebalance.</div></div>
    </div>
  `;
}

// ============================================================================
// EMAIL — mailto: quick-send (plain text, client-side, no server round-trip)
// ============================================================================

function productToPlainText(p, entry, opts){
  opts = opts || {};
  const maxLen = opts.maxLen || 1100; // soft target for the body text portion
  const footer = "\n\n— Sent from Vriksha Product Note Studio. This is a summary; full structured detail (allocation bands, variants, instrument universe) is in the Word/Excel export.";

  const headerLines = [];
  headerLines.push(p.name);
  headerLines.push(`${p.code} · ${p.category} · Status: ${entry.status.toUpperCase()} (v${entry.versions.length})`);
  headerLines.push("");
  headerLines.push(`Risk Profile: ${p.riskProfile}`);
  headerLines.push(`Benchmark: ${p.benchmark}`);
  headerLines.push(`Rebalance: ${p.rebalanceFrequency}`);
  headerLines.push("");
  headerLines.push("OBJECTIVE");
  headerLines.push(p.objective || "");
  headerLines.push("");

  const riskLines = [];
  if(p.keyRisks && p.keyRisks.length){
    riskLines.push("KEY RISKS");
    p.keyRisks.forEach(r=> riskLines.push("- " + r));
    riskLines.push("");
  }

  const header = headerLines.join("\n");
  const risks = riskLines.join("\n");
  const fixedBudgetUsed = header.length + risks.length + footer.length;
  const remaining = maxLen - fixedBudgetUsed;

  let philosophyBlock = "";
  if(p.philosophy && remaining > 60){
    const label = "PHILOSOPHY\n";
    const available = remaining - label.length - 2; // small buffer
    let phil = p.philosophy;
    if(phil.length > available){
      phil = phil.slice(0, Math.max(0, available - 20)).trim() + " [...see full export]";
    }
    philosophyBlock = label + phil + "\n\n";
  }

  let text = header + philosophyBlock + risks + footer.trim();

  const hardCap = Math.max(maxLen, 400) + 400; // small grace band beyond the soft target
  if(text.length > hardCap){
    text = text.slice(0, hardCap - 40).trim() + "\n\n[...truncated — see full export for complete note]";
  }
  return text;
}

function buildMailtoUrl(p, entry){
  const bodyText = productToPlainText(p, entry);
  const subject = `Product Note — ${p.name} (${p.code})`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
}

function emailNote(id){
  const p = getProduct(id);
  const entry = getEntry(id);
  window.location.href = buildMailtoUrl(p, entry);
}


// ============================================================================
// EDITOR — structured controls for numeric/allocation fields, freeform for prose
// ============================================================================

function sumRangeHighs(rows){
  let lo=0, hi=0;
  rows.forEach(r=>{
    const m = String(r).match(/(\d+(?:\.\d+)?)\s*[–\-]\s*(\d+(?:\.\d+)?)/);
    if(m){ lo+=parseFloat(m[1]); hi+=parseFloat(m[2]); }
    else {
      const m2 = String(r).match(/(\d+(?:\.\d+)?)/);
      if(m2){ lo+=parseFloat(m2[1]); hi+=parseFloat(m2[1]); }
    }
  });
  return {lo, hi};
}

function weightSumBadge(rows, containerId){
  const {lo,hi} = sumRangeHighs(rows.map(r=>r.range || r.weightRange));
  const ok = lo<=100 && hi>=95 && hi<=115; // loose band check: ranges should plausibly cover ~100%
  return `<span class="weight-sum-badge ${ok?'weight-sum-ok':'weight-sum-bad'}">Range sums: low ${lo.toFixed(0)}% – high ${hi.toFixed(0)}% ${ok? '(plausible)':'(check — should bracket 100%)'}</span>`;
}

function formatCapsSentence(rules){
  if(!rules) return "—";
  const parts = [];
  if(rules.positionMinPct!=null || rules.positionMaxPct!=null){
    const lo = rules.positionMinPct!=null ? rules.positionMinPct+"%" : "no minimum";
    const hi = rules.positionMaxPct!=null ? rules.positionMaxPct+"%" : "no maximum";
    const basis = rules.positionBasis==='sleeve' ? "of sleeve" : "of portfolio";
    parts.push(`Position size ${lo}–${hi} ${basis}`);
  }
  if(rules.sectorCapMaxPct!=null){
    parts.push(`Sector cap ${rules.sectorCapMaxPct}%`);
  }
  if(rules.sleeveMinPct!=null || rules.sleeveMaxPct!=null){
    const lo = rules.sleeveMinPct!=null ? rules.sleeveMinPct+"%" : "—";
    const hi = rules.sleeveMaxPct!=null ? rules.sleeveMaxPct+"%" : "—";
    parts.push(`Equity exposure ${lo}–${hi}`);
  }
  return parts.length ? parts.join("; ") : "—";
}

function clampPct(value){
  if(value === "" || value === null || value === undefined) return null;
  const n = parseFloat(value);
  if(isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function capFieldsHtml(sleeveMinVal, sleeveMaxVal, posMinVal, posMaxVal, posBasis, onSleeveMinCall, onSleeveMaxCall, onPosMinCall, onPosMaxCall, onPosBasisCall){
  const smv = (sleeveMinVal===null||sleeveMinVal===undefined) ? '' : sleeveMinVal;
  const sxv = (sleeveMaxVal===null||sleeveMaxVal===undefined) ? '' : sleeveMaxVal;
  const pmv = (posMinVal===null||posMinVal===undefined) ? '' : posMinVal;
  const pxv = (posMaxVal===null||posMaxVal===undefined) ? '' : posMaxVal;
  return `
    <div class="cap-fields-row" style="display:flex; gap:8px; align-items:center; margin:6px 0 10px; flex-wrap:wrap;">
      <label style="font-size:.68rem; color:var(--text-faint);">Sleeve min %
        <input type="number" min="0" max="100" step="0.1" class="input-sm" style="width:70px;" value="${smv}" onchange="${onSleeveMinCall},this.value)" placeholder="—">
      </label>
      <label style="font-size:.68rem; color:var(--text-faint);">Sleeve max %
        <input type="number" min="0" max="100" step="0.1" class="input-sm" style="width:70px;" value="${sxv}" onchange="${onSleeveMaxCall},this.value)" placeholder="—">
      </label>
      <label style="font-size:.68rem; color:var(--text-faint);">Position min %
        <input type="number" min="0" max="100" step="0.1" class="input-sm" style="width:70px;" value="${pmv}" onchange="${onPosMinCall},this.value)" placeholder="—">
      </label>
      <label style="font-size:.68rem; color:var(--text-faint);">Position max %
        <input type="number" min="0" max="100" step="0.1" class="input-sm" style="width:70px;" value="${pxv}" onchange="${onPosMaxCall},this.value)" placeholder="—">
      </label>
      <label style="font-size:.68rem; color:var(--text-faint);">Basis
        <select class="input-sm" onchange="${onPosBasisCall},this.value)">
          <option value="portfolio" ${posBasis==='portfolio'?'selected':''}>% of portfolio</option>
          <option value="sleeve" ${posBasis==='sleeve'?'selected':''}>% of sleeve</option>
        </select>
      </label>
    </div>
  `;
}

function renderEdit(id){
  const p = getProduct(id);
  const entry = getEntry(id);
  const main = document.getElementById("main");

  let html = `
    <div class="topbar">
      <div>
        <h1>Edit — ${p.name}</h1>
        <div class="topbar-sub">${p.code} · <span class="status-pill ${entry.status}"><span class="dot"></span>${entry.status}</span> · unsaved changes apply immediately to the working draft</div>
      </div>
      <div class="toolbar">
        <button class="btn" onclick="showProduct('${p.id}')">← Back to Note</button>
        <button class="btn" onclick="addRisk('${p.id}')">+ Add Risk</button>
        <button class="btn primary" onclick="publishProduct('${p.id}')">Publish Version</button>
      </div>
    </div>

    <div class="callout">Structured fields (allocation ranges, factor weights, caps) validate as you type. Prose fields (objective, philosophy, suitability) are freeform text. Nothing is versioned until you click <strong>Publish Version</strong> — until then this is your working draft.</div>

    <h2 class="section">Key Facts <span class="s-label-inline">structured</span></h2>
    <div class="card">
      <div class="field-row"><div class="field-label">Risk Profile</div><input type="text" value="${escAttr(p.riskProfile)}" onchange="updateField('${id}','riskProfile',this.value)"></div>
      <div class="field-row"><div class="field-label">Benchmark</div><input type="text" value="${escAttr(p.benchmark)}" onchange="updateField('${id}','benchmark',this.value)"></div>
      <div class="field-row"><div class="field-label">Rebalance Frequency</div><input type="text" value="${escAttr(p.rebalanceFrequency)}" onchange="updateField('${id}','rebalanceFrequency',this.value)"></div>
      <div class="field-row"><div class="field-label">Min. Investment</div><input type="text" value="${escAttr(p.minInvestment||'')}" onchange="updateField('${id}','minInvestment',this.value)"></div>
      <div class="field-row"><div class="field-label">Fees</div><input type="text" value="${escAttr(p.fees||'')}" onchange="updateField('${id}','fees',this.value)"></div>
      <div class="field-row"><div class="field-label">Tax Note</div><input type="text" value="${escAttr(p.taxNote||'')}" onchange="updateField('${id}','taxNote',this.value)"></div>
    </div>

    <h2 class="section">Objective &amp; Philosophy <span class="s-label-inline">freeform</span></h2>
    <div class="card">
      <div class="field-row"><div class="field-label">Objective</div><textarea rows="3" onchange="updateField('${id}','objective',this.value)">${escText(p.objective)}</textarea></div>
      <div class="field-row"><div class="field-label">Philosophy</div><textarea rows="4" onchange="updateField('${id}','philosophy',this.value)">${escText(p.philosophy||'')}</textarea></div>
      ${p.selectionMethodology!==undefined ? `<div class="field-row"><div class="field-label">Selection Methodology</div><textarea rows="3" onchange="updateField('${id}','selectionMethodology',this.value)">${escText(p.selectionMethodology||'')}</textarea></div>` : ""}
      ${p.portfolioConstruction!==undefined ? `<div class="field-row"><div class="field-label">Portfolio Construction</div><textarea rows="3" onchange="updateField('${id}','portfolioConstruction',this.value)">${escText(p.portfolioConstruction||'')}</textarea></div>` : ""}
      <div class="field-row"><div class="field-label">Suitability</div><textarea rows="3" onchange="updateField('${id}','suitability',this.value)">${escText(p.suitability||'')}</textarea></div>
    </div>
  `;

  html += `<h2 class="section">Construction Rules — Caps &amp; Limits <span class="s-label-inline">structured, numeric only</span></h2><div class="card">`;
  const rules = p.portfolioConstructionRules || { stockCountRange:"", cashBuffer:"" };
  html += `
    <div class="field-row"><div class="field-label">Stock Count Range</div><input type="text" class="input-sm" value="${escAttr(rules.stockCountRange)}" onchange="updateConstructionRule('${id}','stockCountRange',this.value)" placeholder="e.g. 15-25"></div>
    <div class="field-row"><div class="field-label">Cash Buffer (%)</div><input type="text" class="input-sm" value="${escAttr(rules.cashBuffer)}" onchange="updateConstructionRule('${id}','cashBuffer',this.value)" placeholder="e.g. 0-5%"></div>
    <div class="field-row"><div class="field-label">Sector Cap — Max % <span class="s-label-inline">numeric</span></div><input type="number" min="0" max="100" step="0.1" class="input-sm" value="${rules.sectorCapMaxPct===null||rules.sectorCapMaxPct===undefined?'':rules.sectorCapMaxPct}" onchange="updateConstructionRuleNumeric('${id}','sectorCapMaxPct',this.value)" placeholder="e.g. 30"></div>
  `;
  html += `<div class="field-label" style="margin-top:14px; margin-bottom:6px;">Sleeve Allocation &amp; Position-Size Range <span class="s-label-inline">structured, numeric only</span></div>`;
  html += capFieldsHtml(rules.sleeveMinPct, rules.sleeveMaxPct, rules.positionMinPct, rules.positionMaxPct, rules.positionBasis,
    `updateConstructionRuleNumeric('${id}','sleeveMinPct'`,
    `updateConstructionRuleNumeric('${id}','sleeveMaxPct'`,
    `updateConstructionRuleNumeric('${id}','positionMinPct'`,
    `updateConstructionRuleNumeric('${id}','positionMaxPct'`,
    `updateConstructionRule('${id}','positionBasis'`
  );
  html += `<div class="callout">These numbers are the single source of truth — the exported note's caps sentence and the compliance engine both read directly from these fields, so there's nothing to keep in sync manually. For a single-sleeve product like this one, "Sleeve min/max %" describes the whole portfolio's equity exposure band (often 100% min/max if fully invested); "Position min/max %" is the per-holding size range — a stock must be at least the minimum to be worth including, and no more than the maximum.</div>`;
  html += `</div>`;

  if(p.styleSleeves){
    html += `<h2 class="section">Style Sleeves — Weights <span class="s-label-inline">structured</span></h2><div class="card">`;
    html += `<div id="sleeveEditor-${id}">`;
    p.styleSleeves.forEach((s,i)=>{
      html += `
        <div class="editable-table-row four" data-sleeve-idx="${i}">
          <input type="text" value="${escAttr(s.name)}" onchange="updateSleeveField('${id}',${i},'name',this.value)" placeholder="Sleeve name">
          <input type="text" value="${escAttr(s.weightRange)}" onchange="updateSleeveField('${id}',${i},'weightRange',this.value)" placeholder="e.g. 35-55%">
          <input type="text" value="${escAttr(s.universe||'')}" onchange="updateSleeveField('${id}',${i},'universe',this.value)" placeholder="Universe">
          <input type="text" value="${escAttr(s.indicativeNames||'')}" onchange="updateSleeveField('${id}',${i},'indicativeNames',this.value)" placeholder="Indicative names">
          <button class="row-remove" onclick="removeSleeve('${id}',${i})">×</button>
        </div>
        ${capFieldsHtml(s.sleeveMinPct, s.sleeveMaxPct, s.positionMinPct, s.positionMaxPct, s.positionBasis,
          `updateSleeveNumericField('${id}',${i},'sleeveMinPct'`,
          `updateSleeveNumericField('${id}',${i},'sleeveMaxPct'`,
          `updateSleeveNumericField('${id}',${i},'positionMinPct'`,
          `updateSleeveNumericField('${id}',${i},'positionMaxPct'`,
          `updateSleeveField('${id}',${i},'positionBasis'`
        )}
        <textarea rows="2" style="margin-bottom:14px;" onchange="updateSleeveField('${id}',${i},'criteria',this.value)" placeholder="Selection criteria">${escText(s.criteria||'')}</textarea>
      `;
    });
    html += `</div>`;
    html += weightSumBadge(p.styleSleeves);
    html += `<div style="margin-top:12px;"><button class="btn small" onclick="addSleeve('${id}')">+ Add Sleeve</button></div>`;
    html += `</div>`;
  }

  if(p.strategicAllocationRanges){
    html += `<h2 class="section">Strategic Allocation Ranges <span class="s-label-inline">structured</span></h2><div class="card">`;
    p.strategicAllocationRanges.forEach((a,i)=>{
      html += `
        <div class="editable-table-row" data-alloc-idx="${i}">
          <input type="text" value="${escAttr(a.sleeve)}" onchange="updateAllocField('${id}','strategicAllocationRanges',${i},'sleeve',this.value)" placeholder="Sleeve">
          <input type="text" value="${escAttr(a.range)}" onchange="updateAllocField('${id}','strategicAllocationRanges',${i},'range',this.value)" placeholder="e.g. 5-15%">
          <div></div>
          <button class="row-remove" onclick="removeAllocRow('${id}','strategicAllocationRanges',${i})">×</button>
        </div>
        ${capFieldsHtml(a.sleeveMinPct, a.sleeveMaxPct, a.positionMinPct, a.positionMaxPct, a.positionBasis,
          `updateAllocNumericField('${id}','strategicAllocationRanges',${i},'sleeveMinPct'`,
          `updateAllocNumericField('${id}','strategicAllocationRanges',${i},'sleeveMaxPct'`,
          `updateAllocNumericField('${id}','strategicAllocationRanges',${i},'positionMinPct'`,
          `updateAllocNumericField('${id}','strategicAllocationRanges',${i},'positionMaxPct'`,
          `updateAllocField('${id}','strategicAllocationRanges',${i},'positionBasis'`
        )}
      `;
    });
    html += weightSumBadge(p.strategicAllocationRanges);
    html += `<div style="margin-top:12px;"><button class="btn small" onclick="addAllocRow('${id}','strategicAllocationRanges')">+ Add Sleeve</button></div>`;
    html += `</div>`;
  }

  if(p.variants){
    html += `<h2 class="section">Risk-Profile Variants <span class="s-label-inline">structured</span></h2><div class="card">`;
    p.variants.forEach((v,vi)=>{
      html += `<div style="margin-bottom:22px; padding-bottom:18px; border-bottom:1px solid var(--canopy);">`;
      html += `<div class="field-row"><div class="field-label">Profile Name</div><input type="text" value="${escAttr(v.profile)}" onchange="updateVariantField('${id}',${vi},'profile',this.value)"></div>`;
      if(v.targetInvestor!==undefined) html += `<div class="field-row"><div class="field-label">Target Investor</div><textarea rows="2" onchange="updateVariantField('${id}',${vi},'targetInvestor',this.value)">${escText(v.targetInvestor||'')}</textarea></div>`;
      if(v.factorMix!==undefined){
        html += `<div class="field-row"><div class="field-label">Factor Mix</div><input type="text" value="${escAttr(v.factorMix)}" onchange="updateVariantField('${id}',${vi},'factorMix',this.value)"></div>`;
        html += `<div class="field-row"><div class="field-label">Universe</div><input type="text" value="${escAttr(v.universe)}" onchange="updateVariantField('${id}',${vi},'universe',this.value)"></div>`;
        html += `<div class="field-row"><div class="field-label">Stock Count</div><input type="text" class="input-sm" value="${escAttr(v.stockCount)}" onchange="updateVariantField('${id}',${vi},'stockCount',this.value)"></div>`;
        html += `<div class="field-row"><div class="field-label">Reference Index</div><input type="text" value="${escAttr(v.referenceIndex)}" onchange="updateVariantField('${id}',${vi},'referenceIndex',this.value)"></div>`;
        html += `<div class="field-row"><div class="field-label">Rationale</div><textarea rows="2" onchange="updateVariantField('${id}',${vi},'rationale',this.value)">${escText(v.rationale||'')}</textarea></div>`;
      }
      if(v.allocation){
        html += `<div class="field-label" style="margin-bottom:8px;">Allocation (${v.profile})</div>`;
        v.allocation.forEach((a,ai)=>{
          html += `
            <div class="editable-table-row" data-variant="${vi}" data-alloc-idx="${ai}">
              <input type="text" value="${escAttr(a.sleeve)}" onchange="updateVariantAllocField('${id}',${vi},${ai},'sleeve',this.value)">
              <input type="text" value="${escAttr(a.range)}" onchange="updateVariantAllocField('${id}',${vi},${ai},'range',this.value)">
              <div></div>
              <button class="row-remove" onclick="removeVariantAllocRow('${id}',${vi},${ai})">×</button>
            </div>
            ${capFieldsHtml(a.sleeveMinPct, a.sleeveMaxPct, a.positionMinPct, a.positionMaxPct, a.positionBasis,
              `updateVariantAllocNumericField('${id}',${vi},${ai},'sleeveMinPct'`,
              `updateVariantAllocNumericField('${id}',${vi},${ai},'sleeveMaxPct'`,
              `updateVariantAllocNumericField('${id}',${vi},${ai},'positionMinPct'`,
              `updateVariantAllocNumericField('${id}',${vi},${ai},'positionMaxPct'`,
              `updateVariantAllocField('${id}',${vi},${ai},'positionBasis'`
            )}
          `;
        });
        html += weightSumBadge(v.allocation);
        html += `<div style="margin:8px 0 4px;"><button class="btn small" onclick="addVariantAllocRow('${id}',${vi})">+ Add Sleeve to ${v.profile}</button></div>`;
        if(v.expectedEquityLikeExposure!==undefined) html += `<div class="field-row" style="margin-top:10px;"><div class="field-label">Equity-like Exposure</div><input type="text" class="input-sm" value="${escAttr(v.expectedEquityLikeExposure)}" onchange="updateVariantField('${id}',${vi},'expectedEquityLikeExposure',this.value)"></div>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
  }

  if(p.goalFramework){
    html += `<h2 class="section">Life Goal Framework <span class="s-label-inline">freeform</span></h2><div class="card">`;
    p.goalFramework.forEach((g,gi)=>{
      html += `<div style="margin-bottom:18px; padding-bottom:16px; border-bottom:1px solid var(--canopy);">`;
      html += `<div class="field-row"><div class="field-label">Goal</div><input type="text" value="${escAttr(g.goal)}" onchange="updateGoalField('${id}',${gi},'goal',this.value)"></div>`;
      html += `<div class="field-row"><div class="field-label">Horizon Band</div><input type="text" value="${escAttr(g.horizonBand)}" onchange="updateGoalField('${id}',${gi},'horizonBand',this.value)"></div>`;
      html += `<div class="field-row"><div class="field-label">Glide Path</div><textarea rows="3" onchange="updateGoalField('${id}',${gi},'glidePath',this.value)">${escText(g.glidePath||'')}</textarea></div>`;
      if(g.riskProfileAdjustment!==undefined) html += `<div class="field-row"><div class="field-label">Risk Adjustment</div><textarea rows="2" onchange="updateGoalField('${id}',${gi},'riskProfileAdjustment',this.value)">${escText(g.riskProfileAdjustment||'')}</textarea></div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  html += `<h2 class="section">Key Risks <span class="s-label-inline">freeform list</span></h2><div class="card" id="riskEditor-${id}">`;
  (p.keyRisks||[]).forEach((r,i)=>{
    html += `
      <div class="risk-item-row">
        <input type="text" value="${escAttr(r)}" onchange="updateRisk('${id}',${i},this.value)">
        <button class="row-remove" onclick="removeRisk('${id}',${i})">×</button>
      </div>
    `;
  });
  html += `</div>`;

  html += `<div class="footer-note">Editing product ${p.code}. Changes save to your browser's local storage automatically as you type/blur each field. Nothing is versioned or exportable-as-final until you click Publish Version. Use Backup &amp; Sync to export a JSON snapshot to Google Drive.</div>`;

  main.innerHTML = html;
}

function escAttr(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }
function escText(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }

// ---------- FIELD UPDATE HANDLERS ----------
function updateField(id, field, value){
  getProduct(id)[field] = value;
  saveToLocalStorage();
}
function updateConstructionRule(id, field, value){
  const p = getProduct(id);
  if(!p.portfolioConstructionRules) p.portfolioConstructionRules = {};
  p.portfolioConstructionRules[field] = value;
  saveToLocalStorage();
}
function updateConstructionRuleNumeric(id, field, value){
  const p = getProduct(id);
  if(!p.portfolioConstructionRules) p.portfolioConstructionRules = {};
  p.portfolioConstructionRules[field] = clampPct(value);
  saveToLocalStorage();
}
function updateSleeveField(id, idx, field, value){
  getProduct(id).styleSleeves[idx][field] = value;
  saveToLocalStorage();
  refreshWeightBadges(id);
}
function updateSleeveNumericField(id, idx, field, value){
  getProduct(id).styleSleeves[idx][field] = clampPct(value);
  saveToLocalStorage();
  refreshWeightBadges(id);
}
function addSleeve(id){
  getProduct(id).styleSleeves.push({name:"New Sleeve", weightRange:"0-0%", criteria:"", universe:"", indicativeNames:""});
  saveToLocalStorage();
  renderEdit(id);
}
function removeSleeve(id, idx){
  getProduct(id).styleSleeves.splice(idx,1);
  saveToLocalStorage();
  renderEdit(id);
}
function updateAllocField(id, listName, idx, field, value){
  getProduct(id)[listName][idx][field] = value;
  saveToLocalStorage();
  refreshWeightBadges(id);
}
function updateAllocNumericField(id, listName, idx, field, value){
  getProduct(id)[listName][idx][field] = clampPct(value);
  saveToLocalStorage();
  refreshWeightBadges(id);
}
function addAllocRow(id, listName){
  getProduct(id)[listName].push({sleeve:"New Sleeve", range:"0-0%"});
  saveToLocalStorage();
  renderEdit(id);
}
function removeAllocRow(id, listName, idx){
  getProduct(id)[listName].splice(idx,1);
  saveToLocalStorage();
  renderEdit(id);
}
function updateVariantField(id, vi, field, value){
  getProduct(id).variants[vi][field] = value;
  saveToLocalStorage();
}
function updateVariantAllocField(id, vi, ai, field, value){
  getProduct(id).variants[vi].allocation[ai][field] = value;
  saveToLocalStorage();
  refreshWeightBadges(id);
}
function updateVariantAllocNumericField(id, vi, ai, field, value){
  getProduct(id).variants[vi].allocation[ai][field] = clampPct(value);
  saveToLocalStorage();
  refreshWeightBadges(id);
}
function addVariantAllocRow(id, vi){
  getProduct(id).variants[vi].allocation.push({sleeve:"New Sleeve", range:"0-0%"});
  saveToLocalStorage();
  renderEdit(id);
}
function removeVariantAllocRow(id, vi, ai){
  getProduct(id).variants[vi].allocation.splice(ai,1);
  saveToLocalStorage();
  renderEdit(id);
}
function updateGoalField(id, gi, field, value){
  getProduct(id).goalFramework[gi][field] = value;
  saveToLocalStorage();
}
function updateRisk(id, idx, value){
  getProduct(id).keyRisks[idx] = value;
  saveToLocalStorage();
}
function addRisk(id){
  if(!getProduct(id).keyRisks) getProduct(id).keyRisks = [];
  getProduct(id).keyRisks.push("New risk — describe it here");
  saveToLocalStorage();
  renderEdit(id);
}
function removeRisk(id, idx){
  getProduct(id).keyRisks.splice(idx,1);
  saveToLocalStorage();
  renderEdit(id);
}
function refreshWeightBadges(id){
  if(currentView==="edit" && currentProductId===id){
    const scrollY = window.scrollY;
    renderEdit(id);
    window.scrollTo(0, scrollY);
  }
}


// ============================================================================
// VERSIONING, PUBLISH, AUDIT TRAIL, DIFF
// ============================================================================

async function publishProduct(id){
  const entry = getEntry(id);
  const note = prompt("Optional note for this version (what changed / why publishing now):", "");
  if(note === null) return; // cancelled
  const versionNum = entry.versions.length + 1;
  const snapshotData = JSON.parse(JSON.stringify(entry.current));
  const timestamp = new Date().toISOString();

  try {
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user ? userData.user.id : null;

    const { error: verErr } = await sb.from('product_versions').insert({
      product_id: id,
      version_number: versionNum,
      note: note || "",
      data: snapshotData,
      created_by: uid
    });
    if(verErr) throw verErr;

    const { error: prodErr } = await sb.from('products')
      .update({ status: "published", data: snapshotData, updated_by: uid })
      .eq('id', id);
    if(prodErr) throw prodErr;

    entry.versions.push({ version: versionNum, timestamp, note: note || "", data: snapshotData });
    entry.status = "published";
    state.lastSaved = new Date().toISOString();
    updateSyncStatus();
    showHistory(id);
  } catch(err){
    showGlobalError("Publish failed for " + id + ": " + err.message + " — no new version was recorded. Your working draft is unchanged; try again.");
  }
}

async function unpublishToDraft(id){
  const entry = getEntry(id);
  entry.status = "draft";
  await persistProduct(id);
  renderNav();
  showProduct(id);
}

async function revertToVersion(id, versionIdx){
  const entry = getEntry(id);
  const v = entry.versions[versionIdx];
  if(!confirm(`Revert working draft to v${v.version} (published ${new Date(v.timestamp).toLocaleString()})? This overwrites your current unsaved edits.`)) return;
  entry.current = JSON.parse(JSON.stringify(v.data));
  entry.status = "draft";
  await persistProduct(id);
  showProduct(id);
}

function renderHistory(id){
  const p = getProduct(id);
  const entry = getEntry(id);
  const main = document.getElementById("main");

  let html = `
    <div class="topbar">
      <div>
        <h1>Version History — ${p.name}</h1>
        <div class="topbar-sub">${entry.versions.length} published version(s) · current status: <span class="status-pill ${entry.status}"><span class="dot"></span>${entry.status}</span></div>
      </div>
      <div class="toolbar">
        <button class="btn" onclick="showProduct('${id}')">← Back to Note</button>
        ${entry.status==="published" ? `<button class="btn" onclick="unpublishToDraft('${id}')">Mark as Draft</button>` : ""}
      </div>
    </div>
  `;

  if(entry.versions.length === 0){
    html += `<div class="callout warn">No published versions yet. The current content is an unpublished working draft — publish it from the Edit screen to create v1 and start the audit trail.</div>`;
  } else {
    html += `<h2 class="section">Published Versions</h2><div class="card">`;
    entry.versions.slice().reverse().forEach((v)=>{
      const idx = entry.versions.indexOf(v);
      html += `
        <div class="version-row">
          <div>
            <div class="vmeta">v${v.version} ${v.note ? '— ' + escText(v.note) : ''}</div>
            <div class="vtime">${new Date(v.timestamp).toLocaleString()}</div>
          </div>
          <div class="toolbar">
            ${idx>0 ? `<button class="btn small" onclick="showDiff('${id}',${idx-1},${idx})">Diff vs v${entry.versions[idx-1].version}</button>` : ""}
            <button class="btn small" onclick="showDiff('${id}',${idx},'current')">Diff vs Draft</button>
            <button class="btn small" onclick="revertToVersion('${id}',${idx})">Revert Draft to This</button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  html += `<div id="diffContainer"></div>`;
  main.innerHTML = html;
}

const DIFF_FIELDS = [
  "objective","philosophy","selectionMethodology","portfolioConstruction",
  "benchmark","rebalanceFrequency","riskProfile","suitability","minInvestment","fees","taxNote"
];

function fieldValueAt(dataObj, field){
  return dataObj[field] !== undefined ? String(dataObj[field]) : "";
}

function diffText(a, b){
  const aw = (a||"").split(/(\s+)/);
  const bw = (b||"").split(/(\s+)/);
  const m = aw.length, n = bw.length;
  const dp = Array.from({length:m+1}, ()=>new Array(n+1).fill(0));
  for(let i=m-1;i>=0;i--){
    for(let j=n-1;j>=0;j--){
      dp[i][j] = aw[i]===bw[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j], dp[i][j+1]);
    }
  }
  let i=0,j=0; const out=[];
  while(i<m && j<n){
    if(aw[i]===bw[j]){ out.push({t:"same", v:aw[i]}); i++; j++; }
    else if(dp[i+1][j] >= dp[i][j+1]){ out.push({t:"del", v:aw[i]}); i++; }
    else { out.push({t:"add", v:bw[j]}); j++; }
  }
  while(i<m){ out.push({t:"del", v:aw[i]}); i++; }
  while(j<n){ out.push({t:"add", v:bw[j]}); j++; }
  return out;
}

function renderDiffHtml(a, b){
  if(a === b) return `<span class="diff-unchanged">— unchanged —</span>`;
  const parts = diffText(a, b);
  return parts.map(p=>{
    if(p.t==="same") return escText(p.v);
    if(p.t==="del") return `<span class="diff-remove">${escText(p.v)}</span>`;
    return `<span class="diff-add">${escText(p.v)}</span>`;
  }).join("");
}

function showDiff(id, fromIdx, toIdx){
  const entry = getEntry(id);
  const fromData = entry.versions[fromIdx].data;
  const fromLabel = "v" + entry.versions[fromIdx].version;
  let toData, toLabel;
  if(toIdx === "current"){
    toData = entry.current;
    toLabel = "Current Draft";
  } else {
    toData = entry.versions[toIdx].data;
    toLabel = "v" + entry.versions[toIdx].version;
  }

  let html = `<h2 class="section">Diff: ${fromLabel} → ${toLabel}</h2>`;
  let anyChange = false;
  DIFF_FIELDS.forEach(f=>{
    const a = fieldValueAt(fromData, f);
    const b = fieldValueAt(toData, f);
    if(a !== b) anyChange = true;
    html += `<div class="diff-field"><div class="df-label">${f.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())}</div><div>${renderDiffHtml(a,b)}</div></div>`;
  });

  ["styleSleeves","strategicAllocationRanges","variants","goalFramework","keyRisks","portfolioConstructionRules"].forEach(f=>{
    if(fromData[f] === undefined && toData[f] === undefined) return;
    const a = JSON.stringify(fromData[f] || null, null, 2);
    const b = JSON.stringify(toData[f] || null, null, 2);
    if(a !== b){
      anyChange = true;
      html += `<div class="diff-field"><div class="df-label">${f.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())} (structured — raw diff)</div><div style="font-family:'JetBrains Mono',monospace; font-size:.72rem; white-space:pre-wrap;">${renderDiffHtml(a,b)}</div></div>`;
    }
  });

  if(!anyChange){
    html += `<div class="callout">No differences between ${fromLabel} and ${toLabel}.</div>`;
  }

  document.getElementById("diffContainer").innerHTML = html;
  document.getElementById("diffContainer").scrollIntoView({behavior:"smooth"});
}

// ============================================================================
// BACKUP & SYNC — Supabase is now the single source of truth. This view is
// read-only status + a manual JSON export for an off-platform backup copy.
// Snapshot *loading* is intentionally removed in production: silently
// overwriting in-memory state from a local file would desync it from the
// database that every other user is also reading/writing.
// ============================================================================

function renderBackupView(){
  const main = document.getElementById("main");
  const lastSaved = state.lastSaved ? new Date(state.lastSaved).toLocaleString() : "never";
  main.innerHTML = `
    <div class="topbar">
      <div><h1>Backup &amp; Sync</h1></div>
      <div class="toolbar"><button class="btn" onclick="refreshFromSupabase()">↻ Refresh from Database</button></div>
    </div>
    <div class="callout">Product data and version history now live in Supabase (Postgres), shared across everyone signed in to this studio — not in this browser's local storage. This screen is a status readout plus an optional local JSON export for your own offline backup; it no longer controls what the app loads from.</div>
    <div class="card">
      <div class="kv"><div class="k">Last Synced (this tab)</div><div class="v">${lastSaved}</div></div>
      <div class="kv"><div class="k">Products</div><div class="v">${Object.keys(state.products).length}</div></div>
      <div class="kv"><div class="k">Total Published Versions</div><div class="v">${Object.values(state.products).reduce((a,p)=>a+p.versions.length,0)}</div></div>
      <div class="kv"><div class="k">Signed in as</div><div class="v">${currentUser ? escText(currentUser.email) : "—"}</div></div>
      <div style="margin-top:18px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn primary" onclick="downloadSnapshot()">Download JSON Snapshot (backup copy)</button>
      </div>
      <div class="callout warn" style="margin-top:16px;">This JSON download is a point-in-time export for your own records — it is not a restore mechanism. To recover or correct data, edit directly in the studio (writes go straight to Supabase) or ask an administrator to intervene at the database level.</div>
    </div>
  `;
}

function downloadSnapshot(){
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], {type:"application/json"});
  const ts = new Date().toISOString().replace(/[:.]/g,"-");
  saveAs(blob, `vriksha_product_notes_snapshot_${ts}.json`);
}


// ============================================================================
// EXPORT — Excel & Word (reads from live edited state, not static seed data)
// ============================================================================

function checkExportLibs(need){
  const missing = [];
  if(need.includes("xlsx") && typeof XLSX === "undefined") missing.push("SheetJS (XLSX) — used for Excel export");
  if(need.includes("docx") && typeof docx === "undefined") missing.push("docx.js — used for Word export");
  if(need.includes("saveAs") && typeof saveAs === "undefined") missing.push("FileSaver.js — used to trigger the file download");
  if(need.includes("jspdf") && (typeof window.jspdf === "undefined" || typeof window.jspdf.jsPDF === "undefined")) missing.push("jsPDF — used for PDF export");
  if(need.includes("autotable") && typeof window.jspdf !== "undefined" && typeof window.jspdf.jsPDF !== "undefined" && typeof window.jspdf.jsPDF.API.autoTable === "undefined") missing.push("jsPDF-AutoTable — used to render tables in PDF export");
  if(missing.length){
    alert(
      "Export couldn't run — a required library didn't load from the CDN:\n\n" +
      missing.map(m=>"• "+m).join("\n") +
      "\n\nThis usually means an ad-blocker, corporate firewall, or offline connection is blocking cdn.jsdelivr.net. " +
      "Try disabling ad/script blockers for this file, checking your internet connection, or reloading the page. " +
      "If it persists, this file may need its CDN links updated."
    );
    return false;
  }
  return true;
}

function productToRows(p, entry){
  const rows = [];
  rows.push(["Field","Value"]);
  rows.push(["Product ID", p.id]);
  rows.push(["Code", p.code]);
  rows.push(["Name", p.name]);
  rows.push(["Status", entry.status]);
  rows.push(["Version", "v" + entry.versions.length + (entry.status==="draft" ? " (+ unpublished draft edits)" : "")]);
  rows.push(["Category", p.category]);
  rows.push(["Asset Classes", p.assetClasses.join("; ")]);
  rows.push(["Objective", p.objective]);
  rows.push(["Philosophy/Methodology", p.philosophy || p.selectionMethodology || ""]);
  rows.push(["Benchmark", p.benchmark]);
  rows.push(["Rebalance Frequency", p.rebalanceFrequency]);
  rows.push(["Risk Profile", p.riskProfile]);
  rows.push(["Suitability", p.suitability]);
  rows.push(["Min Investment", p.minInvestment || ""]);
  rows.push(["Fees", p.fees || ""]);
  rows.push(["Tax Note", p.taxNote || ""]);
  rows.push(["Key Risks", (p.keyRisks||[]).join(" | ")]);
  if(p.portfolioConstructionRules){
    const r = p.portfolioConstructionRules;
    rows.push(["Stock Count Range", r.stockCountRange||""]);
    rows.push(["Caps & Position Sizing", formatCapsSentence(r)]);
    rows.push(["Cash Buffer", r.cashBuffer||""]);
  }
  return rows;
}

function exportXlsx(pid){
  if(!checkExportLibs(["xlsx"])) return;
  try{
  const p = getProduct(pid);
  const entry = getEntry(pid);
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(productToRows(p, entry));
  ws1['!cols'] = [{wch:24},{wch:100}];
  XLSX.utils.book_append_sheet(wb, ws1, "Product Note");

  if(p.styleSleeves){
    const rows = [["Sleeve","Weight Range","Criteria","Universe","Indicative Names"]];
    p.styleSleeves.forEach(s=>rows.push([s.name,s.weightRange,s.criteria,s.universe,s.indicativeNames]));
    const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:20},{wch:14},{wch:60},{wch:40},{wch:50}];
    XLSX.utils.book_append_sheet(wb, ws, "Style Sleeves");
  }
  if(p.strategicAllocationRanges){
    const rows = [["Sleeve","Target Range"]];
    p.strategicAllocationRanges.forEach(a=>rows.push([a.sleeve,a.range]));
    const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:60},{wch:14}];
    XLSX.utils.book_append_sheet(wb, ws, "Allocation Ranges");
  }
  if(p.variants){
    const rows = [["Variant","Sleeve","Target Range"]];
    p.variants.forEach(v=>{
      if(v.allocation) v.allocation.forEach(a=>rows.push([v.profile,a.sleeve,a.range]));
      else rows.push([v.profile, v.factorMix||"", v.universe||""]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:14},{wch:55},{wch:14}];
    XLSX.utils.book_append_sheet(wb, ws, "Risk Variants");
  }
  if(p.goalFramework){
    const rows = [["Goal","Horizon Band","Glide Path"]];
    p.goalFramework.forEach(g=>rows.push([g.goal,g.horizonBand,g.glidePath]));
    const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:30},{wch:25},{wch:90}];
    XLSX.utils.book_append_sheet(wb, ws, "Goal Framework");
  }
  const instr = p.indicativeInstruments || p.sharedInstrumentUniverse;
  if(instr){
    const rows = [["Sleeve","Instruments"]];
    Object.keys(instr).forEach(k=>rows.push([k, instr[k]]));
    const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:20},{wch:100}];
    XLSX.utils.book_append_sheet(wb, ws, "Instrument Universe");
  }
  if(entry.versions.length){
    const rows = [["Version","Timestamp","Note"]];
    entry.versions.forEach(v=>rows.push(["v"+v.version, v.timestamp, v.note||""]));
    const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:10},{wch:24},{wch:80}];
    XLSX.utils.book_append_sheet(wb, ws, "Version History");
  }
  if(uploadedConstituents[pid] && uploadedConstituents[pid].length){
    const rows = [["Symbol","Name","Weight"]];
    uploadedConstituents[pid].forEach(r=>rows.push([r.symbol,r.name,r.weight]));
    const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:15},{wch:40},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws, "Constituents (Uploaded)");
  }
  XLSX.writeFile(wb, `${p.code}_${p.id}_ProductNote.xlsx`);
  } catch(err){
    console.error("exportXlsx failed", err);
    alert("Excel export failed unexpectedly: " + (err && err.message ? err.message : err) + "\n\nCheck the browser console for details.");
  }
}

function exportAllXlsx(){
  if(!checkExportLibs(["xlsx"])) return;
  try{
  const wb = XLSX.utils.book_new();
  const all = getAllProducts();
  const summaryRows = [["ID","Code","Name","Category","Status","Version","Risk Profile","Benchmark","Rebalance Frequency"]];
  all.forEach(p=>{
    const entry = getEntry(p.id);
    summaryRows.push([p.id,p.code,p.name,p.category,entry.status,"v"+entry.versions.length,p.riskProfile,p.benchmark,p.rebalanceFrequency]);
  });
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{wch:6},{wch:16},{wch:55},{wch:35},{wch:10},{wch:8},{wch:16},{wch:50},{wch:40}];
  XLSX.utils.book_append_sheet(wb, wsSummary, "All Products Summary");
  all.forEach(p=>{
    const entry = getEntry(p.id);
    const ws = XLSX.utils.aoa_to_sheet(productToRows(p, entry));
    ws['!cols'] = [{wch:24},{wch:100}];
    XLSX.utils.book_append_sheet(wb, ws, p.code.slice(0,28));
  });
  XLSX.writeFile(wb, `Vriksha_Product_Notes_All9.xlsx`);
  } catch(err){
    console.error("exportAllXlsx failed", err);
    alert("Excel export failed unexpectedly: " + (err && err.message ? err.message : err) + "\n\nCheck the browser console for details.");
  }
}

// ============================================================================
// PDF EXPORT — Vriksha-branded document theme (light, print-appropriate)
// ============================================================================
const PDF_THEME = {
  forest: [15, 26, 18],      // #0f1a12 — headings
  moss:   [45, 74, 50],      // #2d4a32 — section rules, sub-headings
  sage:   [90, 110, 94],     // darkened from #7a9e7e for legibility on white
  gold:   [150, 122, 45],    // darkened from #c4a84f for legibility on white
  ink:    [30, 38, 32],      // body text — near-black, slightly warm
  faint:  [120, 130, 122],   // meta text, footers
  pageWidth: 210,            // A4 mm
  margin: 18
};

function pdfNewDoc(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  return doc;
}

function pdfHeader(doc, title, subtitle){
  const m = PDF_THEME.margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_THEME.gold);
  doc.text("VRIKSHA", m, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_THEME.sage);
  doc.text("PRODUCT NOTE STUDIO", m, 18);
  doc.setDrawColor(...PDF_THEME.moss);
  doc.setLineWidth(0.4);
  doc.line(m, 21, PDF_THEME.pageWidth - m, 21);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...PDF_THEME.forest);
  const titleLines = doc.splitTextToSize(title, PDF_THEME.pageWidth - 2*m);
  doc.text(titleLines, m, 30);
  let y = 30 + titleLines.length * 6.5;
  if(subtitle){
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_THEME.sage);
    doc.text(subtitle, m, y);
    y += 6;
  }
  return y + 2;
}

function pdfFooter(doc, footnote){
  const pageCount = doc.internal.getNumberOfPages();
  for(let i=1;i<=pageCount;i++){
    doc.setPage(i);
    const m = PDF_THEME.margin;
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...PDF_THEME.moss);
    doc.setLineWidth(0.2);
    doc.line(m, pageH-14, PDF_THEME.pageWidth-m, pageH-14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_THEME.faint);
    if(footnote){
      const lines = doc.splitTextToSize(footnote, PDF_THEME.pageWidth - 2*m - 20);
      doc.text(lines, m, pageH-10);
    }
    doc.text(`${i} / ${pageCount}`, PDF_THEME.pageWidth-m, pageH-10, {align:"right"});
  }
}

function pdfSectionHeading(doc, text, y){
  const m = PDF_THEME.margin;
  if(y > 260){ doc.addPage(); y = 24; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...PDF_THEME.forest);
  doc.text(text.toUpperCase(), m, y);
  doc.setDrawColor(...PDF_THEME.gold);
  doc.setLineWidth(0.6);
  doc.line(m, y+1.5, m+14, y+1.5);
  return y + 7;
}

function pdfBody(doc, text, y, opts){
  opts = opts || {};
  const m = PDF_THEME.margin;
  const size = opts.size || 9.5;
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...(opts.color || PDF_THEME.ink));
  const lines = doc.splitTextToSize(text || "—", PDF_THEME.pageWidth - 2*m);
  lines.forEach(line=>{
    if(y > 275){ doc.addPage(); y = 24; }
    doc.text(line, m, y);
    y += size*0.42 + 2.2;
  });
  return y + 2;
}

function pdfKv(doc, k, v, y){
  const m = PDF_THEME.margin;
  if(y > 272){ doc.addPage(); y = 24; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_THEME.moss);
  doc.text(k + ":", m, y);
  const kw = doc.getTextWidth(k + ":  ");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_THEME.ink);
  const lines = doc.splitTextToSize(String(v==null?"—":v), PDF_THEME.pageWidth - 2*m - kw);
  doc.text(lines, m + kw, y);
  return y + Math.max(lines.length,1)*4.3 + 2.5;
}

function pdfBullets(doc, items, y){
  const m = PDF_THEME.margin;
  (items||[]).forEach(item=>{
    if(y > 272){ doc.addPage(); y = 24; }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_THEME.gold);
    doc.text("—", m, y);
    doc.setTextColor(...PDF_THEME.ink);
    const lines = doc.splitTextToSize(item, PDF_THEME.pageWidth - 2*m - 6);
    doc.text(lines, m+5, y);
    y += lines.length*4.3 + 2;
  });
  return y + 2;
}

function pdfTable(doc, head, rows, y){
  doc.autoTable({
    startY: y,
    head: [head],
    body: rows,
    margin: {left: PDF_THEME.margin, right: PDF_THEME.margin},
    styles: {font:"helvetica", fontSize:8.3, textColor:PDF_THEME.ink, cellPadding:2.2, lineColor:[220,225,220], lineWidth:0.2},
    headStyles: {fillColor:PDF_THEME.moss, textColor:[255,255,255], fontStyle:"bold"},
    alternateRowStyles: {fillColor:[245,248,245]}
  });
  return doc.lastAutoTable.finalY + 6;
}

// ---------- Full-note PDF (content mirrors exportDocx exactly) ----------
function exportPdf(pid){
  if(!checkExportLibs(["jspdf","autotable","saveAs"])) return;
  try{
    const p = getProduct(pid);
    const entry = getEntry(pid);
    const doc = pdfNewDoc();
    let y = pdfHeader(doc, p.name, `${p.category}  ·  Code: ${p.code}  ·  Status: ${entry.status.toUpperCase()}  ·  v${entry.versions.length}`);

    y = pdfSectionHeading(doc, "Key Facts", y);
    y = pdfKv(doc, "Risk Profile", p.riskProfile, y);
    y = pdfKv(doc, "Asset Classes", (p.assetClasses||[]).join("; "), y);
    y = pdfKv(doc, "Benchmark", p.benchmark, y);
    y = pdfKv(doc, "Rebalance Frequency", p.rebalanceFrequency, y);
    y = pdfKv(doc, "Minimum Investment", p.minInvestment||"—", y);
    y = pdfKv(doc, "Fees", p.fees||"—", y);

    y = pdfSectionHeading(doc, "Investment Objective", y);
    y = pdfBody(doc, p.objective, y);

    y = pdfSectionHeading(doc, "Philosophy & Methodology", y);
    y = pdfBody(doc, p.philosophy || p.selectionMethodology || "", y);
    if(p.portfolioConstruction) y = pdfKv(doc, "Portfolio Construction", p.portfolioConstruction, y);
    if(p.portfolioConstructionNote) y = pdfBody(doc, p.portfolioConstructionNote, y);
    if(p.portfolioConstructionRules){
      const r = p.portfolioConstructionRules;
      y = pdfKv(doc, "Stock Count Range", r.stockCountRange||"—", y);
      y = pdfKv(doc, "Caps & Position Sizing", formatCapsSentence(r), y);
      y = pdfKv(doc, "Cash Buffer", r.cashBuffer||"—", y);
    }

    if(p.styleSleeves){
      y = pdfSectionHeading(doc, "Style Sleeves", y);
      y = pdfTable(doc, ["Sleeve","Weight Range","Universe"], p.styleSleeves.map(s=>[s.name, s.weightRange||"—", s.universe||"—"]), y);
    }

    if(p.strategicAllocationRanges){
      y = pdfSectionHeading(doc, "Strategic Allocation Ranges", y);
      y = pdfTable(doc, ["Sleeve","Target Range"], p.strategicAllocationRanges.map(a=>[a.sleeve, a.range]), y);
    }

    if(p.variants){
      y = pdfSectionHeading(doc, "Risk-Profile Variants", y);
      p.variants.forEach(v=>{
        if(y > 260){ doc.addPage(); y = 24; }
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5); doc.setTextColor(...PDF_THEME.moss);
        doc.text(v.profile, PDF_THEME.margin, y); y += 5.5;
        if(v.targetInvestor) y = pdfBody(doc, v.targetInvestor, y, {size:9});
        if(v.factorMix){
          y = pdfKv(doc, "Factor Mix", v.factorMix, y);
          y = pdfKv(doc, "Universe", v.universe, y);
          y = pdfKv(doc, "Stock Count", v.stockCount, y);
        }
        if(v.allocation){
          y = pdfTable(doc, ["Sleeve","Target Range"], v.allocation.map(a=>[a.sleeve, a.range]), y);
          if(v.expectedEquityLikeExposure) y = pdfKv(doc, "Equity-like Exposure", v.expectedEquityLikeExposure, y);
        }
        y += 2;
      });
    }

    if(p.goalFramework){
      y = pdfSectionHeading(doc, "Life Goal Framework (Glide Path)", y);
      p.goalFramework.forEach(g=>{
        if(y > 265){ doc.addPage(); y = 24; }
        doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(...PDF_THEME.moss);
        doc.text(`${g.goal} — ${g.horizonBand}`, PDF_THEME.margin, y); y += 5;
        y = pdfBody(doc, g.glidePath, y, {size:9});
      });
    }

    y = pdfSectionHeading(doc, "Suitability", y);
    y = pdfBody(doc, p.suitability, y);

    y = pdfSectionHeading(doc, "Key Risks", y);
    y = pdfBullets(doc, p.keyRisks, y);

    y = pdfSectionHeading(doc, "Tax & Fees", y);
    y = pdfKv(doc, "Fees", p.fees||"—", y);
    y = pdfKv(doc, "Tax Treatment", p.taxNote || "To be detailed in a future revision.", y);

    pdfFooter(doc, `Product code ${p.code} · Status: ${entry.status.toUpperCase()} · Internal / product-development document. Not investor-facing until reviewed for SEBI Research Analyst / smallcase compliance requirements, final fee structure, and tax disclosures.`);
    doc.save(`${p.code}_${p.id}_ProductNote.pdf`);
  } catch(err){
    console.error("exportPdf failed", err);
    alert("PDF export failed unexpectedly: " + (err && err.message ? err.message : err) + "\n\nCheck the browser console for details.");
  }
}

// ---------- Short-form client summary PDF (fixed field set, 1-2 pages) ----------
function exportClientSummaryPdf(pid){
  if(!checkExportLibs(["jspdf","autotable","saveAs"])) return;
  try{
    const p = getProduct(pid);
    const doc = pdfNewDoc();
    let y = pdfHeader(doc, p.shortName || p.name, p.category);

    y = pdfSectionHeading(doc, "Objective", y);
    y = pdfBody(doc, p.objective, y);

    y = pdfSectionHeading(doc, "Key Facts", y);
    y = pdfKv(doc, "Risk Profile", p.riskProfile, y);
    y = pdfKv(doc, "Benchmark", p.benchmark, y);
    y = pdfKv(doc, "Minimum Investment", p.minInvestment||"—", y);

    y = pdfSectionHeading(doc, "Suitability", y);
    y = pdfBody(doc, p.suitability, y);

    y = pdfSectionHeading(doc, "Key Risks", y);
    y = pdfBullets(doc, (p.keyRisks||[]).slice(0,5), y);

    pdfFooter(doc, "Summary overview for discussion purposes — not a complete product note. Full terms, fees, and risk disclosures available on request.");
    doc.save(`${p.code}_${p.id}_ClientSummary.pdf`);
  } catch(err){
    console.error("exportClientSummaryPdf failed", err);
    alert("Client summary PDF export failed unexpectedly: " + (err && err.message ? err.message : err) + "\n\nCheck the browser console for details.");
  }
}

function exportDocx(pid){
  if(!checkExportLibs(["docx","saveAs"])) return Promise.resolve();
  try{
  const p = getProduct(pid);
  const entry = getEntry(pid);
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = docx;

  function h1(text){ return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing:{before:280, after:120} }); }
  function h2(text){ return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing:{before:220, after:100} }); }
  function body(text){ return new Paragraph({ children:[new TextRun(text||"—")], spacing:{after:160} }); }
  function bullet(text){ return new Paragraph({ text, bullet:{level:0}, spacing:{after:60} }); }
  function kvPara(k,v){ return new Paragraph({ children:[ new TextRun({text:k+": ", bold:true}), new TextRun(v||"—") ], spacing:{after:80} }); }

  function simpleTable(headerRow, dataRows){
    const mkCell = (text, bold) => new TableCell({
      children:[new Paragraph({children:[new TextRun({text:String(text||""), bold:!!bold})]})],
      margins:{top:80,bottom:80,left:100,right:100}
    });
    const rows = [ new TableRow({ children: headerRow.map(h=>mkCell(h,true)) }) ];
    dataRows.forEach(r=> rows.push(new TableRow({ children: r.map(c=>mkCell(c,false)) })));
    return new Table({ rows, width:{size:100, type:WidthType.PERCENTAGE} });
  }

  const children = [];
  children.push(new Paragraph({ text: p.name, heading: HeadingLevel.TITLE, spacing:{after:60} }));
  children.push(new Paragraph({ children:[new TextRun({text:`${p.category}  ·  Code: ${p.code}  ·  Status: ${entry.status.toUpperCase()}  ·  v${entry.versions.length}`, italics:true, color:"666666"})], spacing:{after:240} }));

  children.push(h2("Key Facts"));
  children.push(kvPara("Risk Profile", p.riskProfile));
  children.push(kvPara("Asset Classes", p.assetClasses.join("; ")));
  children.push(kvPara("Benchmark", p.benchmark));
  children.push(kvPara("Rebalance Frequency", p.rebalanceFrequency));
  children.push(kvPara("Minimum Investment", p.minInvestment||"—"));
  children.push(kvPara("Fees", p.fees||"—"));

  children.push(h2("Investment Objective"));
  children.push(body(p.objective));

  children.push(h2("Philosophy & Methodology"));
  children.push(body(p.philosophy || p.selectionMethodology || ""));
  if(p.portfolioConstruction) children.push(kvPara("Portfolio Construction", p.portfolioConstruction));
  if(p.portfolioConstructionNote) children.push(body(p.portfolioConstructionNote));
  if(p.portfolioConstructionRules){
    const r = p.portfolioConstructionRules;
    children.push(kvPara("Stock Count Range", r.stockCountRange||"—"));
    children.push(kvPara("Caps & Position Sizing", formatCapsSentence(r)));
    children.push(kvPara("Cash Buffer", r.cashBuffer||"—"));
  }

  if(p.styleSleeves){
    children.push(h2("Style Sleeves"));
    children.push(simpleTable(
      ["Sleeve","Weight Range","Criteria","Universe","Indicative Names"],
      p.styleSleeves.map(s=>[s.name,s.weightRange,s.criteria,s.universe,s.indicativeNames])
    ));
  }

  if(p.strategicAllocationRanges){
    children.push(h2("Strategic Allocation Ranges"));
    children.push(simpleTable(["Sleeve","Target Range"], p.strategicAllocationRanges.map(a=>[a.sleeve,a.range])));
  }

  if(p.variants){
    children.push(h2("Risk-Profile Variants"));
    p.variants.forEach(v=>{
      children.push(new Paragraph({ children:[new TextRun({text:v.profile, bold:true, size:26})], spacing:{before:160,after:80} }));
      if(v.targetInvestor) children.push(body(v.targetInvestor));
      if(v.factorMix){
        children.push(kvPara("Factor Mix", v.factorMix));
        children.push(kvPara("Universe", v.universe));
        children.push(kvPara("Stock Count", v.stockCount));
        children.push(kvPara("Reference Index", v.referenceIndex));
        children.push(body(v.rationale));
      }
      if(v.allocation){
        children.push(simpleTable(["Sleeve","Target Range"], v.allocation.map(a=>[a.sleeve,a.range])));
        if(v.expectedEquityLikeExposure) children.push(kvPara("Equity-like Exposure", v.expectedEquityLikeExposure));
      }
    });
  }

  if(p.goalFramework){
    children.push(h2("Life Goal Framework (Glide Path)"));
    p.goalFramework.forEach(g=>{
      children.push(new Paragraph({ children:[new TextRun({text:`${g.goal} — ${g.horizonBand}`, bold:true})], spacing:{before:140,after:60} }));
      children.push(body(g.glidePath));
      if(g.riskProfileAdjustment) children.push(kvPara("Risk-profile adjustment", g.riskProfileAdjustment));
    });
  }

  const instr = p.indicativeInstruments || p.sharedInstrumentUniverse;
  if(instr){
    children.push(h2("Indicative Instrument Universe"));
    Object.keys(instr).forEach(k=>{
      children.push(kvPara(k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()), instr[k]));
    });
    children.push(new Paragraph({ children:[new TextRun({text:"Illustrative universe based on public data as of mid-2026. Reconfirm eligible instruments, tickers, and AUM/liquidity thresholds at each rebalance and before launch.", italics:true, color:"996600"})], spacing:{before:80,after:160} }));
  }

  if(uploadedConstituents[pid] && uploadedConstituents[pid].length){
    children.push(h2("Uploaded Constituents & Weights"));
    children.push(simpleTable(["Symbol","Name","Weight"], uploadedConstituents[pid].map(r=>[r.symbol,r.name,r.weight])));
  }

  children.push(h2("Suitability"));
  children.push(body(p.suitability));

  children.push(h2("Key Risks"));
  (p.keyRisks||[]).forEach(r=>children.push(bullet(r)));

  children.push(h2("Tax & Fees"));
  children.push(kvPara("Fees", p.fees||"—"));
  children.push(kvPara("Tax Treatment", p.taxNote || "To be detailed in a future revision."));

  if(entry.versions.length){
    children.push(h2("Version History"));
    entry.versions.forEach(v=>{
      children.push(new Paragraph({ children:[new TextRun({text:`v${v.version} — ${new Date(v.timestamp).toLocaleString()}${v.note ? ' — ' + v.note : ''}`, size:19})], spacing:{after:60} }));
    });
  }

  children.push(new Paragraph({ children:[new TextRun({text:`Product code ${p.code} · Status: ${entry.status.toUpperCase()} · Internal / product-development document. Not investor-facing until reviewed for SEBI Research Analyst / smallcase compliance requirements, final fee structure, and tax disclosures.`, italics:true, size:18, color:"888888"})], spacing:{before:300} }));

  const doc = new Document({ sections:[{ properties:{}, children }] });
  return Packer.toBlob(doc).then(blob=>{
    saveAs(blob, `${p.code}_${p.id}_ProductNote.docx`);
  }).catch(err=>{
    console.error("exportDocx (Packer.toBlob) failed", err);
    alert("Word export failed unexpectedly: " + (err && err.message ? err.message : err) + "\n\nCheck the browser console for details.");
  });
  } catch(err){
    console.error("exportDocx failed", err);
    alert("Word export failed unexpectedly: " + (err && err.message ? err.message : err) + "\n\nCheck the browser console for details.");
    return Promise.resolve();
  }
}

// ============================================================================
// INIT — auth-gated boot sequence
// ============================================================================

let appBooted = false; // guards against double-initializing the app view on repeated SIGNED_IN events
let authListenerFired = false; // guards the boot-timeout fallback below

function showBootError(msg){
  document.getElementById("bootLoading").style.display = "none";
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appRoot").style.display = "none";
  document.getElementById("bootErrorMsg").textContent = msg;
  document.getElementById("bootError").style.display = "flex";
}

async function bootAppForUser(user){
  currentUser = { id: user.id, email: user.email };
  try {
    await loadAllFromSupabase();
    showAppScreen();
    initSidebarCollapse();
    renderNav();
    updateSyncStatus();
    if(!appBooted){
      showView('overview');
      appBooted = true;
    }
  } catch(err){
    showAppScreen();
    showGlobalError("Could not load product data from the database: " + err.message + " — try Refresh, or check your connection.");
  }
}

if (supabaseInitError) {
  showBootError(supabaseInitError.message + "\n\nTry reloading the page. If this keeps happening, the network you're on may be blocking cdn.jsdelivr.net.");
} else {
  try {
    sb.auth.onAuthStateChange((event, session) => {
      authListenerFired = true;
      if(session && session.user){
        bootAppForUser(session.user);
      } else {
        currentUser = null;
        appBooted = false;
        state = { products: {}, templates: {}, lastSaved: null };
        showLoginScreen();
      }
    });
  } catch(err){
    console.error("Failed to register auth listener:", err);
    showBootError("Failed to start the authentication check: " + err.message + "\n\nTry reloading the page.");
  }

  setTimeout(() => {
    if (!authListenerFired) {
      showBootError("The app is taking longer than expected to start (no response from Supabase after 8 seconds). This usually means a slow or blocked network connection to " + SUPABASE_URL + ".");
    }
  }, 8000);
}
