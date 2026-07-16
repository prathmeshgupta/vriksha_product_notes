
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
    html += kv("Single-Stock Cap", p.portfolioConstructionRules.singleStockCap || "—");
    html += kv("Sector Cap", p.portfolioConstructionRules.sectorCap || "—");
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

// mailto: links are unreliable above ~1800-2000 encoded characters across mail
// clients (Outlook in particular truncates aggressively) — so this produces a
// concise summary, not the full note. Full notes go via Word/Excel export or
// by asking Claude to create a Gmail draft with the complete content.
function productToPlainText(p, entry, opts){
  opts = opts || {};
  const maxLen = opts.maxLen || 1100; // soft target for the body text portion
  const footer = "\n\n— Sent from Vriksha Product Note Studio. This is a summary; full structured detail (allocation bands, variants, instrument universe) is in the Word/Excel export.";

  // Fixed, always-included header — facts + full objective + full risk list.
  // These are the highest-value fields for a quick email; philosophy is the
  // one section allowed to be trimmed or dropped if space runs short.
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

  // Backstop: if objective + risks alone exceed the budget (rare — a product
  // with an unusually long risk list), hard-truncate rather than send an
  // oversized mailto: URL that some clients will silently reject.
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
