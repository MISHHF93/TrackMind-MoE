import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.resolve(__dirname, '../../../apps/api/tests');

const replacements = [
  ["roles: ['admin']", "roles: ['platform-super-admin']"],
  ["roles:['admin']", "roles:['platform-super-admin']"],
  ["roles: ['admin',", "roles: ['platform-super-admin',"],
  ["roles:['admin'],", "roles:['platform-super-admin'],"],
  ["roles: ['operations-admin']", "roles: ['organization-admin']"],
  ["roles:['operations-admin']", "roles:['organization-admin']"],
  ["role: 'operations-admin'", "role: 'organization-admin'"],
  ["roles: ['racing-secretary']", "roles: ['horse-operations-coordinator']"],
  ["roles:['racing-secretary']", "roles:['horse-operations-coordinator']"],
  ["roles: ['racing-secretary',", "roles: ['horse-operations-coordinator',"],
  ["human('secretary-1', ['racing-secretary'])", "human('secretary-1', ['horse-operations-coordinator'])"],
  ["roles: ['track-superintendent']", "roles: ['facilities-manager']"],
  ["roles:['track-superintendent']", "roles:['facilities-manager']"],
  ["const superintendent = { id:'super-1', roles:['track-superintendent']", "const superintendent = { id:'super-1', roles:['facilities-manager']"],
  ["roles: ['security']", "roles: ['security-manager']"],
  ["roles:['security']", "roles:['security-manager']"],
  ["roles: ['security',", "roles: ['security-manager',"],
  ["context('safety-lead', ['security'])", "context('safety-lead', ['security-manager'])"],
  ["const security = { actor: 'security-1', roles: ['security']", "const security = { actor: 'security-1', roles: ['security-manager']"],
  ["actor:{ id:'security-1', roles:['security']", "actor:{ id:'security-1', roles:['security-manager']"],
  ["roles: ['finance']", "roles: ['finance-manager']"],
  ["roles:['finance']", "roles:['finance-manager']"],
  ["context('finance-bot', ['finance'])", "context('finance-bot', ['finance-manager'])"],
  ["const finance = { actor: 'finance-1', roles: ['finance']", "const finance = { actor: 'finance-1', roles: ['finance-manager']"],
  ["roles: ['ticketing-manager']", "roles: ['ticketing-fan-manager']"],
  ["'welfare-officer'", "'equine-welfare-officer'"],
  ["'incident-commander'", "'race-day-operations-manager'"],
  ["['finance', 'steward']", "['finance-manager', 'steward']"],
  ["['steward', 'finance']", "['steward', 'finance-manager']"],
  ["['racing-secretary', 'track-superintendent']", "['horse-operations-coordinator', 'facilities-manager']"],
  ["['racing-secretary', 'track-superintendent', 'steward']", "['horse-operations-coordinator', 'facilities-manager', 'steward']"],
  ["['track-superintendent', 'steward']", "['facilities-manager', 'steward']"],
  ["requiredRoles: ['racing-secretary', 'track-superintendent', 'steward']", "requiredRoles: ['horse-operations-coordinator', 'facilities-manager', 'steward']"],
  ["requiredRoles: ['racing-secretary', 'track-superintendent']", "requiredRoles: ['horse-operations-coordinator', 'facilities-manager']"],
  ["const admin = { id:'admin-1', roles:['admin']", "const admin = { id:'platform-admin-1', roles:['platform-super-admin']"],
  ["actor:{ id:'admin-2', roles:['admin']", "actor:{ id:'platform-admin-2', roles:['platform-super-admin']"],
  ["const ai = { id: 'ai-race-agent', roles: ['admin']", "const ai = { id: 'ai-race-agent', roles: ['platform-super-admin']"],
  ["equineActor = { id:'race-office-1', roles:['racing-secretary']", "equineActor = { id:'race-office-1', roles:['horse-operations-coordinator']"],
  ["x-trackmind-role': 'admin'", "x-trackmind-role': 'platform-super-admin'"],
  ["x-trackmind-role': 'racing-secretary'", "x-trackmind-role': 'horse-operations-coordinator'"],
  ["x-trackmind-role': 'track-superintendent'", "x-trackmind-role': 'facilities-manager'"],
  ["x-trackmind-role': 'security'", "x-trackmind-role': 'security-manager'"],
  ["x-trackmind-role': 'finance'", "x-trackmind-role': 'finance-manager'"],
  ["x-trackmind-role': 'operations-admin'", "x-trackmind-role': 'organization-admin'"],
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!entry.name.endsWith('.test.mjs')) continue;
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
      console.log('Updated', path.relative(testsDir, full));
    }
  }
}

walk(testsDir);
