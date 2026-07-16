
// ============================================================================
// VERSIONING, PUBLISH, AUDIT TRAIL, DIFF
// ============================================================================

function publishProduct(id){
  const entry = getEntry(id);
  const note = prompt("Optional note for this version (what changed / why publishing now):", "");
  if(note === null) return; // cancelled
  const versionNum = entry.versions.length + 1;
  const snapshot = {
    version: versionNum,
    timestamp: new Date().toISOString(),
    note: note || "",
    data: JSON.parse(JSON.stringify(entry.current))
  };
  entry.versions.push(snapshot);
  entry.status = "published";
  saveToLocalStorage();
  showHistory(id);
}

function unpublishToDraft(id){
  const entry = getEntry(id);
  entry.status = "draft";
  saveToLocalStorage();
  renderNav();
  showProduct(id);
}

function revertToVersion(id, versionIdx){
  const entry = getEntry(id);
  const v = entry.versions[versionIdx];
  if(!confirm(`Revert working draft to v${v.version} (published ${new Date(v.timestamp).toLocaleString()})? This overwrites your current unsaved edits.`)) return;
  entry.current = JSON.parse(JSON.stringify(v.data));
  entry.status = "draft";
  saveToLocalStorage();
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

// Fields to compare in diffs — covers the freeform + key structured summary fields
const DIFF_FIELDS = [
  "objective","philosophy","selectionMethodology","portfolioConstruction",
  "benchmark","rebalanceFrequency","riskProfile","suitability","minInvestment","fees","taxNote"
];

function fieldValueAt(dataObj, field){
  return dataObj[field] !== undefined ? String(dataObj[field]) : "";
}

function diffText(a, b){
  // word-level diff, simple LCS-based approach for readability at this scale
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

  // structured fields: compare JSON-stringified allocation/sleeve arrays as a coarser diff
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
// BACKUP & SYNC — JSON snapshot export/import (manual Drive sync)
// ============================================================================

function renderBackupView(){
  const main = document.getElementById("main");
  const lastSaved = state.lastSaved ? new Date(state.lastSaved).toLocaleString() : "never";
  main.innerHTML = `
    <div class="topbar"><h1>Backup &amp; Sync</h1></div>
    <div class="callout">All edits and version history live in this browser's local storage, tied to this file. Local storage can be cleared by the browser or lost if you switch machines — export a JSON snapshot regularly and drop it in your Google Drive folder as the durable backup.</div>
    <div class="card">
      <div class="kv"><div class="k">Last Auto-save</div><div class="v">${lastSaved}</div></div>
      <div class="kv"><div class="k">Products</div><div class="v">${Object.keys(state.products).length}</div></div>
      <div class="kv"><div class="k">Total Published Versions</div><div class="v">${Object.values(state.products).reduce((a,p)=>a+p.versions.length,0)}</div></div>
      <div style="margin-top:18px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn primary" onclick="downloadSnapshot()">Download JSON Snapshot</button>
        <button class="btn" onclick="document.getElementById('snapshotFileInput').click()">Load Snapshot from File</button>
        <input type="file" id="snapshotFileInput" accept=".json" style="display:none" onchange="loadSnapshotFile(this.files[0])">
      </div>
      <div class="callout warn" style="margin-top:16px;">Google Drive folder for this studio: <a href="https://drive.google.com/drive/folders/1i8qgFZkuVCJRf-NEvuiyqqGq117yA0hA" target="_blank" style="color:var(--gold);">Portfolio Product Notes — Dashboard</a>. After downloading a snapshot, move/upload it into that folder to keep an off-machine backup. This dashboard cannot write to Drive directly from the browser — download, then upload manually (or ask me to push a snapshot there for you).</div>
    </div>
    <div id="snapshotLoadResult"></div>
  `;
}

function downloadSnapshot(){
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], {type:"application/json"});
  const ts = new Date().toISOString().replace(/[:.]/g,"-");
  saveAs(blob, `vriksha_product_notes_snapshot_${ts}.json`);
}

function loadSnapshotFile(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try {
      const loaded = JSON.parse(e.target.result);
      if(!loaded.products) throw new Error("File does not look like a valid snapshot (missing 'products' key).");
      if(!confirm(`Load this snapshot? It contains ${Object.keys(loaded.products).length} products and will replace your current working state (drafts + version history).`)) return;
      state = loaded;
      saveToLocalStorage();
      document.getElementById("snapshotLoadResult").innerHTML = `<div class="callout">Snapshot loaded successfully.</div>`;
      renderNav();
      showView("overview");
    } catch(err){
      document.getElementById("snapshotLoadResult").innerHTML = `<div class="callout danger">Failed to load snapshot: ${err.message}</div>`;
    }
  };
  reader.readAsText(file);
}
