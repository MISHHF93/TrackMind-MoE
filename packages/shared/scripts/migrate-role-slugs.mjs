import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const replacements = [
  ["'admin'", "'platform-super-admin'"],
  ["'operations-admin'", "'organization-admin'"],
  ["'racing-secretary'", "'horse-operations-coordinator'"],
  ["'track-superintendent'", "'facilities-manager'"],
  ["'security'", "'security-manager'"],
  ["'finance'", "'finance-manager'"],
  ["'ticketing-manager'", "'ticketing-fan-manager'"],
];

const files = [
  'src/apiContracts.ts',
  'src/dataEntryEntityRegistry.ts',
  'src/bulkDataEntry.ts',
  'src/horseDataEntry.ts',
  'src/racingOperatingModel.ts',
  'src/entityPicker.ts',
  'src/collaborationContracts.ts',
];

for (const file of files) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    console.warn('Skip missing', file);
    continue;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  for (const [from, to] of replacements) {
    content = content.split(from).join(to);
  }
  fs.writeFileSync(fullPath, content);
  console.log('Updated', file);
}
