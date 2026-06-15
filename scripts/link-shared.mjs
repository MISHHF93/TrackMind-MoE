import { mkdir, rm, symlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scopeDir = resolve(repoRoot, 'node_modules', '@trackmind');
const linkPath = resolve(scopeDir, 'shared');
const targetPath = resolve(repoRoot, 'packages', 'shared');

await mkdir(scopeDir, { recursive: true });
await rm(linkPath, { recursive: true, force: true });
await symlink(targetPath, linkPath, process.platform === 'win32' ? 'junction' : 'dir');

console.log(`Linked ${linkPath} -> ${targetPath}`);
