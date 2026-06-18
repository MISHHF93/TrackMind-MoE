import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));

function repoRoot(): string {
  return process.env.TRACKMIND_REPO_ROOT ? resolve(process.env.TRACKMIND_REPO_ROOT) : resolve(moduleDir, '../../../../');
}

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(repoRoot(), 'config', 'platform-expansion', name), 'utf8')) as T;
}

export class NexusPlatformConfigRegistry {
  readonly marketplace = loadJson<{ categories: unknown[]; listings: unknown[] }>('marketplace-catalog.json');
  readonly whiteLabel = loadJson<{ defaults: Record<string, unknown>; configurableFields: string[] }>('white-label-defaults.json');
  readonly integrations = loadJson<{ connectors: unknown[] }>('integration-connectors.json');
  readonly reports = loadJson<{ templates: unknown[] }>('report-templates.json');
  readonly mobile = loadJson<{ workflows: unknown[] }>('mobile-workflows.json');
  readonly productionReadiness = loadJson<{ checks: Array<{ id: string; category: string; title: string; weight: number }> }>('production-readiness.json');
}
