import { readdirSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) walk(fullPath, out);
    else out.push(fullPath);
  }
  return out;
}

function expand(pattern) {
  if (!/[*?]/.test(pattern)) return [resolve(pattern)];

  const normalized = pattern.replaceAll('\\', '/');
  const wildcardIndex = normalized.search(/[*?]/);
  const slashBeforeWildcard = normalized.lastIndexOf('/', wildcardIndex);
  const baseDir = resolve(slashBeforeWildcard === -1 ? '.' : normalized.slice(0, slashBeforeWildcard));
  const suffix = slashBeforeWildcard === -1 ? normalized : normalized.slice(slashBeforeWildcard + 1);
  const extension = suffix.includes('*') ? extname(suffix.replaceAll('*', 'x')) : extname(suffix);
  const regex = new RegExp(`^${suffix.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.')}$`);

  return walk(baseDir)
    .filter((file) => (extension ? extname(file) === extension : true))
    .filter((file) => regex.test(file.split(sep).at(-1) ?? ''))
    .sort();
}

const files = process.argv.slice(2).flatMap(expand);

if (!files.length) {
  console.error('No test files matched.');
  process.exit(1);
}

let failures = 0;
for (const file of files) {
  const relative = file.replace(`${process.cwd()}${sep}`, '');
  console.log(`\n# Running ${relative}`);
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', file], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, TRACKMIND_SERIAL_TEST_FILE: relative },
  });
  if (result.status !== 0) failures += 1;
}

if (failures) {
  console.error(`\n${failures} test file(s) failed.`);
  process.exit(1);
}
