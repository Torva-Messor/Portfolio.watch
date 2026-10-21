import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['WebDOOM-source']);
const failures = [];
const notes = [];
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return ignoredDirectories.has(entry.name) ? [] : walk(path);
    return entry.isFile() ? [path] : [];
  });
}
const allFiles = walk(root);
const htmlFiles = allFiles.filter(file => extname(file).toLowerCase() === '.html');
const cssFiles = allFiles.filter(file => extname(file).toLowerCase() === '.css');
const jsFiles = allFiles.filter(file => extname(file).toLowerCase() === '.js' && !file.includes(`${sep}licenses${sep}`));
const external = url => /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url) || url.startsWith('//');
const localPath = (fromFile, url) => {
  const clean = decodeURIComponent(url.split('#')[0].split('?')[0].trim());
  if (!clean) return null;
  if (clean.startsWith('/')) {
    failures.push(`Root-absolute path breaks static subpath deployment: ${relative(fromFile)} → ${url}`);
    return null;
  }
  const target = resolve(fromFile ? resolve(fromFile, '..') : root, clean);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    failures.push(`Reference escapes project root: ${relative(fromFile)} → ${url}`);
    return null;
  }
  return target;
};
const relative = path => path ? path.slice(root.length + 1) : '.';
for (const file of htmlFiles) {
  const source = readFileSync(file, 'utf8');
  const ids = new Map();
  for (const match of source.matchAll(/(?<![-\w])id\s*=\s*(["'])(.*?)\1/g)) {
    const id = match[2];
    if (ids.has(id)) failures.push(`Duplicate static HTML id "${id}" in ${relative(file)} (offsets ${ids.get(id)} and ${match.index})`);
    else ids.set(id, match.index);
  }
  for (const match of source.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)) {
    const url = match[2].trim();
    if (external(url)) continue;
    const target = localPath(file, url);
    if (target && !existsSync(target)) failures.push(`Missing local HTML reference: ${relative(file)} → ${url}`);
  }
}
for (const file of cssFiles) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
    const url = match[2].trim();
    if (external(url) || url.startsWith('data:') || url.startsWith('var(')) continue;
    const target = localPath(file, url);
    if (target && !existsSync(target)) failures.push(`Missing local CSS URL: ${relative(file)} → ${url}`);
  }
}
for (const file of jsFiles) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g)) {
    const url = match[1] || match[2];
    if (!url || external(url) || !url.startsWith('.')) continue;
    const target = localPath(file, url);
    if (target && !existsSync(target)) failures.push(`Missing local JavaScript import: ${relative(file)} → ${url}`);
  }
}
if (failures.length) {
  console.error(`FAIL ${failures.length} asset/deployment reference issue(s)`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`PASS local references and duplicate IDs: ${htmlFiles.length} HTML files, ${cssFiles.length} stylesheets, ${jsFiles.length} JavaScript files scanned`);
}
