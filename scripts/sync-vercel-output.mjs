import { cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const frontendDist = resolve(root, 'apps/frontend/dist');
const vercelDist = resolve(root, 'dist');

await rm(vercelDist, { recursive: true, force: true });
await cp(frontendDist, vercelDist, { recursive: true });

console.log('Synced Vercel output directory: dist');
