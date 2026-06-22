import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '../../../apps/api/src');

const replacements = [
  ["'admin'", "'platform-super-admin'"],
  ["'operations-admin'", "'organization-admin'"],
  ["'racing-secretary'", "'horse-operations-coordinator'"],
  ["'track-superintendent'", "'facilities-manager'"],
  ["'security'", "'security-manager'"],
  ["'finance'", "'finance-manager'"],
  ["'ticketing-manager'", "'ticketing-fan-manager'"],
  ["'welfare-officer'", "'equine-welfare-officer'"],
  ["'incident-commander'", "'race-day-operations-manager'"],
  ["'facilities-supervisor'", "'facilities-manager'"],
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') walk(full);
      continue;
    }
    if (!/\.(ts|tsx|mjs)$/.test(entry.name)) continue;
    let content = fs.readFileSync(full, 'utf8');
    let changed = false;
    for (const [from, to] of replacements) {
      if (content.includes(from)) {
        content = content.split(from).join(to);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(full, content);
      console.log('Updated', path.relative(apiRoot, full));
    }
  }
}

walk(apiRoot);
