import { spawn } from 'node:child_process';

const commands = [
  ['api', ['run', 'start:api']],
  ['frontend', ['run', 'start:frontend']],
];

const children = commands.map(([label, args]) => {
  const child = spawn('npm', args, {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[${label}] exited with ${signal ?? code}`);
    shutdown(code && code > 0 ? code : 1);
  });
  return child;
});

let shuttingDown = false;

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
