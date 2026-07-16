
// ============================================================================
// EXPORT — Excel & Word (reads from live edited state, not static seed data)
// ============================================================================

// Export relies on three CDN-loaded libraries (SheetJS/XLSX, docx, FileSaver).
// If any of them fail to load — blocked script, ad-blocker, offline, CDN outage —
// the export buttons would otherwise do nothing with no visible feedback. This
// guard turns that into a clear, actionable on-screen message instead of a
// silent no-op.
function checkExportLibs(need){
  const missing = [];
  if(need.includes("xlsx") && typeof XLSX === "undefined") missing.push("SheetJS (XLSX) — used for Excel export");
  if(need.includes("docx") && typeof docx === "undefined") missing.push("docx.js — used for Word export");
  if(need.includes("saveAs") && typeof saveAs === "undefined") missing.push("FileSaver.js — used to trigger the file download");
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
    rows.push(["Single-Stock Cap", r.singleStockCap||""]);
    rows.push(["Sector Cap", r.sectorCap||""]);
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
    children.push(kvPara("Single-Stock Cap", r.singleStockCap||"—"));
    children.push(kvPara("Sector Cap", r.sectorCap||"—"));
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
// INIT
// ============================================================================
initState();
initSidebarCollapse();
renderNav();
showView('overview');
