import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.join(__dirname, '..', 'tests');

const replacements = [
  [/role: 'admin'/g, "role: 'platform-super-admin'"],
  [/roles: \['admin'\]/g, "roles: ['platform-super-admin']"],
  [/role: 'admin'/g, "role: 'platform-super-admin'"],
  [/'admin'\)/g, "'platform-super-admin')"],
  [/canAccessBulkOperation\('horse-import', 'admin'\)/g, "canAccessBulkOperation('horse-import', 'platform-super-admin')"],
  [/listAccessibleEntityPickerKinds\('admin'\)/g, "listAccessibleEntityPickerKinds('platform-super-admin')"],
  [/veterinaryPrivacyScopesByRole\['racing-secretary'\]/g, "veterinaryPrivacyScopesByRole['horse-operations-coordinator']"],
  [/role: 'welfare-officer'/g, "role: 'equine-welfare-officer'"],
  [/role: 'racing-secretary'/g, "role: 'horse-operations-coordinator'"],
  [/roles: \['operations-admin'\]/g, "roles: ['organization-admin']"],
  [/roles: \['operations-admin',/g, "roles: ['organization-admin',"],
  [/role: 'operations-admin'/g, "role: 'organization-admin'"],
  [/role: 'admin',/g, "role: 'platform-super-admin',"],
];

for (const file of fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.mjs'))) {
  const fullPath = path.join(testsDir, file);
  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(fullPath, content);
    console.log('Updated', file);
  }
}
