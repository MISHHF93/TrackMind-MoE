import { buildDataEntryCoverageMatrix } from '../dist/index.js';

const dims = [
  'createFlow', 'editFlow', 'validation', 'draftSupport', 'auditSupport',
  'approvalSupport', 'kpiLinkage', 'searchability', 'rbac', 'tenantScoping',
  'mobileUsability', 'accessibility',
];

const matrix = buildDataEntryCoverageMatrix().map((row) => ({
  domain: row.domain,
  label: row.label,
  ...Object.fromEntries(dims.map((k) => [k, row.dimensions[k].level])),
}));

console.log(JSON.stringify(matrix, null, 2));
