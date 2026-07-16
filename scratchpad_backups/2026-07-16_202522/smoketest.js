const { JSDOM } = require("/tmp/node_modules/jsdom");
const fs = require("fs");

let html = fs.readFileSync("/sessions/sleepy-practical-meitner/mnt/outputs/portfolio_dashboard.html", "utf8");
html = html.replace(/<script src="https:\/\/cdnjs[^"]*"><\/script>\s*/g, "");
// Expose the top-level `const PRODUCTS` onto window so the test harness can reach it
// (const/let declarations at script scope don't auto-attach to window like var/functions do).
html = html.replace("const PRODUCTS = [", "window.PRODUCTS = [");
html = html.replace(/\bPRODUCTS\b/g, "window.PRODUCTS").replace("window.window.PRODUCTS = [", "window.PRODUCTS = [");
html = html.replace("let uploadedConstituents = {};", "window.uploadedConstituents = {};");
html = html.replace(/\buploadedConstituents\b/g, "window.uploadedConstituents").replace("window.window.uploadedConstituents", "window.uploadedConstituents");

(async () => {
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    url: "https://example.org/dashboard.html",
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
    }
  });

  const { window } = dom;
  await new Promise((r) => setTimeout(r, 300));

  const errors = [];
  const PRODUCTS = window.PRODUCTS;

  if (!PRODUCTS || PRODUCTS.length !== 9) {
    errors.push("PRODUCTS not loaded correctly: " + (PRODUCTS && PRODUCTS.length));
  }

  const navList = window.document.getElementById("navList");
  if (!navList || navList.children.length === 0) errors.push("Nav list did not render");

  const grid = window.document.getElementById("overviewGrid");
  if (!grid || grid.children.length !== 9) {
    errors.push("Overview grid did not render 9 cards, got: " + (grid && grid.children.length));
  }

  for (const p of PRODUCTS) {
    try {
      window.showProduct(p.id);
      const main = window.document.getElementById("main").innerHTML;
      if (!main.includes(p.name)) errors.push(`Product ${p.id}: name not found in rendered HTML`);
      if (!main.includes("Key Risks")) errors.push(`Product ${p.id}: Key Risks section missing`);
      if (!main.includes("Suitability")) errors.push(`Product ${p.id}: Suitability section missing`);
      if (p.variants && !main.includes("Risk-Profile Variants")) errors.push(`Product ${p.id}: variants present in data but not rendered`);
      if (p.goalFramework && !main.includes("Life Goal Framework")) errors.push(`Product ${p.id}: goalFramework present in data but not rendered`);
    } catch (e) {
      errors.push(`Product ${p.id} render threw: ${e.message}`);
    }
  }

  try {
    window.showProduct("P3");
    window.switchVariant("P3", 1);
    const panel0 = window.document.getElementById("vpanel-P3-0");
    const panel1 = window.document.getElementById("vpanel-P3-1");
    if (panel0.style.display !== "none") errors.push("switchVariant did not hide panel 0");
    if (panel1.style.display !== "block") errors.push("switchVariant did not show panel 1");
  } catch (e) {
    errors.push("switchVariant threw: " + e.message);
  }

  try {
    window.showView("csv");
    const dz = window.document.getElementById("dropZone");
    if (!dz) errors.push("CSV dropzone did not render");
  } catch (e) {
    errors.push("CSV view threw: " + e.message);
  }

  try {
    window.showView("csv");
    window.document.getElementById("csvProductSelect").value = "P1";
    const fakeResults = {
      data: [
        { symbol: "TITAN", name: "Titan Company", weight: "12.5" },
        { symbol: "DIVISLAB", name: "Divi's Laboratories", weight: "10" },
        { symbol: "COALINDIA", name: "Coal India", weight: "9.5" }
      ]
    };
    window.Papa.parse = (file, opts) => opts.complete(fakeResults);
    window.handleCsvFile({ name: "test.csv" });
    if (!window.uploadedConstituents["P1"] || window.uploadedConstituents["P1"].length !== 3) {
      errors.push("CSV upload did not populate uploadedConstituents correctly");
    }
    const resultHtml = window.document.getElementById("csvResult").innerHTML;
    if (!resultHtml.includes("TITAN")) errors.push("CSV parsed rows not rendered in result table");
  } catch (e) {
    errors.push("CSV upload simulation threw: " + e.message);
  }

  try {
    window.showView("roadmap");
    if (!window.document.getElementById("main").innerHTML.includes("Upgrade Roadmap")) {
      errors.push("Roadmap view content missing");
    }
  } catch (e) {
    errors.push("Roadmap view threw: " + e.message);
  }

  for (const p of PRODUCTS) {
    try {
      window.exportXlsx(p.id);
      if (!window.__lastXlsx || !window.__lastXlsx.name.includes(p.code)) {
        errors.push(`exportXlsx(${p.id}) did not produce expected filename`);
      }
    } catch (e) {
      errors.push(`exportXlsx(${p.id}) threw: ${e.message}`);
    }
  }

  try {
    window.exportAllXlsx();
    if (!window.__lastXlsx || !window.__lastXlsx.name.includes("All9")) {
      errors.push("exportAllXlsx did not produce expected filename");
    }
  } catch (e) {
    errors.push("exportAllXlsx threw: " + e.message);
  }

  for (const p of PRODUCTS) {
    try {
      await window.exportDocx(p.id);
    } catch (e) {
      errors.push(`exportDocx(${p.id}) threw: ${e.message}`);
    }
  }
  await new Promise((r) => setTimeout(r, 100));
  if (!window.__lastSavedFile) errors.push("exportDocx never called saveAs");

  if (errors.length) {
    console.log("SMOKETEST FAILED with " + errors.length + " issue(s):");
    errors.forEach((e) => console.log(" - " + e));
    process.exitCode = 1;
  } else {
    console.log("SMOKETEST PASSED: all 9 products render, variant tabs switch, CSV upload populates + renders, roadmap/overview views render, XLSX export (all 9 + combined) and DOCX export (all 9) run without throwing.");
    process.exitCode = 0;
  }
})().catch((e) => {
  console.error("FATAL:", e);
  process.exitCode = 1;
});
