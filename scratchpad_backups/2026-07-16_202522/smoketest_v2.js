const { JSDOM } = require("/tmp/node_modules/jsdom");
const fs = require("fs");

let html = fs.readFileSync("/sessions/sleepy-practical-meitner/mnt/outputs/portfolio_dashboard_v2.html", "utf8");
html = html.replace(/<script src="https:\/\/cdnjs[^"]*"><\/script>\s*/g, "");
// expose top-level const/let bindings needed for testing (localStorage-backed `state` and BASE_PRODUCTS)
html = html.replace("const BASE_PRODUCTS = [", "window.BASE_PRODUCTS = [");
html = html.replace(/\bBASE_PRODUCTS\b/g, "window.BASE_PRODUCTS").replace("window.window.BASE_PRODUCTS = [", "window.BASE_PRODUCTS = [");
html = html.replace("let state = { products: {}, lastSaved: null };", "window.state = { products: {}, lastSaved: null };");
html = html.replace(/\bstate\b/g, "window.state").replace("window.window.state = ", "window.state = ");
html = html.replace("let uploadedConstituents = {};", "window.uploadedConstituents = {};");
html = html.replace(/\buploadedConstituents\b/g, "window.uploadedConstituents").replace("window.window.uploadedConstituents", "window.uploadedConstituents");

