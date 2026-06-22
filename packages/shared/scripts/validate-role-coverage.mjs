import { apiEndpointContracts, roles, legacyRoleAliases } from '../dist/index.js';

const canonical = new Set(roles);
const legacy = new Set(Object.keys(legacyRoleAliases));
let failed = false;

for (const contract of apiEndpointContracts) {
  if (contract.roles === 'authenticated') continue;
  for (const role of contract.roles) {
    if (!canonical.has(role)) {
      console.error(`Invalid role "${role}" on ${contract.method} ${contract.path}`);
      failed = true;
    }
    if (legacy.has(role)) {
      console.error(`Legacy role slug "${role}" on ${contract.method} ${contract.path} — use canonical slug`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Validated ${apiEndpointContracts.length} endpoint contracts against ${roles.length} canonical roles.`);
