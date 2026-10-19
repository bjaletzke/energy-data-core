// These values are authored for this demo; they do not describe real regions.
const start = Date.UTC(2026, 0, 1);
const regionColors = ["#2c6860", "#73a897", "#bbd2ba"];
const authoredValues = [
  [310, 295, 282, 275, 282, 310, 355, 402, 425, 420, 412, 405, 397, 390, 385, 399, 430, 465, 482, 463, 425, 390, 355, 330],
  [220, 208, 195, 190, 197, 220, 250, 279, 302, 310, 315, 307, 299, 292, 298, 310, 332, 355, 362, 350, 320, 290, 260, 238],
  [130, 122, 115, 0, 118, 132, 155, 175, 188, 192, 190, 185, 180, 184, 190, 202, 217, 235, 245, 232, 211, 185, 160, 142],
];
const svgNS = "http://www.w3.org/2000/svg";
const number = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
let aggregate;
let isPartial;

function element(name, attributes = {}, text) {
  const node = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function inputs(scenario) {
  return authoredValues.map((values, region) => values.map((value, hour) => ({
    ts: start + hour * 3_600_000,
    value: scenario === "gaps" && (hour === 17 || (region === 1 && hour >= 9 && hour <= 12)) ? null : value,
  })));
}

function drawChart(series, points, coverage, partial) {
  const chart = document.querySelector("#chart");
  chart.replaceChildren();
  chart.append(element("title", { id: "svg-title" }, "Synthetic hourly demand by region, in megawatts"));
  chart.append(element("desc", { id: "svg-desc" }, "Stacked bars show sums of available values. An amber outline marks partial coverage. A cross marks hours when all three regions are missing. The exact values and coverage are available in the table below."));
  const defs = element("defs");
  const pattern = element("pattern", { id: "partial-hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
  pattern.append(element("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "#986d2c", "stroke-width": 1.5, opacity: .36 }));
  defs.append(pattern);
  chart.append(defs);
  const left = 50;
  const right = 1020;
  const top = 32;
  const bottom = 292;
  const maximum = 1200;
  const y = value => bottom - value / maximum * (bottom - top);
  const step = (right - left) / 24;
  const barWidth = step * .65;
  chart.append(element("text", { x: left, y: 15, class: "axis-label" }, "MW"));
  for (let tick = 0; tick <= maximum; tick += 300) {
    chart.append(element("line", { x1: left, x2: right, y1: y(tick), y2: y(tick), class: "grid-line" }));
    chart.append(element("text", { x: left - 12, y: y(tick) + 3, "text-anchor": "end", class: "axis-label" }, number.format(tick)));
  }
  points.forEach((point, hour) => {
    const x = left + hour * step + (step - barWidth) / 2;
    const group = element("g");
    group.append(element("title", {}, `${String(hour).padStart(2, "0")}:00 UTC: ${point.value === null ? "no data" : `${number.format(point.value)} MW`}; ${coverage[hour].present} of 3 regions reported.`));
    let base = 0;
    series.forEach((region, index) => {
      const value = region[hour].value;
      if (value !== null && value > 0) {
        group.append(element("rect", { x, y: y(base + value), width: barWidth, height: y(base) - y(base + value), fill: regionColors[index] }));
        base += value;
      }
    });
    if (point.value === null) {
      group.append(element("rect", { x, y: top, width: barWidth, height: bottom - top, fill: "#f6f5ee", rx: 2 }));
      group.append(element("text", { x: x + barWidth / 2, y: bottom - 10, "text-anchor": "middle", fill: "#ac9a7e", "font-size": 17 }, "×"));
    } else if (partial[hour]) {
      group.append(element("rect", { x: x - 1.5, y: y(base) - 1.5, width: barWidth + 3, height: bottom - y(base) + 1.5, fill: "url(#partial-hatch)", stroke: "#a8752f", "stroke-width": 1.5, rx: 1 }));
    }
    chart.append(group);
    if (hour % 3 === 0 || hour === 23) chart.append(element("text", { x: x + barWidth / 2, y: bottom + 22, class: "axis-label", "text-anchor": "middle" }, `${String(hour).padStart(2, "0")}:00`));
  });
  chart.append(element("text", { x: right, y: bottom + 43, class: "axis-label", "text-anchor": "end" }, "Hour / UTC"));
}

function drawTable(series, points, coverage, partial) {
  const body = document.querySelector("#data-rows");
  body.replaceChildren();
  points.forEach((point, hour) => {
    const row = document.createElement("tr");
    if (point.value === null) row.className = "no-data-row";
    else if (partial[hour]) row.className = "partial-row";
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = `${String(hour).padStart(2, "0")}:00`;
    row.append(label);
    for (const value of [...series.map(region => region[hour].value), point.value]) {
      const cell = document.createElement("td");
      cell.textContent = value === null ? "Missing" : number.format(value);
      if (value === null) cell.className = "missing";
      row.append(cell);
    }
    const count = coverage[hour];
    const status = document.createElement("td");
    status.textContent = `${count.present} / ${count.of} · ${count.present === 0 ? "No data" : partial[hour] ? "Partial" : "Complete"}`;
    row.append(status);
    body.append(row);
  });
}

function render(scenario) {
  const series = inputs(scenario);
  const { points, coverage } = aggregate(series);
  // A threshold of 1 means all three regions are required for complete coverage.
  const partial = isPartial(coverage, 1);
  document.querySelector("#complete-count").textContent = `${coverage.filter(c => c.present === c.of).length} / 24`;
  document.querySelector("#partial-count").textContent = String(coverage.filter(c => c.present > 0 && c.present < c.of).length);
  document.querySelector("#missing-count").textContent = String(coverage.filter(c => c.present === 0).length);
  document.querySelector("#scenario-note").textContent = scenario === "gaps"
    ? "Region B is missing from 09:00–12:00 UTC, so those four sums are partial. All regions are missing at 17:00 UTC, so the result is null. Region C reports a real zero at 03:00 UTC; coverage still includes it."
    : "All three regions report at every hour. Region C reports a real zero at 03:00 UTC. That zero contributes to the sum and counts as a reported observation.";
  for (const button of document.querySelectorAll("[data-scenario]")) button.setAttribute("aria-pressed", String(button.dataset.scenario === scenario));
  drawChart(series, points, coverage, partial);
  drawTable(series, points, coverage, partial);
}

async function initialize() {
  try {
    const { entsoe } = await import("/dist/index.js");
    aggregate = entsoe.sumPoints;
    isPartial = entsoe.partialAbove;
    render("gaps");
    for (const button of document.querySelectorAll("[data-scenario]")) button.addEventListener("click", () => render(button.dataset.scenario));
  } catch (error) {
    const message = document.querySelector("#load-error");
    message.hidden = false;
    message.textContent = "The library could not load. Build the package, then serve this repository over HTTP using its demo command. Check your browser console for details.";
    for (const button of document.querySelectorAll("[data-scenario]")) button.disabled = true;
    console.error("Energy Data Core demo failed to load:", error);
  }
}

initialize();
