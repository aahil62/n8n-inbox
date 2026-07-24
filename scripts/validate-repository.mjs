import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const expectedWorkflows = ["p2-inbox-intake.json","p2-triage-draft-core.json","p2-review-task-handoff.json","p2-daily-operations-brief.json","p2-retention-health-sweep.json","shared-error-handler.json"];
const required = [
  "README.md",
  "SECURITY.md",
  "docs/architecture.md",
  "docs/data-contract.md",
  "docs/setup.md",
  "docs/test-plan.md",
  "docs/test-report.md",
  "docs/verification.md",
  
  ...expectedWorkflows.map((file) => `workflows/${file}`),
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

for (const file of expectedWorkflows) {
  const relative = `workflows/${file}`;
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

if (failures) {
  console.error(`Validation failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log(`Validation passed for n8n-ai-inbox-operations: ${expectedWorkflows.length} workflows and all fixtures.`);
