import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
test('bundled Doom runtime is WebAssembly and contains shareware episode data only', () => {
  const wasm = readFileSync(resolve(root, 'assets/doom/doom1.wasm'));
  assert.equal(wasm.subarray(0, 4).toString('hex'), '0061736d');
  const zipped = readFileSync(resolve(root, 'assets/doom/doom1.data.gz'));
  const data = gunzipSync(zipped);
  assert.equal(data.length, 4477040);
  assert.equal(data.subarray(0, 4).toString('ascii'), 'PWAD');
  assert.equal(data.subarray(281020, 281024).toString('ascii'), 'IWAD');
  assert.ok(existsSync(resolve(root, 'licenses/WebDOOM-source/COPYING')));
  assert.ok(existsSync(resolve(root, 'licenses/WebDOOM-source/LICENSE')));
  assert.equal(existsSync(resolve(root, 'assets/doom/doom2.data')), false);
  assert.equal(existsSync(resolve(root, 'assets/doom/doom2.wasm')), false);
});
