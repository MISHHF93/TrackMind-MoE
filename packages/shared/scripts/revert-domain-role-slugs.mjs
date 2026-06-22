import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '../../../apps/api/src');

/** Revert domain identifiers that were incorrectly migrated from legacy role slugs. */
const domainReplacements = [
  ["seed('security-manager'", "seed('security'"],
  ["seed('finance-manager'", "seed('finance'"],
  ["k.domain === 'security-manager'", "k.domain === 'security'"],
  ["kpi.domain === 'security-manager'", "kpi.domain === 'security'"],
  ["pick('security-manager')", "pick('security')"],
  ["'security-anomaly': 'security-manager'", "'security-anomaly': 'security'"],
  ["return 'security-manager';", "return 'security';"],
  ["scorecard('security-manager'", "scorecard('security'"],
  ["| 'security-manager' |", "| 'security' |"],
  ["'security-manager' | 'fan-experience'", "'security' | 'fan-experience'"],
  ["includes(domain)) return 'physical'", "includes(domain)) return 'physical'"], // no-op anchor
  ["domains: ['surface', 'gate', 'race', 'horse', 'security-manager'", "domains: ['surface', 'gate', 'race', 'horse', 'security'"],
  ["domain: 'security-manager', title:", "domain: 'security', title:"],
  ["type: 'security-manager', tenantId:", "type: 'security', tenantId:"],
  ["domain: 'security-manager',", "domain: 'security',"],
  ["tags: ['security-manager',", "tags: ['security',"],
  ["service: 'security-manager'", "service: 'security'"],
  ["service: 'finance-manager'", "service: 'finance'"],
  ["'safety' | 'stewarding' | 'equine-intelligence' | 'security-manager' | 'finance-manager'", "'safety' | 'stewarding' | 'equine-intelligence' | 'security' | 'finance'"],
  ["linearWorkflow('security-incident', 'Security Incident Response', 'security-manager'", "linearWorkflow('security-incident', 'Security Incident Response', 'security'"],
  ["department: 'race-operations' | 'veterinary' | 'security-manager' | 'facilities'", "department: 'race-operations' | 'veterinary' | 'security' | 'facilities'"],
  ["'access'|'application'|'security-manager'|'frontend-error'", "'access'|'application'|'security'|'frontend-error'"],
  ["costCenter: 'security-manager'", "costCenter: 'security'"],
  ["['racing', 'surface', 'facilities', 'safety', 'security-manager']", "['racing', 'surface', 'facilities', 'safety', 'security']"],
  ["requiredDomains: ReadinessDomain[] = ['track','gate','staffing','veterinary','stewards','emergency','security-manager','weather','facility']", "requiredDomains: ReadinessDomain[] = ['track','gate','staffing','veterinary','stewards','emergency','security','weather','facility']"],
  ["runSimulationExercise('drill-weather-1', 'severe-weather', ['ops', 'security-manager', 'facilities'])", "runSimulationExercise('drill-weather-1', 'severe-weather', ['ops', 'security', 'facilities'])"],
  ["{ domain: 'security-manager', label: 'Security readiness'", "{ domain: 'security', label: 'Security readiness'"],
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    let content = fs.readFileSync(full, 'utf8');
    let changed = false;
    for (const [from, to] of domainReplacements) {
      if (content.includes(from)) {
        content = content.split(from).join(to);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(full, content);
      console.log('Reverted domains in', path.relative(apiRoot, full));
    }
  }
}

walk(apiRoot);
