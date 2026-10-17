// Renders a static SVG map of every top-level workflow export in workflows/.
// Node positions, names, types and connections come straight from the JSON,
// so the map always matches what imports into n8n.
//
// Usage: node scripts/render-workflow-maps.mjs

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const workflowDir = path.join(root, "workflows");
const outDir = path.join(root, "assets", "workflow-maps");

const NODE = 64;
const PAD = 80;
const TITLE_H = 70;
const LEGEND_H = 56;

const CATEGORIES = {
  trigger: { label: "Trigger", fill: "#E7F8EF", stroke: "#2F9E6A", glyph: "▶" },
  logic: { label: "Logic / branching", fill: "#E8F4F8", stroke: "#2B8BA8", glyph: "⑂" },
  code: { label: "Code", fill: "#FFF1E6", stroke: "#D9822B", glyph: "{ }" },
  ai: { label: "AI model step", fill: "#F5EBFF", stroke: "#8B5CF6", glyph: "AI" },
  data: { label: "Airtable state", fill: "#E9F0FF", stroke: "#3E6FD8", glyph: "DB" },
  app: { label: "Business app", fill: "#FDECEF", stroke: "#D6456B", glyph: "APP" },
  flow: { label: "Sub-workflow call", fill: "#EEF0F3", stroke: "#5B6575", glyph: "↪" },
};

const GLYPHS = {
  airtable: "DB",
  httpRequest: "API",
  asana: "TASK",
  gmail: "MAIL",
  gmailTrigger: "MAIL",
  slack: "MSG",
  if: "IF",
  switch: "SW",
  chainLlm: "AI",
  lmChatOpenAi: "LLM",
  outputParserStructured: "JSON",
};

function category(type) {
  const short = type.split(".").pop();
  if (/trigger$/i.test(short) || short === "webhook") return "trigger";
  if (short === "if" || short === "switch") return "logic";
  if (short === "code") return "code";
  if (/llm|lmChat|outputParser|agent/i.test(short)) return "ai";
  if (short === "airtable") return "data";
  if (short === "executeWorkflow") return "flow";
  return "app";
}

const escape = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wrap(text, max = 18) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function render(workflow) {
  const nodes = workflow.nodes || [];
  const byName = new Map(nodes.map((node) => [node.name, node]));
  const xs = nodes.map((node) => node.position[0]);
  const ys = nodes.map((node) => node.position[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX + NODE + PAD * 2 + 60;
  const height = Math.max(...ys) - minY + NODE + PAD * 2 + TITLE_H + LEGEND_H + 40;
  const pos = (node) => ({
    x: node.position[0] - minX + PAD,
    y: node.position[1] - minY + PAD + TITLE_H,
  });

  const edges = [];
  for (const [source, groups] of Object.entries(workflow.connections || {})) {
    const from = byName.get(source);
    if (!from) continue;
    for (const [kind, outputs] of Object.entries(groups || {})) {
      (outputs || []).forEach((branch, index) => {
        for (const target of branch || []) {
          const to = byName.get(target.node);
          if (!to) continue;
          const a = pos(from);
          const b = pos(to);
          if (kind !== "main") {
            // AI sub-nodes attach below their parent chain node's label.
            const sx = a.x + NODE / 2;
            const sy = a.y;
            const tx = b.x + NODE / 2;
            const ty = b.y + NODE + 46;
            edges.push(
              `<path d="M${sx},${sy} C${sx},${sy - 60} ${tx},${ty + 60} ${tx},${ty}" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-dasharray="6 5"/>`,
            );
            continue;
          }
          const sx = a.x + NODE;
          const sy = a.y + NODE / 2;
          const tx = b.x;
          const ty = b.y + NODE / 2;
          const dx = Math.max(40, (tx - sx) / 2);
          edges.push(
            `<path d="M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx - 6},${ty}" fill="none" stroke="#9AA5B4" stroke-width="2"/>` +
              `<path d="M${tx - 8},${ty - 5} L${tx},${ty} L${tx - 8},${ty + 5} Z" fill="#9AA5B4"/>`,
          );
          const short = from.type.split(".").pop();
          if ((short === "if" || short === "switch") && outputs.length > 1) {
            const label = short === "if" ? (index === 0 ? "true" : "false") : `route ${index + 1}`;
            edges.push(
              `<text x="${sx + 8}" y="${sy + (index === 0 ? -8 : 18)}" font-size="12" fill="#5B6575">${label}</text>`,
            );
          }
        }
      });
    }
  }

  const used = new Set();
  const boxes = nodes.map((node) => {
    const { x, y } = pos(node);
    const cat = category(node.type);
    used.add(cat);
    const style = CATEGORIES[cat];
    const short = node.type.split(".").pop();
    const glyph = GLYPHS[short] || style.glyph;
    const label = wrap(node.name)
      .map((line, i) => `<tspan x="${x + NODE / 2}" dy="${i === 0 ? 0 : 16}">${escape(line)}</tspan>`)
      .join("");
    return (
      `<g>` +
      `<rect x="${x}" y="${y}" width="${NODE}" height="${NODE}" rx="14" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2.5"/>` +
      `<text x="${x + NODE / 2}" y="${y + NODE / 2 + 5}" text-anchor="middle" font-size="${glyph.length > 3 ? 12 : 15}" font-weight="700" fill="${style.stroke}">${escape(glyph)}</text>` +
      `<text x="${x + NODE / 2}" y="${y + NODE + 20}" text-anchor="middle" font-size="13" font-weight="600" fill="#1F2937">${label}</text>` +
      `</g>`
    );
  });

  let lx = PAD;
  const ly = height - LEGEND_H + 8;
  const legend = [...Object.keys(CATEGORIES)]
    .filter((key) => used.has(key))
    .map((key) => {
      const style = CATEGORIES[key];
      const item =
        `<rect x="${lx}" y="${ly}" width="18" height="18" rx="5" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2"/>` +
        `<text x="${lx + 26}" y="${ly + 14}" font-size="13" fill="#374151">${escape(style.label)}</text>`;
      lx += 56 + style.label.length * 7.5;
      return item;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Inter, -apple-system, Segoe UI, Helvetica, Arial, sans-serif">
<rect width="${width}" height="${height}" rx="18" fill="#FFFFFF"/>
<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="18" fill="none" stroke="#E2E8F0" stroke-width="2"/>
<text x="${PAD}" y="${PAD - 22}" font-size="24" font-weight="700" fill="#111827">${escape(workflow.name)}</text>
<text x="${PAD}" y="${PAD + 4}" font-size="14" fill="#6B7280">${nodes.length} nodes · generated from the exported n8n workflow JSON</text>
${edges.join("\n")}
${boxes.join("\n")}
${legend}
</svg>
`;
}

fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(workflowDir).filter((name) => name.endsWith(".json")).sort();
for (const file of files) {
  const workflow = JSON.parse(fs.readFileSync(path.join(workflowDir, file), "utf8"));
  const out = path.join(outDir, file.replace(/\.json$/, ".svg"));
  fs.writeFileSync(out, render(workflow));
  console.log(`wrote ${path.relative(root, out)}`);
}
