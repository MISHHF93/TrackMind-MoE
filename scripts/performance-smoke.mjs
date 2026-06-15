import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { createApiFacadeState, handleApiRequest } from '../apps/api/dist/server.js';

const iterations = Number(process.env.TRACKMIND_PERF_ITERATIONS ?? 150);
const outputPath = resolve(process.env.TRACKMIND_PERF_OUTPUT ?? 'artifacts/backend-performance-smoke.csv');

const routes = [
  '/api/v1/health',
  '/api/v1/platform/health',
  '/api/v1/ai-governance/workspace',
  '/api/v1/ai-control-plane/workspace',
  '/api/v1/approvals/requests',
  '/api/v1/audit/events',
  '/api/v1/starting-gate/position',
  '/api/v1/race-operations/race-office',
  '/api/v1/digital-twin/state',
  '/api/v1/tus/data-model',
];

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index] ?? 0;
}

function csvEscape(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const state = createApiFacadeState();
const rows = [];

for (const route of routes) {
  const durations = [];
  let statusFailures = 0;
  const started = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    const requestStarted = performance.now();
    const response = await handleApiRequest('GET', `${route}?requestId=perf-${index}`, undefined, state);
    durations.push(performance.now() - requestStarted);
    if (response.status < 200 || response.status >= 300) {
      statusFailures += 1;
    }
  }

  const totalMs = performance.now() - started;
  const averageMs = durations.reduce((sum, value) => sum + value, 0) / durations.length;

  rows.push({
    route,
    iterations,
    statusFailures,
    totalMs: totalMs.toFixed(3),
    averageMs: averageMs.toFixed(3),
    p95Ms: percentile(durations, 0.95).toFixed(3),
    maxMs: Math.max(...durations).toFixed(3),
  });
}

const header = ['route', 'iterations', 'statusFailures', 'totalMs', 'averageMs', 'p95Ms', 'maxMs'];
const csv = [
  header.join(','),
  ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(',')),
].join('\n');

await mkdir(resolve('artifacts'), { recursive: true });
await writeFile(outputPath, `${csv}\n`);

console.log(`Wrote backend performance smoke results to ${outputPath}`);
for (const row of rows) {
  console.log(`${row.route} avg=${row.averageMs}ms p95=${row.p95Ms}ms failures=${row.statusFailures}`);
}
