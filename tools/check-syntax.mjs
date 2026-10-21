import { readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const excludedDirectories = new Set(['WebDOOM-source']);
function filesWithin(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) return excludedDirectories.has(entry.name) ? [] : filesWithin(full);
    return entry.isFile() && entry.name.endsWith('.js') ? [full] : [];
  });
}
const files = [...filesWithin(resolve(root, 'js')), ...filesWithin(resolve(root, 'assets/doom')), ...filesWithin(resolve(root, 'tools')), ...filesWithin(resolve(root, 'tests'))].filter(file => !file.includes('/tests/browser-harness') && !file.includes('/tests/doom-harness'));
let failed = 0;
for (const file of [...new Set(files)].sort()) {
  if (!statSync(file).isFile()) continue;
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed++;
    console.error(`FAIL ${file.replace(`${root}/`, '')}\n${result.stderr || result.stdout}`);
  }
}
if (failed) process.exitCode = 1;
else console.log(`PASS JavaScript syntax in ${new Set(files).size} files`);
