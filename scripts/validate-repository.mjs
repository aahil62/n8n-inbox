import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const expectedWorkflows = ["workflows/p2-inbox-intake.json","workflows/p2-triage-draft-core.json","workflows/p2-review-task-handoff.json","workflows/p2-daily-operations-brief.json","workflows/p2-retention-health-sweep.json","workflows/shared-error-handler.json","workflows/e2e-reference/p2-e2e-00-test-harness.json","workflows/e2e-reference/p2-e2e-00-review-test-harness.json","workflows/e2e-reference/p2-e2e-01-gmail-adapter.json","workflows/e2e-reference/p2-e2e-01c-processor.json","workflows/e2e-reference/p2-e2e-02-triage-core.json","workflows/e2e-reference/p2-e2e-03-handoff.json","workflows/e2e-reference/p2-e2e-04-daily-brief.json","workflows/e2e-reference/p2-e2e-05-retention-health.json"];
const required = [
  "README.md",
  "SECURITY.md",
  "docs/architecture.md",
  "docs/data-contract.md",
  "docs/setup.md",
  "docs/test-plan.md",
  "docs/test-report.md",
  "docs/verification.md",
  
  ...expectedWorkflows,
];

let failures = 0;
const fail = (message) => {
  console.error("FAIL:", message);
  failures += 1;
};

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) fail(`missing ${relative}`);
}

const secretPattern = /(sk-[A-Za-z0-9]{16,}|Bearer\s+[A-Za-z0-9._-]{8,}|password\s*[:=]\s*["']?[^\s"']{6,}|api[_-]?key\s*[:=]\s*["']?[^\s"']{8,})/i;
const privateIdPattern = /(?:app|tbl|rec)[0-9A-Za-z]{14,}|\b\d{12,}\b/;

for (const relative of expectedWorkflows) {
  const full = path.join(root, relative);
  let raw;
  let workflow;
  try {
    raw = fs.readFileSync(full, "utf8");
    workflow = JSON.parse(raw);
  } catch (error) {
    fail(`${relative} does not parse: ${error.message}`);
    continue;
  }

  if (workflow.active !== false) fail(`${relative} is not inactive`);
  if (workflow.id || workflow.versionId) fail(`${relative} contains an account-specific workflow ID`);
  if (secretPattern.test(raw)) fail(`${relative} contains a secret-like value`);
  if (privateIdPattern.test(raw)) fail(`${relative} contains a known private resource ID`);

  const ids = new Set();
  const names = new Set();
  for (const node of workflow.nodes || []) {
    if (node.credentials) fail(`${relative} contains a credential block in ${node.name}`);
    if (ids.has(node.id)) fail(`${relative} has duplicate node ID ${node.id}`);
    if (names.has(node.name)) fail(`${relative} has duplicate node name ${node.name}`);
    ids.add(node.id);
    names.add(node.name);
  }

  for (const [source, outputGroups] of Object.entries(workflow.connections || {})) {
    if (!names.has(source)) fail(`${relative} connection source is missing: ${source}`);
    for (const outputs of Object.values(outputGroups || {})) {
      for (const branch of outputs || []) {
        for (const target of branch || []) {
          if (!names.has(target.node)) fail(`${relative} connection target is missing: ${target.node}`);
        }
      }
    }
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".json")) {
      try {
        JSON.parse(fs.readFileSync(full, "utf8"));
      } catch (error) {
        fail(`${path.relative(root, full)} does not parse: ${error.message}`);
      }
    }
  }
}

walk(path.join(root, "fixtures"));

const privateTextPattern = /(?:app|tbl|rec)[0-9A-Za-z]{14,}|\br-?\d{10,}\b|\b\d{12,}\b/;
const privateEmailPattern = /[A-Za-z0-9._%+-]+@(?:gmail|yahoo|hotmail|outlook)\.[A-Za-z]{2,}/i;
const textExtensions = new Set([".json", ".md", ".mjs", ".cjs", ".yml", ".yaml"]);
function scanPublicText(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scanPublicText(full);
    else if (textExtensions.has(path.extname(entry.name))) {
      const raw = fs.readFileSync(full, "utf8");
      if (secretPattern.test(raw)) fail(`${path.relative(root, full)} contains a secret-like value`);
      if (privateTextPattern.test(raw)) fail(`${path.relative(root, full)} contains a private identifier`);
      if (privateEmailPattern.test(raw)) fail(`${path.relative(root, full)} contains a private email address`);
    }
  }
}

scanPublicText(root);

if (failures) {
  console.error(`Validation failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log(`Validation passed for n8n-ai-inbox-operations: ${expectedWorkflows.length} workflows and all fixtures.`);