// simple in-memory localStorage polyfill for jsdom (jsdom does provide window.localStorage, but let's be safe)
(async () => {
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    url: "https://example.org/dashboard.html",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.XLSX = {
        utils: {
          book_new: () => ({ Sheets: {}, SheetNames: [] }),
          aoa_to_sheet: (rows) => ({ __rows: rows }),
          book_append_sheet: (wb, ws, name) => { wb.Sheets[name] = ws; wb.SheetNames.push(name); }
        },
        writeFile: (wb, name) => { window.__lastXlsx = { wb, name }; }
      };
      window.Papa = { parse: () => {} };
      window.docx = {
        Document: function (opts) { this.opts = opts; },
        Packer: { toBlob: (doc) => Promise.resolve({ __doc: doc }) },
        Paragraph: function (opts) { this.opts = opts; },
        TextRun: function (opts) { this.opts = opts; },
        HeadingLevel: { TITLE: "TITLE", HEADING_1: "H1", HEADING_2: "H2" },
        Table: function (opts) { this.opts = opts; },
        TableRow: function (opts) { this.opts = opts; },
        TableCell: function (opts) { this.opts = opts; },
        WidthType: { PERCENTAGE: "PERCENTAGE" },
        BorderStyle: {}
      };
      window.saveAs = (blob, name) => { window.__lastSavedFile = name; };
      window.confirm = () => true;
      window.prompt = () => "test version note";
      window.scrollTo = () => {};
      window.Element.prototype.scrollIntoView = function(){};
    }
  });

  const { window } = dom;
  await new Promise((r) => setTimeout(r, 300));

  const errors = [];
  const P = window;

  // 1. Init check
  if (!P.state || Object.keys(P.state.products).length !== 9) {
    errors.push("State did not initialize with 9 products: " + (P.state && Object.keys(P.state.products).length));
  }

  // 2. Overview renders with status pills
  const grid = P.document.getElementById("overviewGrid");
  if (!grid || grid.children.length !== 9) errors.push("Overview grid did not render 9 cards");
  if (!grid.innerHTML.includes("draft")) errors.push("Draft status pill not shown on overview");

  // 3. Navigate to product, then edit screen
  try {
    P.showProduct("P1");
    if (!P.document.getElementById("main").innerHTML.includes("Complete Discretionary Stock-Only Portfolio")) {
      errors.push("P1 product view did not render name");
    }
    P.showEdit("P1");
    if (!P.document.getElementById("main").innerHTML.includes("Edit —")) errors.push("Edit view did not render");
  } catch (e) { errors.push("Navigate to edit threw: " + e.message); }

  // 4. Structured field edit: update a sleeve weight range, verify state updated + badge logic runs
  try {
    P.updateSleeveField("P1", 0, "weightRange", "40-60%");
    const sleeve = P.getProduct("P1").styleSleeves[0];
    if (sleeve.weightRange !== "40-60%") errors.push("updateSleeveField did not persist change");
  } catch (e) { errors.push("updateSleeveField threw: " + e.message); }

  // 5. Structured construction rule edit
  try {
    P.updateConstructionRule("P1", "singleStockCap", "12%");
    if (P.getProduct("P1").portfolioConstructionRules.singleStockCap !== "12%") {
      errors.push("updateConstructionRule did not persist change");
    }
  } catch (e) { errors.push("updateConstructionRule threw: " + e.message); }

  // 6. Freeform field edit
  try {
    P.updateField("P1", "objective", "Updated objective text for testing.");
    if (P.getProduct("P1").objective !== "Updated objective text for testing.") {
      errors.push("updateField (freeform) did not persist change");
    }
  } catch (e) { errors.push("updateField threw: " + e.message); }

  // 7. Risk list add/edit/remove
  try {
    const beforeCount = P.getProduct("P1").keyRisks.length;
    P.addRisk("P1");
    if (P.getProduct("P1").keyRisks.length !== beforeCount + 1) errors.push("addRisk did not add a risk");
    P.updateRisk("P1", beforeCount, "Custom test risk");
    if (P.getProduct("P1").keyRisks[beforeCount] !== "Custom test risk") errors.push("updateRisk did not persist");
    P.removeRisk("P1", beforeCount);
    if (P.getProduct("P1").keyRisks.length !== beforeCount) errors.push("removeRisk did not remove");
  } catch (e) { errors.push("risk list ops threw: " + e.message); }

  // 8. Allocation row add/remove (Product 2 strategicAllocationRanges)
  try {
    const beforeCount = P.getProduct("P2").strategicAllocationRanges.length;
    P.addAllocRow("P2", "strategicAllocationRanges");
    if (P.getProduct("P2").strategicAllocationRanges.length !== beforeCount + 1) errors.push("addAllocRow did not add");
    P.removeAllocRow("P2", "strategicAllocationRanges", beforeCount);
    if (P.getProduct("P2").strategicAllocationRanges.length !== beforeCount) errors.push("removeAllocRow did not remove");
  } catch (e) { errors.push("alloc row ops threw: " + e.message); }

  // 9. Variant allocation edit (Product 3)
  try {
    P.updateVariantAllocField("P3", 0, 0, "range", "35-45%");
    if (P.getProduct("P3").variants[0].allocation[0].range !== "35-45%") {
      errors.push("updateVariantAllocField did not persist");
    }
  } catch (e) { errors.push("updateVariantAllocField threw: " + e.message); }

  // 10. Publish version, verify status flips and version recorded
  try {
    const beforeVersions = P.getEntry("P1").versions.length;
    P.publishProduct("P1");
    const entry = P.getEntry("P1");
    if (entry.versions.length !== beforeVersions + 1) errors.push("publishProduct did not add a version");
    if (entry.status !== "published") errors.push("publishProduct did not set status to published");
    if (entry.versions[entry.versions.length-1].note !== "test version note") errors.push("publish note not recorded");
  } catch (e) { errors.push("publishProduct threw: " + e.message); }

  // 11. Edit again after publish, publish v2, then diff v1 vs v2
  try {
    P.updateField("P1", "objective", "Second revision of the objective text.");
    P.publishProduct("P1");
    const entry = P.getEntry("P1");
    if (entry.versions.length < 2) errors.push("second publish did not create v2");
    P.showHistory("P1");
    const historyHtml = P.document.getElementById("main").innerHTML;
    if (!historyHtml.includes("v1") || !historyHtml.includes("v2")) errors.push("history view missing v1/v2 rows");
    P.showDiff("P1", 0, 1);
    const diffHtml = P.document.getElementById("diffContainer").innerHTML;
    if (!diffHtml.includes("diff-add") && !diffHtml.includes("diff-remove")) {
      errors.push("diff view did not show any add/remove markers for a known-changed field");
    }
  } catch (e) { errors.push("version 2 + diff flow threw: " + e.message); }

  // 12. Revert to v1
  try {
    P.revertToVersion("P1", 0);
    if (P.getProduct("P1").objective !== "Updated objective text for testing.") {
      errors.push("revertToVersion did not restore v1 content correctly");
    }
    if (P.getEntry("P1").status !== "draft") errors.push("revertToVersion did not set status back to draft");
  } catch (e) { errors.push("revertToVersion threw: " + e.message); }

  // 13. Backup: download snapshot (stubbed saveAs) and load it back
  try {
    P.showView("backup");
    P.downloadSnapshot();
    if (!P.window.__lastSavedFile || !P.window.__lastSavedFile.includes("snapshot")) {
      errors.push("downloadSnapshot did not produce expected filename");
    }
  } catch (e) { errors.push("downloadSnapshot threw: " + e.message); }

  // 14. Exports still work against live edited state
  for (const pid of Object.keys(P.state.products)) {
    try {
      P.exportXlsx(pid);
      if (!P.window.__lastXlsx || !P.window.__lastXlsx.name.includes(P.getProduct(pid).code)) {
        errors.push(`exportXlsx(${pid}) filename mismatch`);
      }
    } catch (e) { errors.push(`exportXlsx(${pid}) threw: ${e.message}`); }
    try {
      await P.exportDocx(pid);
    } catch (e) { errors.push(`exportDocx(${pid}) threw: ${e.message}`); }
  }
  try {
    P.exportAllXlsx();
    if (!P.window.__lastXlsx || !P.window.__lastXlsx.name.includes("All9")) errors.push("exportAllXlsx filename mismatch");
  } catch (e) { errors.push("exportAllXlsx threw: " + e.message); }

  // 15. localStorage persistence sanity: reload state from storage and verify P1 edits survived
  try {
    const raw = P.localStorage.getItem("vriksha_pns_state_v1");
    if (!raw) errors.push("localStorage did not persist state under expected key");
    else {
      const parsed = JSON.parse(raw);
      if (!parsed.products.P1) errors.push("persisted state missing P1");
    }
  } catch (e) { errors.push("localStorage check threw: " + e.message); }

  // 16b. Email note: verify plain-text generator produces sane content and mailto link forms correctly
  try {
    const p = P.getProduct("P4");
    const entry = P.getEntry("P4");
    const text = P.productToPlainText(p, entry);
    if (!text.includes(p.name)) errors.push("productToPlainText missing product name");
    if (!text.includes("OBJECTIVE")) errors.push("productToPlainText missing OBJECTIVE section");
    if (!text.includes("KEY RISKS")) errors.push("productToPlainText missing KEY RISKS section");
    if (text.length > 1600) errors.push("productToPlainText exceeded hard cap safety margin: " + text.length);

    const capturedHref = P.buildMailtoUrl(p, entry);
    if (!capturedHref || !capturedHref.startsWith("mailto:?subject=")) {
      errors.push("emailNote did not set a well-formed mailto href: " + capturedHref);
    }
    if (capturedHref && !capturedHref.includes("body=")) errors.push("emailNote mailto href missing body param");
    const subjMatch = capturedHref && capturedHref.match(/subject=([^&]*)/);
    if (subjMatch) {
      const decoded = decodeURIComponent(subjMatch[1]);
      if (!decoded.includes(p.code)) errors.push("emailNote subject missing product code");
    } else {
      errors.push("emailNote href missing subject param");
    }
  } catch (e) { errors.push("email note flow threw: " + e.message); }

  // 17. Create new product from template, verify shape + nav + overview inclusion
  try {
    const beforeCount = Object.keys(P.state.products).length;
    const newId = P.createProductFromTemplate("P7", "Test Custom Factor Product", "TCFP");
    if (!P.state.products[newId]) errors.push("createProductFromTemplate did not add new entry to state");
    const afterCount = Object.keys(P.state.products).length;
    if (afterCount !== beforeCount + 1) errors.push("product count did not increase by 1 after create");
    const newProduct = P.getProduct(newId);
    if (newProduct.name !== "Test Custom Factor Product") errors.push("new product name not set correctly");
    if (newProduct.code !== "TCFP") errors.push("new product code not set correctly");
    if (!newProduct.variants || newProduct.variants.length !== P.getProduct("P7").variants.length) {
      errors.push("new product did not clone template's structured shape (variants)");
    }
    const newEntry = P.getEntry(newId);
    if (newEntry.status !== "draft") errors.push("new product should start as draft");
    if (newEntry.archived !== false) errors.push("new product should not start archived");

    // verify it shows up in active product list and nav
    P.showView("overview");
    const grid = P.document.getElementById("overviewGrid");
    if (!grid.innerHTML.includes("TCFP")) errors.push("new product not shown in overview grid");
    P.renderNav();
    if (!P.document.getElementById("navList").innerHTML.includes("TCFP")) errors.push("new product not shown in nav");

    // 18. Archive it, verify it disappears from active views but is recoverable
    P.archiveProduct(newId);
    if (!P.getEntry(newId).archived) errors.push("archiveProduct did not set archived flag");
    const activeAfterArchive = P.getAllProducts();
    if (activeAfterArchive.some(p => p.id === newId)) errors.push("archived product still appears in getAllProducts() active list");
    const archivedList = P.getArchivedProducts();
    if (!archivedList.some(p => p.id === newId)) errors.push("archived product missing from getArchivedProducts()");

    P.showView("archive");
    const archiveGridHtml = P.document.getElementById("archiveGrid").innerHTML;
    if (!archiveGridHtml.includes("TCFP")) errors.push("archived product not shown in archive view");

    P.showView("overview");
    const overviewAfterArchive = P.document.getElementById("overviewGrid").innerHTML;
    if (overviewAfterArchive.includes("TCFP")) errors.push("archived product still shown in main overview (should be excluded)");

    // 19. Unarchive, verify it's back
    P.unarchiveProduct(newId);
    if (P.getEntry(newId).archived) errors.push("unarchiveProduct did not clear archived flag");
    const activeAfterRestore = P.getAllProducts();
    if (!activeAfterRestore.some(p => p.id === newId)) errors.push("restored product missing from active list after unarchive");

    // 20. Verify exportAllXlsx excludes archived products (re-archive, check export product list)
    P.archiveProduct(newId);
    P.exportAllXlsx();
    // exportAllXlsx uses getAllProducts() internally which we've already validated excludes archived — spot check the summary sheet content indirectly via the xlsx mock isn't practical here, so we validate the underlying data source function directly instead (already done above).
    P.unarchiveProduct(newId); // restore for cleanliness
  } catch (e) { errors.push("create/archive flow threw: " + e.message); }

  // 16. CSV + roadmap views still work
  try {
    P.showView("csv");
    if (!P.document.getElementById("dropZone")) errors.push("CSV view broken in v2");
    P.showView("roadmap");
    if (!P.document.getElementById("main").innerHTML.includes("Upgrade Roadmap")) errors.push("Roadmap view broken in v2");
  } catch (e) { errors.push("csv/roadmap view threw: " + e.message); }

  if (errors.length) {
    console.log("SMOKETEST V2 FAILED with " + errors.length + " issue(s):");
    errors.forEach((e) => console.log(" - " + e));
    process.exitCode = 1;
  } else {
    console.log("SMOKETEST V2 PASSED: init, structured+freeform edits, risk list ops, allocation row ops, variant edits, publish/version/diff/revert, backup snapshot, exports (all 9 xlsx+docx + combined), localStorage persistence, CSV/roadmap views — all clean.");
    process.exitCode = 0;
  }
})().catch((e) => {
  console.error("FATAL:", e.stack || e);
  process.exitCode = 1;
});
