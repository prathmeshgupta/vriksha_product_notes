const { JSDOM } = require("/tmp/node_modules/jsdom");
const fs = require("fs");

let html = fs.readFileSync("/sessions/sleepy-practical-meitner/mnt/outputs/artifact_source.html", "utf8");
html = html.replace("const BASE_PRODUCTS = [", "window.BASE_PRODUCTS = [");
html = html.replace(/\bBASE_PRODUCTS\b/g, "window.BASE_PRODUCTS").replace("window.window.BASE_PRODUCTS = [", "window.BASE_PRODUCTS = [");
html = html.replace("let state = { products: {}, lastSaved: null };", "window.state = { products: {}, lastSaved: null };");
html = html.replace(/\bstate\b/g, "window.state").replace("window.window.state = ", "window.state = ");

(async () => {
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    url: "https://example.org/artifact.html"
  });
  const { window } = dom;
  await new Promise(r => setTimeout(r, 300));

  const errors = [];
  const P = window;

  // 1. Init + overview render
  const grid = P.document.getElementById("overviewGrid");
  if (!grid || grid.children.length !== 9) errors.push("Overview grid did not render 9 cards, got: " + (grid && grid.children.length));

  // 2. Navigate through all 9 products
  Object.keys(P.state.products).forEach(pid => {
    try {
      P.showProduct(pid);
      const main = P.document.getElementById("main").innerHTML;
      const p = P.getProduct(pid);
      if (!main.includes(p.name)) errors.push(`Product ${pid}: name missing in render`);
      if (!main.includes("Key Risks")) errors.push(`Product ${pid}: Key Risks missing`);
    } catch (e) { errors.push(`Product ${pid} render threw: ${e.message}`); }
  });

  // 3. Edit: structured + freeform
  try {
    P.showEdit("P1");
    P.updateField("P1", "objective", "Lite-edited objective.");
    if (P.getProduct("P1").objective !== "Lite-edited objective.") errors.push("updateField did not persist");
    P.updateSleeveField("P1", 0, "weightRange", "30-50%");
    if (P.getProduct("P1").styleSleeves[0].weightRange !== "30-50%") errors.push("updateSleeveField did not persist");
  } catch (e) { errors.push("edit flow threw: " + e.message); }

  // 4. Risk list ops
  try {
    const before = P.getProduct("P1").keyRisks.length;
    P.addRisk("P1");
    if (P.getProduct("P1").keyRisks.length !== before + 1) errors.push("addRisk failed");
    P.removeRisk("P1", before);
    if (P.getProduct("P1").keyRisks.length !== before) errors.push("removeRisk failed");
  } catch (e) { errors.push("risk ops threw: " + e.message); }

  // 5. Publish + version + diff + revert
  try {
    global.window = P; // prompt/confirm stub needs global scope trick below instead
  } catch(e) {}
  P.window.prompt = () => "lite test note";
  P.window.confirm = () => true;
  try {
    P.publishProduct("P1");
    const entry = P.getEntry("P1");
    if (entry.versions.length !== 1) errors.push("publishProduct did not create v1");
    if (entry.status !== "published") errors.push("publishProduct did not set published status");

    P.updateField("P1", "objective", "Second lite revision.");
    P.publishProduct("P1");
    if (P.getEntry("P1").versions.length !== 2) errors.push("second publish did not create v2");

    P.showDiff("P1", 0, 1);
    const diffHtml = P.document.getElementById("diffContainer").innerHTML;
    if (!diffHtml.includes("diff-add") && !diffHtml.includes("diff-remove")) errors.push("diff view missing change markers");

    P.revertToVersion("P1", 0);
    if (P.getProduct("P1").objective !== "Lite-edited objective.") errors.push("revert did not restore v1 content");
    if (P.getEntry("P1").status !== "draft") errors.push("revert did not set draft status");
  } catch (e) { errors.push("publish/diff/revert flow threw: " + e.message); }

  // 6. Create from template
  try {
    const newId = P.createProductFromTemplate("P7", "Lite Test Product", "LTP");
    if (!P.state.products[newId]) errors.push("createProductFromTemplate failed");
    if (P.getProduct(newId).name !== "Lite Test Product") errors.push("new product name incorrect");
    P.showView("overview");
    if (!P.document.getElementById("overviewGrid").innerHTML.includes("LTP")) errors.push("new product not in overview");

    // 7. Archive / unarchive
    P.archiveProduct(newId);
    if (!P.getEntry(newId).archived) errors.push("archive flag not set");
    P.showView("overview");
    if (P.document.getElementById("overviewGrid").innerHTML.includes("LTP")) errors.push("archived product still shown in overview");
    P.showView("archive");
    if (!P.document.getElementById("archiveGrid").innerHTML.includes("LTP")) errors.push("archived product not shown in archive view");
    P.unarchiveProduct(newId);
    if (P.getEntry(newId).archived) errors.push("unarchive did not clear flag");
  } catch (e) { errors.push("create/archive flow threw: " + e.message); }

  // 8. About view
  try {
    P.showView("about");
    if (!P.document.getElementById("main").innerHTML.includes("About This Lite Version")) errors.push("about view missing");
  } catch (e) { errors.push("about view threw: " + e.message); }

  // 9. CSV/JSON export (stub Blob/URL/anchor click since jsdom doesn't fully implement download)
  try {
    let clickedHrefs = [];
    const origCreateElement = P.document.createElement.bind(P.document);
    P.document.createElement = function(tag) {
      const el = origCreateElement(tag);
      if (tag === "a") {
        const origClick = el.click ? el.click.bind(el) : () => {};
        el.click = function() { clickedHrefs.push(el.href); };
      }
      return el;
    };
    if (!P.URL.createObjectURL) P.URL.createObjectURL = () => "blob:mock";
    if (!P.URL.revokeObjectURL) P.URL.revokeObjectURL = () => {};
    P.downloadProductCsv("P2");
    P.downloadProductJson("P2");
    P.downloadAllCsv();
    if (clickedHrefs.length !== 3) errors.push("expected 3 download triggers, got " + clickedHrefs.length);
  } catch (e) { errors.push("CSV/JSON export threw: " + e.message); }

  // 10. localStorage persistence
  try {
    const raw = P.localStorage.getItem("vriksha_pns_lite_state_v1");
    if (!raw) errors.push("localStorage did not persist under lite key");
  } catch (e) { errors.push("localStorage check threw: " + e.message); }

  if (errors.length) {
    console.log("ARTIFACT SMOKETEST FAILED with " + errors.length + " issue(s):");
    errors.forEach(e => console.log(" - " + e));
    process.exitCode = 1;
  } else {
    console.log("ARTIFACT SMOKETEST PASSED: overview renders 9 products, navigation, structured+freeform edits, risk ops, publish/diff/revert, create-from-template, archive/unarchive, about view, CSV/JSON export triggers, localStorage persistence — all clean.");
    process.exitCode = 0;
  }
})().catch(e => { console.error("FATAL:", e.stack || e); process.exitCode = 1; });
