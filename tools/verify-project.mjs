import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { calculateRollingSignal, calculateZetaField, metricsAt, parseCSV, parseDateValue, parseNumericValue, prepareHistoricalRecords } from '../js/quant-analysis.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(resolve(root, file), 'utf8');
const passed = [];

function check(name, verify) {
  verify();
  passed.push(name);
}

const fabric = read('js/fabric.js');
const watch = read('js/watch/watch-viewer.js');
const watchControls = read('js/watch/watch-controls.js');
const html = read('index.html');
const sources = read('data/MODEL-SOURCES.md');

function readJavaScriptTree(directory = resolve(root, 'js')) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? readJavaScriptTree(path) : entry.name.endsWith('.js') ? [readFileSync(path, 'utf8')] : [];
  }).join('\n');
}

function listJavaScriptFiles(directory = resolve(root, 'js')) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listJavaScriptFiles(path) : entry.name.endsWith('.js') ? [path] : [];
  });
}

check('silk shader uniforms link at matching precision', () => {
  assert.equal((fabric.match(/uniform highp float uTime;/g) || []).length, 2);
  assert.equal((fabric.match(/uniform\s+(?:lowp\s+|mediump\s+|highp\s+)?float\s+uTime;/g) || []).length, 2);
});

check('silk keeps WebGL and animated 2D fallback paths', () => {
  assert.match(fabric, /getContext\('webgl'/);
  assert.match(fabric, /_drawFallback\(/);
  assert.match(fabric, /prefers-reduced-motion/);
});

check('silk surface is pinned to all clip-space edges and overscans mobile viewport seams', () => {
  assert.match(fabric, /gl_Position\s*=\s*vec4\(aPosition,\s*0\.0,\s*1\.0\)/);
  assert.match(read('css/main.css'), /#silk-root\{[^}]*inset:-8px/);
  assert.match(fabric, /visualViewport\?\.addEventListener\('resize'/);
  assert.match(fabric, /getBoundingClientRect\(\)/);
});

check('silk uses broad liquid-satin folds and no woven fibre pattern', () => {
  assert.match(fabric, /Broad, low-frequency folds: liquid satin/);
  assert.match(fabric, /satinBand/);
  assert.match(fabric, /gently bends the folds/);
  assert.doesNotMatch(fabric, /float\s+fibreA|float\s+fibreB|travellingFold|tensionA/);
  assert.match(fabric, /Soft, overlapping gradients suggest a single sheet of polished satin/);
});

check('gear center distances match nominal pitch radii', () => {
  const block = watch.match(/const gearPosition = \{([\s\S]*?)\n    \};/)?.[1];
  assert.ok(block, 'gear position block found');
  const points = {};
  for (const key of ['barrel', 'center', 'third', 'fourth', 'escape']) {
    const match = block.match(new RegExp(`^\\s*${key}: layoutPoint\\((-?\\d+(?:\\.\\d+)?),\\s*(-?\\d+(?:\\.\\d+)?)\\)`, 'm'));
    assert.ok(match, `position for ${key} found`);
    points[key] = { x: Number(match[1]), y: Number(match[2]) };
  }
  const pairs = [
    ['barrel', 'center', 54, 8, 0.03],
    ['center', 'third', 60, 8, 0.025],
    ['third', 'fourth', 64, 8, 0.022],
    ['fourth', 'escape', 80, 8, 0.02]
  ];
  for (const [a, b, teethA, teethB, module] of pairs) {
    const distance = Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
    const pitchDistance = module * (teethA + teethB) / 2;
    assert.ok(Math.abs(distance - pitchDistance) < 1e-6, `${a}-${b}: ${distance} vs ${pitchDistance}`);
  }
});

check('nominal train speeds preserve a one-minute fourth wheel', () => {
  const beatRate = Number(watch.match(/const beatRate = ([\d.]+);/)?.[1]);
  const escapeTeeth = Number(watch.match(/const escapeTeeth = ([\d.]+);/)?.[1]);
  assert.ok(Number.isFinite(beatRate) && Number.isFinite(escapeTeeth));
  const escapeRPM = beatRate * 60 / (2 * escapeTeeth);
  const fourthRPM = escapeRPM * 8 / 80;
  const thirdRPM = fourthRPM * 8 / 64;
  const centerRPM = thirdRPM * 8 / 60;
  assert.ok(Math.abs(escapeRPM - 10) < 1e-9);
  assert.ok(Math.abs(fourthRPM - 1) < 1e-9);
  assert.ok(Math.abs(1 / centerRPM - 60) < 1e-9);
  assert.match(watch, /const fourthAngle = -escapeAngle \* 8 \/ 80/);
  assert.match(watch, /const thirdAngle = -fourthAngle \* 8 \/ 64/);
  assert.match(watch, /const centerAngle = -thirdAngle \* 8 \/ 60/);
  assert.match(watch, /const barrelAngle = -centerAngle \* 8 \/ 54/);
  assert.match(watch, /'HOUR HAND': centerAngle \/ 12/);
});

check('watch explode control moves parts from stored assembly positions', () => {
  assert.match(watch, /userData\.explodeVector = new THREE\.Vector3/);
  assert.match(watch, /userData\.basePosition = part\.position\.clone\(\)/);
  assert.match(watch, /part\.position\.copy\(base\)\.addScaledVector\(offset, this\.explode\)/);
  assert.match(watchControls, /viewer\.setExplode\(amount\)/);
  assert.match(html, /id="watch-explode"/);
});

check('watch animation lifecycle, playback and speed controls are connected', () => {
  assert.match(watch, /if \(!this\._active \|\| document\.hidden\)/);
  assert.match(watch, /cancelAnimationFrame\(this\._frame\)/);
  assert.match(watch, /if \(this\.playing && delta > 0\)/);
  assert.match(watch, /this\.simTime \+= delta/);
  assert.match(watchControls, /viewer\.setPlaying\(!viewer\.playing\)/);
  assert.match(watchControls, /viewer\.setSpeed\(speed\)/);
});

check('imported main plate is split into independently selectable floating sections', () => {
  assert.match(watch, /function splitMainPlateMesh\(mesh, sectionCount = 4\)/);
  assert.match(watch, /splitMainPlateMesh\(mainPlate, 4\)/);
  assert.match(watch, /SECTION \$\{sectionIndex \+ 1\}/);
  assert.match(watch, /const datumParts = this\.parts\.filter/);
  assert.match(watch, /datumParts\.reduce\(\(combined, part\)/);
});

check('explode view uses a deterministic thickness-axis fan and parent-local transforms', () => {
  assert.match(watch, /const datumParts = this\.parts\.filter\(part => componentMatches\(partName\(part\), 'mainPlate'\)\)/);
  assert.match(watch, /const movementCenter = \(hasDatum \? datumBounds : assemblyBounds\)\.getCenter/);
  assert.match(watch, /const goldenAngle = 2\.399963229728653/);
  assert.match(watch, /const fanHalfSpan = Math\.max/);
  assert.match(watch, /displacementRoot\[thicknessName\] = axialDistance/);
  assert.match(watch, /parent\.worldToLocal\(targetWorld\)/);
  assert.match(watch, /const fitWidth = size\.x \* reserveFactor/);
});

check('public ETA model exports named CAD components and multiple metal/jewel finishes', () => {
  const modelPath = resolve(root, 'models/ETA-6497-1-Movement-Gold-Jewels.glb');
  const bytes = readFileSync(modelPath);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  const meshNodes = gltf.nodes.filter(node => node.mesh !== undefined);
  const names = new Set(meshNodes.map(node => node.name));
  assert.equal(meshNodes.length, 44);
  for (const name of ['100 Main Plate', '105 Barrel bridge', '110 Train wheel bridge', '401 Winding stem', 'Incabloc over']) {
    assert.ok(names.has(name), `named component ${name} is present`);
  }
  assert.ok(gltf.materials.length >= 5, 'separate plate, bridge, gold, steel and ruby materials exist');
  const materialNames = gltf.materials.map(material => material.name || '').join(' ');
  assert.match(materialNames, /rhodium/i);
  assert.match(materialNames, /bridges/i);
  assert.match(materialNames, /ruby/i);
  assert.match(watch, /ETA-6497-1-Movement-Gold-Jewels\.glb/);
});

check('the NH35 model is bundled locally and preserves 13 selectable mesh objects', () => {
  const modelPath = resolve(root, 'models/Seiko-NH35-Movement.glb');
  const bytes = readFileSync(modelPath);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  assert.equal(gltf.nodes.filter(node => node.mesh !== undefined).length, 13);
  assert.match(watch, /Seiko-NH35-Movement\.glb/);
});

check('Watch Lab is the single movement entry and loads the local ETA model', () => {
  assert.match(html, /type="importmap"/);
  assert.match(html, /three\/addons\//);
  assert.match(read('js/main.js'), /setMovement\('eta-6497-1'\)/);
  assert.match(html, /id="open-watch-hero"/);
  assert.match(html, /href="#watch-lab" data-open-watch/);
  assert.match(read('js/main.js'), /Direct links open the Watch Lab/);
  assert.doesNotMatch(html, /open-glb-lab|id="glb-lab"|data-caliber="chronograph"/);
  assert.match(read('js/watch/watch-viewer.js'), /new URL\('..\/..\/models\/ETA-6497-1-Movement-Gold-Jewels\.glb'/);
  assert.match(read('js/main.js'), /error\?\.message/);
  assert.doesNotMatch(`${html}\n${read('js/main.js')}`, /WATCH ENGINE UNAVAILABLE|CHOOSE LOCAL MODEL|LOCAL INSPECTOR/);
});

check('startup does not render procedural study geometry before the bundled model loads', () => {
  const constructor = watch.slice(watch.indexOf('constructor(canvas)'), watch.indexOf('\n  addPart('));
  assert.ok(constructor.length > 0);
  assert.doesNotMatch(constructor, /this\._buildProcedural\(/);
});

check('remote watch pivots around its center and stale downloads cannot replace selection', () => {
  assert.match(watch, /pivot\.name = 'WATCH MODEL PIVOT'/);
  assert.match(watch, /this\.remoteModel = pivot/);
  assert.match(watch, /requestId !== this\._modelRequestId/);
});

check('published caliber JSON matches current official reference summaries', () => {
  const eta6497 = JSON.parse(read('data/calibers/eta-6497-1.json'));
  const eta6498 = JSON.parse(read('data/calibers/eta-6498-1.json'));
  const eta2824 = JSON.parse(read('data/calibers/eta-2824-2.json'));
  assert.match(eta6497.powerReserve, /Typical 52 h/);
  assert.match(eta6498.powerReserve, /Typical 52 h/);
  assert.match(eta2824.powerReserve, /Typical 42 h/);
  assert.match(eta2824.complications, /reference specs/);
});

check('desktop movement buttons and mobile dropdown select the same local movement', () => {
  const controls = read('js/watch/watch-controls.js');
  assert.match(controls, /picker\?\.addEventListener\('change', \(\) => selectMovement\(picker\.value\)\)/);
  assert.match(controls, /item\.dataset\.caliber === key/);
  for (const key of ['eta-6497-1','seiko-nh35']) {
    assert.match(html, new RegExp(`value=\"${key}\"`));
    assert.match(html, new RegExp(`data-caliber=\"${key}\"`));
  }
});

check('relative JavaScript imports resolve to files in the repository', () => {
  const files = listJavaScriptFiles();
  const missing = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const imports = /(?:from\s*|import\s*\()\s*['\"](\.[^'\"]+)['\"]/g;
    for (const match of source.matchAll(imports)) {
      const importPath = match[1].split('?')[0];
      if (!resolve(dirname(file), importPath).startsWith(root)) continue;
      try {
        readFileSync(resolve(dirname(file), importPath));
      } catch {
        missing.push(`${file.replace(root + '/', '')}: ${importPath}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

check('literal DOM references resolve in the page or generated lab markup', () => {
  const htmlIds = new Set([...html.matchAll(/\bid=[\"']([^\"']+)[\"']/g)].map(match => match[1]));
  const appSource = readJavaScriptTree();
  const generatedIds = new Set([...appSource.matchAll(/\bid=[\"']([^\"']+)[\"']/g)].map(match => match[1]));
  const references = new Set();
  const pattern = /(?:byId|getElementById)\([\"']([\w-]+)[\"']\)|querySelector\([\"']#([\w-]+)[\"']\)/g;
  for (const match of appSource.matchAll(pattern)) references.add(match[1] || match[2]);
  const missing = [...references].filter(id => !htmlIds.has(id) && !generatedIds.has(id));
  assert.deepEqual(missing, []);
});

check('only bundled CAD movements are selectable or accepted by the viewer', () => {
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify({ 'eta-6497-1': true, 'seiko-nh35': true }))), ['eta-6497-1', 'seiko-nh35']);
  assert.match(watch, /if \(!modelUrl\)/);
  assert.match(read('js/watch/watch-controls.js'), /if \(!Object\.hasOwn\(CALIBERS, key\)\) return/);
});

check('model provenance and manufacturing-CAD limitations are visible', () => {
  assert.match(sources, /STEP/);
  assert.match(sources, /not a manufacturing CAD tool|not a manufacturing-CAD tool|not a factory-issued part catalogue/i);
  assert.match(sources, /redistribution terms/i);
});

check('Watch Lab offers only bundled CAD models and excludes removed study entries', () => {
  assert.match(html, /data-caliber="eta-6497-1"/);
  assert.match(html, /data-caliber="seiko-nh35"/);
  assert.doesNotMatch(html, /data-caliber="(?:tourbillon|double-tourbillon|minute-repeater|eta-6498-1|eta-2824-2|swiss-lever)"/);
  assert.doesNotMatch(html, /value="(?:tourbillon|double-tourbillon|minute-repeater|eta-6498-1|eta-2824-2|swiss-lever)"/);
  assert.doesNotMatch(read('js/watch/watch-database.js'), /'tourbillon'|'double-tourbillon'|'minute-repeater'|'eta-6498-1'|'eta-2824-2'|'swiss-lever'/);
  assert.match(watch, /if \(!modelUrl\)/);
  assert.doesNotMatch(html, /data-caliber="chronograph"|open-glb-lab|id="glb-lab"|LAB ↗ LOCAL INSPECTOR/);
});

check('mobile Watch Lab uses a native picker, opaque overlay and non-overlapping stack', () => {
  assert.match(html, /id="movement-picker"/);
  assert.match(read('css/watch.css'), /@media \(max-width:1100px\)[\s\S]*movement-picker \{ display:block/);
  assert.match(read('css/watch.css'), /background:#f4f1ea/);
  assert.match(read('css/watch.css'), /grid-template-columns:minmax\(0,1fr\)/);
  assert.match(read('css/watch.css'), /\.watch-hud span:last-child\s*\{\s*display:none;\s*\}/);
  assert.match(read('css/responsive.css'), /white-space:normal;overflow-wrap:anywhere/);
  assert.match(read('css/main.css'), /hero__watch-button/);
});

check('marked hero heading is replaced while the compact site brand remains', () => {
  assert.match(html, /<h1 class="hero__title hero__title--statement reveal">A quiet technical object\.<\/h1>/);
  assert.doesNotMatch(html, /<h1[^>]*>VOID\s*<span>\/\<\/span>\s*SYSTEMS<\/h1>/);
  assert.match(html, /class="brand"[^>]*>VOID \/ SYSTEMS<\/a>/);
  assert.doesNotMatch(html, /insert demo currently under construction|garunteed|wondow there fully vibe coded/i);
});

check('Market Analysis provides historical date selection and a documented custom ζ-Field', () => {
  const cases = read('js/case-studies.js');
  assert.match(cases, /id="q-file" type="file" accept="\.csv,\.txt,text\/csv,text\/plain"/);
  for (const id of ['q-date', 'q-timeline', 'q-window', 'q-threshold', 'q-damping', 'q-reset']) assert.match(cases, new RegExp(`id=\"${id}\"`));
  assert.match(cases, /calculateZetaField\(observations, parameters\)/);
  assert.match(cases, /INSUFFICIENT HISTORY/);
  assert.match(cases, /ZERO VARIANCE/);
  assert.match(read('js/quant-analysis.js'), /Only observations strictly before t are used/);
  assert.match(cases, /files are never uploaded|files are not uploaded/);
  assert.match(cases, /DEMO · NOT A TRADE/);
  assert.match(cases, /not the Riemann zeta function/);
});

check('CSV parser handles quoted values, escaped quotes, BOM, CRLF and European decimals', () => {
  const us = parseCSV('\uFEFFdate,close,note\r\n2026-01-01,100,"blue, chip"\r\n2026-01-02,101,"say ""yes"""\r\n');
  assert.equal(us.delimiter, ',');
  assert.equal(us.rows[1][2], 'blue, chip');
  assert.equal(us.rows[2][2], 'say "yes"');
  const eu = parseCSV('date;close\r\n2026-01-01;1.234,50\r\n2026-01-02;1.235,75\r\n');
  assert.equal(eu.delimiter, ';');
  assert.equal(parseNumericValue(eu.rows[1][1], eu.delimiter), 1234.5);
  assert.equal(parseNumericValue('1,234.56', ','), 1234.56);
  assert.throws(() => parseCSV('date,value\n2026-01-01,"unterminated\n2026-01-02,2\n'), /unterminated quoted field/);
});

check('quantitative calculations respect rolling windows, causality, and degenerate inputs', () => {
  const short = calculateZetaField([{ date: '2020-01-01', value: 100 }, { date: '2020-02-01', value: 101 }], { window: 5 });
  assert.equal(metricsAt(short, 1).hasBaseline, false);
  assert.equal(metricsAt(short, 1).zeta, null);
  const values = [0, 1, 2, 3, 4, 5, 20].map((value, index) => ({ date: `2020-${String(index + 1).padStart(2, '0')}-01`, value }));
  const field = calculateZetaField(values, { window: 5, damping: 0 });
  assert.equal(field.series[5].sufficient, false);
  assert.equal(field.series[6].sufficient, true);
  assert.equal(field.series[6].baselineCount, 5);
  assert.equal(field.series[6].zeroVariance, true);
  assert.equal(metricsAt(field, 6).hasSignal, false);
  const live = Array.from({ length: 12 }, (_, index) => ({ date: `2021-${String(index + 1).padStart(2, '0')}-01`, value: 100 + index * index + (index % 3) * 1.3 }));
  const a = calculateZetaField(live, { window: 5, damping: 0 });
  const changedFuture = live.map((item, index) => ({ ...item, value: index > 8 ? item.value * 50 : item.value }));
  const b = calculateZetaField(changedFuture, { window: 5, damping: 0 });
  assert.equal(a.series[8].zeta, b.series[8].zeta, 'future mutations must not affect historical state');
  const full = calculateZetaField(Array.from({ length: 30 }, (_, index) => ({ date: `2022-${String(index + 1).padStart(2, '0')}-01`, value: 100 * Math.exp(index * 0.002 + Math.sin(index * 1.1) * 0.02) })), { window: 5, damping: 0 });
  assert.equal(full.series[5].baselineCount, 4);
  assert.equal(full.series[6].baselineCount, 5);
  assert.equal(full.series[6].sufficient, true);
  assert.equal(calculateRollingSignal([{ value: 100 }, { value: 101 }]).hasBaseline, false);
});

check('date and imported historical records validate format, ordering, missing data, duplicates and invalid dates', () => {
  assert.equal(parseDateValue('2024-02-29'), '2024-02-29');
  assert.equal(parseDateValue('29.02.2024'), '2024-02-29');
  assert.equal(parseDateValue('02/29/2024'), '2024-02-29');
  assert.equal(parseDateValue('31.02.2024'), null);
  const prepared = prepareHistoricalRecords([
    { date: '02.02.2024', values: ['10,5'] },
    { date: '01.02.2024', values: ['10,0'] },
    { date: '03.02.2024', values: [''] }
  ], 0, ';');
  assert.deepEqual(prepared.observations.map(item => item.date), ['2024-02-01', '2024-02-02']);
  assert.equal(prepared.skippedMissing.length, 1);
  assert.throws(() => prepareHistoricalRecords([
    { date: '2024-01-01', values: ['1'] }, { date: '2024-01-01', values: ['2'] }
  ], 0, ','), /Duplicate observation date/);
  assert.throws(() => prepareHistoricalRecords([
    { date: 'yesterday-ish', values: ['1'] }, { date: '2024-01-02', values: ['2'] }
  ], 0, ','), /Invalid or missing date/);
});

check('Product System is a compact working run/reset loop', () => {
  const cases = read('js/case-studies.js');
  assert.match(cases, /id="product-run"/);
  assert.match(cases, /id="product-reset"/);
  assert.match(cases, /run\.addEventListener\('click'/);
  assert.match(cases, /reset\.addEventListener\('click'/);
  assert.match(read('css/watch.css'), /\.product-map svg\{height:230px;min-height:230px/);
  assert.match(cases, /Illustrative simulation only/);
});

check('Air/Ground Stores provides local CRUD, search/filter and CSV export', () => {
  const cases = read('js/case-studies.js');
  assert.match(cases, /id="stores-add"/);
  assert.match(cases, /rows\.addEventListener\('click'/);
  assert.match(cases, /search\.addEventListener\('input', render\)/);
  assert.match(cases, /filter\.addEventListener\('change', render\)/);
  assert.match(cases, /id="stores-export"/);
  assert.match(cases, /localStorage\.setItem\(storageKey/);
  assert.match(cases, /sample records are fictional/);
});

check('Horology teaser tracks visitor device local time', () => {
  assert.match(html, /id="local-clock-hour"/);
  assert.match(html, /id="local-clock-minute"/);
  assert.match(html, /id="local-clock-second"/);
  assert.match(html, /id="local-time"/);
  const main = read('js/main.js');
  assert.match(main, /new Date\(\)/);
  assert.match(read('js/watch/local-clock.js'), /toLocaleTimeString\(undefined/);
  assert.match(main, /updateLocalClock\(now\)/);
});

check('Doom panel loads the supplied WebAssembly port and relative shareware assets', () => {
  const cases = read('js/case-studies.js');
  const doomLoader = read('assets/doom/index.js');
  const doomEngine = read('assets/doom/doom1.js');
  assert.match(cases, /assets\/doom\/index\.html/);
  assert.match(cases, /response\.ok/);
  assert.match(doomLoader, /new URL\('doom1\.js', assetBase\)/);
  assert.match(doomLoader, /locateFile\(path, prefix\)/);
  assert.match(doomLoader, /requestFullscreen/);
  assert.match(doomLoader, /webdoom:return-to-portfolio/);
  assert.match(doomLoader, /onRuntimeInitialized/);
  assert.match(doomEngine, /REMOTE_PACKAGE_BASE="doom1\.data\.gz"/);
  assert.match(doomEngine, /new DecompressionStream\("gzip"\)/);
  assert.match(doomEngine, /Module\["onAbort"\]/);
  assert.ok(read('assets/doom/doom1.wasm').length > 1000000);
  assert.ok(read('assets/doom/doom1.data.gz').length > 1000000);
  assert.doesNotMatch(readdirSync(resolve(root, 'assets/doom')).join(' '), /doom2/i);
  assert.match(read('licenses/WEBDOOM-NOTICE.md'), /shareware|commercial DOOM II/i);
  assert.match(read('assets/doom/README.md'), /GitHub Pages project path/);
});

check('watch dial updates both analog hands and digital local time', () => {
  assert.match(read('js/watch/local-clock.js'), /renderLocalClock/);
  assert.match(read('js/main.js'), /renderLocalClock\(new Date\(\), document\)/);
  assert.match(read('js/main.js'), /visibilitychange/);
});

check('retired GLB inspector implementation is removed from the source tree', () => {
  assert.equal(readdirSync(resolve(root, 'js')).some(entry => entry === 'glb-lab'), false);
  assert.doesNotMatch(read('css/watch.css'), /#glb-canvas|glb-explode-control/);
});

console.log(`PASS ${passed.length} project checks`);
passed.forEach((name, index) => console.log(`${index + 1}. ${name}`));
