
// ============================================================================
// EDITOR — structured controls for numeric/allocation fields, freeform for prose
// ============================================================================

function sumRangeHighs(rows){
  // rows: [{range: "35-55%"}] -> sums the high end of each range for a rough validation signal
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

  // Construction rules (caps) — structured, applies to single-asset stock products
  html += `<h2 class="section">Construction Rules — Caps &amp; Limits <span class="s-label-inline">structured</span></h2><div class="card">`;
  const rules = p.portfolioConstructionRules || { stockCountRange:"", singleStockCap:"", sectorCap:"", cashBuffer:"" };
  html += `
    <div class="field-row"><div class="field-label">Stock Count Range</div><input type="text" class="input-sm" value="${escAttr(rules.stockCountRange)}" onchange="updateConstructionRule('${id}','stockCountRange',this.value)" placeholder="e.g. 15-25"></div>
    <div class="field-row"><div class="field-label">Single-Stock Cap (%)</div><input type="text" class="input-sm" value="${escAttr(rules.singleStockCap)}" onchange="updateConstructionRule('${id}','singleStockCap',this.value)" placeholder="e.g. 10%"></div>
    <div class="field-row"><div class="field-label">Sector Cap (%)</div><input type="text" class="input-sm" value="${escAttr(rules.sectorCap)}" onchange="updateConstructionRule('${id}','sectorCap',this.value)" placeholder="e.g. 30%"></div>
    <div class="field-row"><div class="field-label">Cash Buffer (%)</div><input type="text" class="input-sm" value="${escAttr(rules.cashBuffer)}" onchange="updateConstructionRule('${id}','cashBuffer',this.value)" placeholder="e.g. 0-5%"></div>
  `;
  html += `<div class="callout">These caps apply as hard rules during rebalancing/construction — keep them numeric and unambiguous (e.g. "10%" not "around ten percent") since they'll be checked mechanically once the compliance engine (see Roadmap) is built.</div>`;
  html += `</div>`;

  // Style sleeves editor (Product 1-style)
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
        <textarea rows="2" style="margin-bottom:14px;" onchange="updateSleeveField('${id}',${i},'criteria',this.value)" placeholder="Selection criteria">${escText(s.criteria||'')}</textarea>
      `;
    });
    html += `</div>`;
    html += weightSumBadge(p.styleSleeves);
    html += `<div style="margin-top:12px;"><button class="btn small" onclick="addSleeve('${id}')">+ Add Sleeve</button></div>`;
    html += `</div>`;
  }

  // Strategic allocation ranges editor (Product 2-style)
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
      `;
    });
    html += weightSumBadge(p.strategicAllocationRanges);
    html += `<div style="margin-top:12px;"><button class="btn small" onclick="addAllocRow('${id}','strategicAllocationRanges')">+ Add Sleeve</button></div>`;
    html += `</div>`;
  }

  // Variants editor (risk-profiled products)
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

  // Goal framework editor
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

  // Key risks editor (list)
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
function updateSleeveField(id, idx, field, value){
  getProduct(id).styleSleeves[idx][field] = value;
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
  // Cheap approach: full re-render keeps badges in sync without complex partial DOM patching.
  // Re-render only if currently viewing the edit screen for this product.
  if(currentView==="edit" && currentProductId===id){
    const scrollY = window.scrollY;
    renderEdit(id);
    window.scrollTo(0, scrollY);
  }
}
