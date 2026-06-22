import fs from 'node:fs';

let c = fs.readFileSync('src/apiContracts.ts', 'utf8');
c = c.replace(
  /method:'POST'([^\n]+)roles:\['platform-super-admin','horse-operations-coordinator','compliance-officer'\]/g,
  "method:'POST'$1roles:['platform-super-admin','horse-operations-coordinator']",
);
c = c.replace(
  /method:'POST'([^\n]+)roles:\['platform-super-admin','horse-operations-coordinator','compliance-officer','veterinarian'\]/g,
  "method:'POST'$1roles:['platform-super-admin','horse-operations-coordinator','veterinarian']",
);
fs.writeFileSync('src/apiContracts.ts', c);
console.log('Stripped compliance-officer from horse-registry POST mutations');
