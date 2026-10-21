import { calculateZetaField, metricsAt, parseCSV, parseNumericValue, prepareHistoricalRecords } from './quant-analysis.js';

const modal = document.querySelector('#lab-modal');
const content = document.querySelector('#lab-content');
const code = document.querySelector('#lab-code');
let cleanup = () => {};

const roles = {
  rom: {
    code: 'LAB / 001 · ROM',
    title: 'DOCK OF DOOM',
    copy: 'The original PrBoom-derived WebDOOM runtime runs in-browser through WebAssembly. This integration includes the redistributable shareware episode and omits commercial DOOM II game data.',
    meta: [
      ['MEDIUM', 'LOCAL WEB BUILD'],
      ['INPUT', 'KEYBOARD / POINTER'],
      ['STATE', 'LOCAL WASM RUNTIME'],
      ['FOCUS', 'BROWSER INTEGRATION']
    ]
  },
  quant: {
    code: 'LAB / 002 · QUANT',
    title: 'MARKET ANALYSIS',
    copy: 'A local quantitative research surface. Import a CSV of real historical observations to inspect rolling returns and normalized deviations; generated values are labeled as demonstration data only.',
    meta: [
      ['INPUT', 'LOCAL CSV / SERIES'],
      ['WINDOW', 'ROLLING RETURNS'],
      ['OUTPUT', 'Z-SCORE / THRESHOLD'],
      ['STATUS', 'RESEARCH / NOT ADVICE']
    ]
  },
  founder: {
    code: 'LAB / 003 · STARTUP',
    title: 'PRODUCT SYSTEM',
    copy: 'A compact interactive product loop. Run an iteration to move through observation, experiment, evidence and decision; reset the model at any point. The simulation is illustrative, not production telemetry.',
    meta: [
      ['LOOP', 'USER → PRODUCT → DATA'],
      ['FOCUS', 'DECISION LATENCY'],
      ['STATE', 'ITERATING'],
      ['BIAS', 'SMALL / TESTABLE']
    ]
  },
  consulting: {
    code: 'LAB / 004 · IT',
    title: 'INFRA LAB',
    copy: 'An infrastructure instrument for tracing dependencies, failure domains and recovery paths. The useful question is not “what is the server?” but “what happens when one part disappears?”.',
    meta: [
      ['SCOPE', 'NETWORK / HOST / SERVICE'],
      ['MODE', 'FAULT INJECTION'],
      ['RECOVERY', 'DEGRADED → RESTORED'],
      ['FOCUS', 'RELIABILITY']
    ]
  },
  dpls: {
    code: 'LAB / 005 · ARCHIVE',
    title: 'DPLS / LEGACY',
    copy: 'A local-first concept for tracking assets across Air and Ground stores. Add and remove sample items, filter inventory, and export a CSV. Records stay in this browser until connected to a real backend.',
    meta: [
      ['DOMAIN', 'AIR / GROUND STORES'],
      ['MODE', 'LOCAL INVENTORY DEMO'],
      ['FOCUS', 'LOCATION / QUANTITY'],
      ['STATUS', 'BROWSER-LOCAL']
    ]
  }
};

function shell(role) {
  const metadata = role.meta
    .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
    .join('');

  return `
    <div class="instrument-grid">
      <div class="instrument-copy">
        <span class="eyebrow">${role.code}</span>
        <h2>${role.title}</h2>
        <p>${role.copy}</p>
        <div class="instrument-meta">${metadata}</div>
      </div>
      <div id="instrument-stage"></div>
    </div>`;
}

const instruments = {
  rom,
  quant,
  founder,
  consulting,
  dpls
};

function open(kind) {
  const selected = roles[kind] ? kind : 'consulting';
  const role = roles[selected];

  cleanup();
  code.textContent = role.code;
  content.innerHTML = shell(role);
  cleanup = instruments[selected]();
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-locked');
}

function close() {
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('is-locked');
  cleanup();
  cleanup = () => {};
}

function rom() {
  const stage = document.querySelector('#instrument-stage');
  stage.innerHTML = `
    <div class="doom-shell">
      <div class="instrument-canvas doom-screen" id="doom-screen">
        <div class="instrument-hud"><span>DOOM / WEBASSEMBLY</span><span id="doom-status">CHECKING LOCAL RUNTIME</span></div>
        <div class="doom-missing" id="doom-missing">
          <span class="doom-mark">DOOM</span>
          <strong>CHECKING GAME RUNTIME</strong>
          <p>The embedded PrBoom-derived WebAssembly build should load from this project’s relative asset path. Initialization failures are shown here rather than replaced by a fake game.</p>
          <button type="button" class="line-button" id="doom-retry">RETRY LOCAL RUNTIME →</button>
          <small>Runtime: <code>assets/doom/</code> · shareware episode only</small>
        </div>
      </div>
      <p class="quant-note">The bundled browser build uses the original WebDOOM / PrBoom runtime. Commercial DOOM II game data and separately sourced soundtrack/effects are not bundled. WebGL, WebAssembly and gzip decompression are required; the first game initialization loads local engine assets.</p>
    </div>`;

  const screen = stage.querySelector('#doom-screen');
  const missing = stage.querySelector('#doom-missing');
  const status = stage.querySelector('#doom-status');
  const retry = stage.querySelector('#doom-retry');
  let iframe = null;
  let requestToken = 0;
  async function checkBuild() {
    const token = ++requestToken;
    status.textContent = 'CHECKING FILES';
    retry.disabled = true;
    try {
      const buildUrl = new URL('./assets/doom/index.html', document.baseURI);
      const response = await fetch(buildUrl, { method: 'GET', cache: 'no-store' });
      if (token !== requestToken) return;
      if (!response.ok) throw new Error('No local build');
      iframe = document.createElement('iframe');
      iframe.title = 'Playable Doom web build';
      iframe.src = buildUrl.href;
      iframe.loading = 'eager';
      iframe.allow = 'fullscreen; gamepad; autoplay';
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-downloads');
      iframe.className = 'doom-frame';
      screen.append(iframe);
      missing.hidden = true;
      status.textContent = 'LOCAL RUNTIME FOUND';
    } catch {
      status.textContent = 'BUILD MISSING';
      missing.hidden = false;
    } finally {
      retry.disabled = false;
    }
  }
  const onDoomMessage = event => {
    if (event.source !== iframe?.contentWindow || event.origin !== window.location.origin) return;
    if (event.data?.type === 'webdoom:return-to-portfolio') close();
    if (event.data?.type === 'webdoom:ready') status.textContent = 'RUNTIME PAGE READY';
    if (event.data?.type === 'webdoom:runtime-running') status.textContent = 'ENGINE RUNNING';
    if (event.data?.type === 'webdoom:runtime-error') status.textContent = 'ENGINE ERROR';
  };
  window.addEventListener('message', onDoomMessage);
  retry.addEventListener('click', () => { iframe?.remove(); iframe = null; checkBuild(); });
  checkBuild();
  return () => {
    window.removeEventListener('message', onDoomMessage);
    requestToken++;
    iframe?.setAttribute('src', 'about:blank');
    iframe?.remove();
  };
}

function quant() {
  const stage = document.querySelector('#instrument-stage');
  stage.innerHTML = `
    <div class="quant-lab">
      <div class="instrument-canvas quant-canvas-box">
        <canvas id="quant-canvas" role="img" aria-label="Historical reference series and illustrative zeta field over time" aria-describedby="q-note"></canvas>
        <div class="instrument-hud">
          <span id="q-series-label">SYNTHETIC DEMO SERIES</span>
          <span id="signal-status" aria-live="polite">DEMO · NOT A TRADE</span>
        </div>
      </div>
      <div class="quant-legend" aria-hidden="true"><span><i class="quant-legend__reference"></i>REFERENCE SERIES · SOURCE UNITS</span><span><i class="quant-legend__zeta"></i>ζ-FIELD · SMOOTHED Z</span></div>
      <div class="quant-date-controls">
        <label class="param quant-date-picker"><span>SELECT DATE</span><input id="q-date" type="date" aria-label="Select historical observation date"></label>
        <label class="param quant-timeline"><span>HISTORY / INDEX</span><input id="q-timeline" type="range" min="0" max="299" step="1" value="299" aria-label="Move through historical observations"><output id="q-timeline-o">300 / 300</output></label>
        <output id="q-date-label" class="quant-selected-date" aria-live="polite">2000-01-31</output>
      </div>
      <div class="quant-stats" aria-live="polite">
        <div><span>SELECTED VALUE</span><strong id="q-last-value">—</strong></div>
        <div><span>CHANGE / RETURN</span><strong id="q-last-return">—</strong></div>
        <div><span>ζ-FIELD</span><strong id="q-z-score">—</strong></div>
        <div><span>PRIOR BASELINE</span><strong id="q-count">—</strong></div>
      </div>
      <div class="signal-controls">
        <label class="param param--file"><span>IMPORT CSV</span><input id="q-file" type="file" accept=".csv,.txt,text/csv,text/plain"><output id="q-file-state">SYNTHETIC DEMO</output></label>
        <label class="param"><span>VALUE COLUMN</span><select id="q-column" aria-label="CSV value column"><option value="demo">Synthetic demo</option></select></label>
        <label class="param"><span>ANALYSIS WINDOW</span><input id="q-window" type="range" min="5" max="60" value="20"><output id="q-window-o">20</output></label>
        <label class="param"><span>ζ THRESHOLD</span><input id="q-threshold" type="range" min="0.5" max="3" step="0.05" value="1.5"><output id="q-threshold-o">1.50</output></label>
        <label class="param"><span>FIELD MEMORY (λ)</span><input id="q-damping" type="range" min="0" max="0.9" step="0.05" value="0.25"><output id="q-damping-o">0.25</output></label>
        <p class="quant-note" id="q-note">Synthetic monthly observations are generated for demonstration and are not market data. Import a dated CSV to analyze your own series locally; no file is uploaded.</p>
        <button type="button" class="line-button" id="q-reset">RESET TO DEMO SERIES →</button>
      </div>
    </div>`;

  const canvas = stage.querySelector('#quant-canvas');
  const box = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const status = stage.querySelector('#signal-status');
  const seriesLabel = stage.querySelector('#q-series-label');
  const note = stage.querySelector('#q-note');
  const fileState = stage.querySelector('#q-file-state');
  const columnSelect = stage.querySelector('#q-column');
  const dateInput = stage.querySelector('#q-date');
  const timeline = stage.querySelector('#q-timeline');
  const timelineOutput = stage.querySelector('#q-timeline-o');
  const dateLabel = stage.querySelector('#q-date-label');
  const parameters = { window: 20, threshold: 1.5, damping: 0.25 };
  const controls = ['window', 'threshold', 'damping'];
  const demoSeries = Array.from({ length: 300 }, (_, index) => {
    const year = 2000 + Math.floor(index / 12);
    const month = index % 12 + 1;
    const date = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const value = 100 * Math.exp(
      0.00025 * index
      + 0.07 * Math.sin(index * 0.071)
      + 0.09 * Math.sin(index * 0.021)
      + 0.006 * Math.sin(index * 0.39)
    );
    return { date, value };
  });
  let observations = demoSeries;
  let field = calculateZetaField(observations, parameters);
  let imported = null;
  let selectedIndex = observations.length - 1;
  let resizeObserver = null;

  function updateTimelineBounds() {
    timeline.min = '0';
    timeline.max = String(Math.max(0, observations.length - 1));
    timeline.value = String(selectedIndex);
    timeline.setAttribute('aria-valuetext', observations[selectedIndex]?.date || 'No observation selected');
    timelineOutput.value = `${selectedIndex + 1} / ${observations.length}`;
    dateInput.min = observations[0]?.date || '';
    dateInput.max = observations.at(-1)?.date || '';
    dateInput.value = observations[selectedIndex]?.date || '';
    dateLabel.value = observations[selectedIndex]?.date || '—';
    dateLabel.textContent = observations[selectedIndex]?.date || '—';
  }

  function refreshField() {
    field = calculateZetaField(observations, parameters);
    updateTimelineBounds();
    draw();
  }

  function loadColumn(index) {
    if (!imported || !Number.isInteger(index)) return;
    try {
      const normalized = prepareHistoricalRecords(imported.records, index, imported.delimiter);
      observations = normalized.observations;
      selectedIndex = observations.length - 1;
      const name = imported.headers[index] || `Column ${index + 1}`;
      seriesLabel.textContent = `CSV / ${name.slice(0, 34)}`;
      fileState.textContent = `${observations.length} OBS`;
      const missingNote = normalized.skippedMissing.length
        ? ` ${normalized.skippedMissing.length} row(s) with missing/non-numeric values were skipped.` : '';
      note.textContent = `${imported.fileName} · ${name} · ${observations.length} dated observations.${missingNote} Source values retain their original units; positive-only series use log returns, otherwise raw differences. CSV remains in this browser. ζ is a provisional custom indicator, not the Riemann zeta function.`;
      refreshField();
    } catch (error) {
      note.textContent = `${error?.message || 'Could not validate this column.'} The synthetic demo remains available; select another column or file.`;
      fileState.textContent = 'VALIDATION ERROR';
      throw error;
    }
  }

  function formatValue(value, digits = 4) {
    return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : 'N/A';
  }

  function draw() {
    if (!ctx) {
      note.textContent = 'Canvas drawing is unsupported in this browser. The selected-date controls and calculations remain available.';
      return;
    }
    const width = box.clientWidth;
    const height = box.clientHeight;
    if (!width || !height || observations.length < 1) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, width, height);

    const chartLeft = 14;
    const chartRight = width - 14;
    const chartWidth = Math.max(1, chartRight - chartLeft);
    const referenceTop = 43;
    const referenceBottom = height * 0.43;
    const fieldTop = height * 0.60;
    const fieldBottom = height - 38;
    const xFor = index => chartLeft + (observations.length > 1 ? index / (observations.length - 1) : 0) * chartWidth;
    const values = observations.map(item => item.value).filter(Number.isFinite);
    let minValue = Math.min(...values);
    let maxValue = Math.max(...values);
    if (Math.abs(maxValue - minValue) < 1e-12) { minValue -= 0.5; maxValue += 0.5; }
    const margin = (maxValue - minValue) * 0.08;
    minValue -= margin; maxValue += margin;
    const yReference = value => referenceTop + (maxValue - value) / (maxValue - minValue) * (referenceBottom - referenceTop);
    const allZeta = field.series.map(item => item.zeta).filter(Number.isFinite).map(Math.abs);
    const zScale = Math.min(8, Math.max(2, parameters.threshold * 1.25, ...(allZeta.length ? [Math.min(8, Math.max(...allZeta) * 1.08)] : [])));
    const yZeta = value => fieldTop + (zScale - Math.max(-zScale, Math.min(zScale, value))) / (2 * zScale) * (fieldBottom - fieldTop);

    ctx.strokeStyle = 'rgba(21,21,21,.10)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const x = chartLeft + i * chartWidth / 8;
      ctx.beginPath(); ctx.moveTo(x, 25); ctx.lineTo(x, height - 28); ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const y = referenceTop + i * (referenceBottom - referenceTop) / 3;
      ctx.beginPath(); ctx.moveTo(chartLeft, y); ctx.lineTo(chartRight, y); ctx.stroke();
    }

    ctx.fillStyle = '#6a675f';
    ctx.font = '8px "DM Mono", monospace';
    ctx.fillText('REFERENCE SERIES · SOURCE UNITS', chartLeft, 15);
    ctx.fillText('ζ-FIELD · SMOOTHED STANDARDIZED DEVIATION', chartLeft, fieldTop - 10);
    ctx.fillText(formatValue(maxValue, 2), chartLeft, referenceTop + 9);
    ctx.fillText(formatValue(minValue, 2), chartLeft, referenceBottom - 3);

    ctx.beginPath();
    field.series.forEach((item, index) => {
      const x = xFor(index);
      const y = yReference(item.value);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    const zeroY = yZeta(0);
    ctx.strokeStyle = 'rgba(21,21,21,.28)';
    ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(chartLeft, zeroY); ctx.lineTo(chartRight, zeroY); ctx.stroke();
    for (const threshold of [-parameters.threshold, parameters.threshold]) {
      if (Math.abs(threshold) > zScale) continue;
      ctx.strokeStyle = 'rgba(113,99,166,.42)';
      ctx.beginPath(); ctx.moveTo(chartLeft, yZeta(threshold)); ctx.lineTo(chartRight, yZeta(threshold)); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.beginPath();
    let started = false;
    field.series.forEach((item, index) => {
      if (!Number.isFinite(item.zeta)) { started = false; return; }
      const x = xFor(index);
      const y = yZeta(item.zeta);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#7163a6';
    ctx.lineWidth = 2;
    ctx.stroke();

    const selected = observations[selectedIndex];
    if (selected) {
      const selectedX = xFor(selectedIndex);
      ctx.strokeStyle = '#7163a6';
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(selectedX, 24); ctx.lineTo(selectedX, height - 27); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#151515';
      ctx.beginPath(); ctx.arc(selectedX, yReference(selected.value), 3.5, 0, Math.PI * 2); ctx.fill();
      if (Number.isFinite(field.series[selectedIndex].zeta)) {
        ctx.fillStyle = '#7163a6';
        ctx.beginPath(); ctx.arc(selectedX, yZeta(field.series[selectedIndex].zeta), 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#6a675f';
      ctx.font = '8px "DM Mono", monospace';
      ctx.fillText(observations[0].date, chartLeft, height - 10);
      const lastDate = observations.at(-1).date;
      const lastWidth = ctx.measureText(lastDate).width;
      ctx.fillText(lastDate, Math.max(chartLeft, chartRight - lastWidth), height - 10);
      const currentDate = selected.date;
      const dateWidth = ctx.measureText(currentDate).width;
      ctx.fillStyle = '#7163a6';
      ctx.fillText(currentDate, Math.min(Math.max(chartLeft, selectedX - dateWidth / 2), chartRight - dateWidth), height - 10);
    }

    const metrics = metricsAt(field, selectedIndex, parameters.threshold);
    stage.querySelector('#q-last-value').textContent = formatValue(metrics.lastValue);
    stage.querySelector('#q-last-return').textContent = metrics.lastReturn == null
      ? 'N/A' : `${metrics.lastReturn >= 0 ? '+' : ''}${formatValue(metrics.lastReturn, 3)} ${metrics.unit}`;
    stage.querySelector('#q-z-score').textContent = metrics.hasSignal ? metrics.zeta.toFixed(2) : 'N/A';
    stage.querySelector('#q-count').textContent = `${metrics.baselineCount} / ${parameters.window}`;
    status.textContent = !metrics.hasBaseline
      ? `INSUFFICIENT HISTORY · ${metrics.baselineCount}/${parameters.window}`
      : metrics.zeroVariance ? 'ZERO VARIANCE · ζ UNAVAILABLE'
        : metrics.triggered ? 'THRESHOLD CROSSED · RESEARCH FLAG' : 'WITHIN THRESHOLD · RESEARCH';
    if (!imported) status.textContent = `DEMO · ${status.textContent}`;
    timelineOutput.value = `${selectedIndex + 1} / ${observations.length}`;
    timeline.setAttribute('aria-valuetext', selected?.date || 'No observation selected');
    dateLabel.value = selected?.date || '—';
    dateLabel.textContent = selected?.date || '—';
    dateInput.value = selected?.date || '';
  }

  function selectIndex(index) {
    selectedIndex = Math.min(observations.length - 1, Math.max(0, Math.trunc(Number(index) || 0)));
    timeline.value = String(selectedIndex);
    updateTimelineBounds();
    draw();
  }

  controls.forEach(key => {
    const input = stage.querySelector(`#q-${key}`);
    const output = stage.querySelector(`#q-${key}-o`);
    input.addEventListener('input', event => {
      parameters[key] = Number(event.currentTarget.value);
      output.value = key === 'window' ? String(parameters[key]) : parameters[key].toFixed(2);
      refreshField();
    });
  });

  timeline.addEventListener('input', event => selectIndex(event.currentTarget.value));
  dateInput.addEventListener('change', () => {
    if (!dateInput.value || observations.length === 0) return;
    let candidate = observations.findIndex(item => item.date >= dateInput.value);
    const exact = observations.some(item => item.date === dateInput.value);
    if (candidate < 0) candidate = observations.length - 1;
    else if (observations[candidate].date > dateInput.value && candidate > 0) candidate--;
    selectIndex(candidate);
    if (!exact) {
      note.textContent = `No observation exists on ${dateInput.value}. The timeline moved to the nearest prior observation (${observations[candidate].date}).${imported ? ' CSV values remain local to this browser.' : ' The visible series is synthetic demo data.'}`;
    }
  });

  stage.querySelector('#q-file').addEventListener('change', async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const parsed = parseCSV(await file.text());
      const headers = parsed.rows[0];
      const records = parsed.rows.slice(1).map(row => ({
        date: row[0] || '',
        values: headers.map((_, index) => row[index] ?? '')
      }));
      const candidates = headers.map((header, index) => ({ header, index }))
        .filter(({ index }) => records.filter(row => Number.isFinite(parseNumericValue(row.values[index], parsed.delimiter))).length >= 2);
      const valueCandidates = candidates.filter(candidate => candidate.index > 0);
      if (!valueCandidates.length) throw new Error('No numeric value column was found after the first/date column. Include at least two numeric observations.');
      imported = { headers, records, fileName: file.name, candidates: valueCandidates, delimiter: parsed.delimiter };
      columnSelect.replaceChildren();
      valueCandidates.forEach(({ header, index }) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = header || `Column ${index + 1}`;
        columnSelect.append(option);
      });
      const defaultCandidate = valueCandidates[0];
      columnSelect.value = String(defaultCandidate.index);
      loadColumn(defaultCandidate.index);
    } catch (error) {
      imported = null;
      observations = demoSeries;
      selectedIndex = observations.length - 1;
      seriesLabel.textContent = 'SYNTHETIC DEMO SERIES';
      columnSelect.replaceChildren(new Option('Synthetic demo', 'demo'));
      columnSelect.value = 'demo';
      fileState.textContent = 'LOAD / VALIDATION ERROR';
      refreshField();
      note.textContent = `${error?.message || 'Could not read this CSV.'} Synthetic demo observations remain loaded. The selected CSV was not uploaded.`;
    }
  });

  columnSelect.addEventListener('change', () => {
    if (columnSelect.value !== 'demo') {
      try { loadColumn(Number(columnSelect.value)); }
      catch { /* loadColumn already rendered the validation message. */ }
    }
  });

  stage.querySelector('#q-reset').addEventListener('click', () => {
    imported = null;
    observations = demoSeries;
    selectedIndex = observations.length - 1;
    Object.assign(parameters, { window: 20, threshold: 1.5, damping: 0.25 });
    controls.forEach(key => {
      stage.querySelector(`#q-${key}`).value = String(parameters[key]);
      stage.querySelector(`#q-${key}-o`).value = key === 'window' ? String(parameters[key]) : parameters[key].toFixed(2);
    });
    columnSelect.replaceChildren(new Option('Synthetic demo', 'demo'));
    columnSelect.value = 'demo';
    stage.querySelector('#q-file').value = '';
    fileState.textContent = 'SYNTHETIC DEMO';
    seriesLabel.textContent = 'SYNTHETIC DEMO SERIES';
    note.textContent = 'Synthetic monthly observations are illustrative only, not financial data or validated signals. Import a dated CSV for local historical analysis; files are never uploaded. ζ is a provisional custom indicator and is not the Riemann zeta function.';
    refreshField();
  });

  const resize = () => draw();
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(box);
  } else window.addEventListener('resize', resize);
  refreshField();
  return () => {
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
  };
}

function founder() {
  const stage = document.querySelector('#instrument-stage');
  stage.innerHTML = `
    <div class="instrument-map product-map">
      <div class="instrument-hud">
        <span>PRODUCT SYSTEM / LIVE LOOP</span>
        <span id="product-step-label">SIMULATION · READY</span>
      </div>
      <svg viewBox="0 0 600 250" role="img" aria-label="Interactive product feedback loop simulation">
        <path class="map-edge" id="product-path" d="M115 125 H300 H485" />
        <path class="map-edge" d="M485 125 C485 205 115 205 115 125" />
        <rect class="map-node product-node is-current" data-product-node="user" x="45" y="91" width="140" height="66" />
        <text class="map-label" x="65" y="119">USER</text>
        <text class="map-sub" x="65" y="138">OBSERVATION</text>
        <rect class="map-node product-node" data-product-node="product" x="230" y="91" width="140" height="66" />
        <text class="map-label" x="250" y="119">PRODUCT</text>
        <text class="map-sub" x="250" y="138">SMALL TEST</text>
        <rect class="map-node product-node" data-product-node="evidence" x="415" y="91" width="140" height="66" />
        <text class="map-label" x="435" y="119">EVIDENCE</text>
        <text class="map-sub" x="435" y="138">MEASURE / DECIDE</text>
        <circle class="product-flow-dot" id="product-flow-dot" cx="115" cy="125" r="5" />
      </svg>
      <div class="product-state" aria-live="polite">
        <span id="product-state">READY TO RUN AN ITERATION</span>
        <span id="product-observations">ITERATIONS / 0</span>
      </div>
    </div>
    <div class="control-actions product-actions">
      <button type="button" id="product-run">RUN ITERATION</button>
      <button type="button" id="product-reset">RESET LOOP</button>
    </div>
    <p class="quant-note">Illustrative simulation only. Each run advances the loop through observation, experiment, evidence, and decision; it does not present invented production metrics as real user data.</p>`;

  const steps = [
    { label: '01 / OBSERVE', state: 'USER SIGNAL CAPTURED', x: 115 },
    { label: '02 / TEST', state: 'SMALL EXPERIMENT QUEUED', x: 300 },
    { label: '03 / MEASURE', state: 'OUTCOME RECORDED', x: 485 },
    { label: '04 / DECIDE', state: 'NEXT ITERATION READY', x: 115 }
  ];
  const stepLabel = stage.querySelector('#product-step-label');
  const state = stage.querySelector('#product-state');
  const countLabel = stage.querySelector('#product-observations');
  const dot = stage.querySelector('#product-flow-dot');
  const productNodes = [...stage.querySelectorAll('[data-product-node]')];
  const run = stage.querySelector('#product-run');
  const reset = stage.querySelector('#product-reset');
  let iteration = 0;
  let stepIndex = -1;
  const renderStep = () => {
    stepLabel.textContent = stepIndex < 0 ? 'SIMULATION · READY' : steps[stepIndex].label;
    state.textContent = stepIndex < 0 ? 'READY TO RUN AN ITERATION' : steps[stepIndex].state;
    dot.setAttribute('cx', String(stepIndex < 0 ? 115 : steps[stepIndex].x));
    const activeNode = stepIndex < 0 || stepIndex === 0 || stepIndex === 3 ? 'user' : stepIndex === 2 ? 'evidence' : 'product';
    productNodes.forEach(node => node.classList.toggle('is-current', node.dataset.productNode === activeNode));
    countLabel.textContent = `ITERATIONS / ${iteration}`;
  };
  run.addEventListener('click', () => {
    stepIndex = (stepIndex + 1) % steps.length;
    if (stepIndex === 3) iteration += 1;
    renderStep();
  });
  reset.addEventListener('click', () => { iteration = 0; stepIndex = -1; renderStep(); });
  return () => {};
}

function consulting() {
  const stage = document.querySelector('#instrument-stage');
  stage.innerHTML = `
    <div class="instrument-map">
      <div class="instrument-hud">
        <span>INFRASTRUCTURE / FAULT MAP</span>
        <span id="infra-state">ALL SYSTEMS NORMAL</span>
      </div>
      <svg id="infra-svg" viewBox="0 0 720 520">
        <path class="map-edge" d="M120 130 L350 100 L590 145 M120 130 L180 370 L350 100 M180 370 L430 390 L590 145 M350 100 L430 390" />
        <rect class="map-node" x="60" y="95" width="120" height="62" />
        <text class="map-label" x="82" y="122">EDGE</text>
        <text class="map-sub" x="82" y="140">CLIENT / DNS</text>
        <rect class="map-node" x="290" y="65" width="120" height="62" />
        <text class="map-label" x="312" y="92">CORE API</text>
        <text class="map-sub" x="312" y="110">SERVICE</text>
        <rect class="map-node" x="530" y="110" width="130" height="62" />
        <text class="map-label" x="552" y="137">DATA</text>
        <text class="map-sub" x="552" y="155">PRIMARY / REPLICA</text>
        <rect class="map-node" x="120" y="340" width="120" height="62" />
        <text class="map-label" x="142" y="367">CACHE</text>
        <text class="map-sub" x="142" y="385">FAST PATH</text>
        <rect class="map-node" x="370" y="360" width="120" height="62" />
        <text class="map-label" x="392" y="387">WORKER</text>
        <text class="map-sub" x="392" y="405">ASYNC</text>
      </svg>
      <div class="control-actions infra-actions">
        <button id="fault-btn">INJECT FAULT</button>
        <button id="restore-btn">RESTORE</button>
      </div>
    </div>`;

  const state = stage.querySelector('#infra-state');
  const fault = stage.querySelector('#fault-btn');
  const restore = stage.querySelector('#restore-btn');
  const nodes = [...stage.querySelectorAll('.map-node')];

  const setFault = active => {
    state.textContent = active ? 'DEGRADED / FAILURE DOMAIN' : 'ALL SYSTEMS NORMAL';
    nodes.forEach((node, index) => {
      node.style.opacity = active && index === 2 ? '0.35' : '1';
    });
  };

  fault.addEventListener('click', () => setFault(true));
  restore.addEventListener('click', () => setFault(false));
  return () => {};
}

function dpls() {
  const stage = document.querySelector('#instrument-stage');
  stage.innerHTML = `
    <div class="stores-app">
      <div class="instrument-map stores-map">
        <div class="instrument-hud"><span>A/G STORES / INVENTORY</span><span id="stores-persistence">BROWSER-LOCAL</span></div>
        <div class="stores-summary">
          <div><span>REGISTERED ITEMS</span><strong id="stores-total">0</strong></div>
          <div><span>AIR STORE</span><strong id="stores-air">0</strong></div>
          <div><span>GROUND STORE</span><strong id="stores-ground">0</strong></div>
          <div><span>VISIBLE MATCHES</span><strong id="stores-visible">0</strong></div>
          <div><span>LOW / EMPTY</span><strong id="stores-alerts">0</strong></div>
        </div>
      </div>
      <div class="stores-tools">
        <label><span>SEARCH</span><input id="stores-search" type="search" placeholder="Name, ID, location…"></label>
        <label><span>STORE</span><select id="stores-filter"><option value="all">ALL STORES</option><option value="Air">AIR</option><option value="Ground">GROUND</option></select></label>
        <button type="button" id="stores-export">EXPORT CSV</button>
      </div>
      <form id="stores-add" class="stores-add">
        <label><span>ITEM NAME</span><input name="name" maxlength="70" required placeholder="e.g. Sensor module"></label>
        <label><span>STORE</span><select name="store"><option>Air</option><option>Ground</option></select></label>
        <label><span>LOCATION</span><input name="location" maxlength="32" required placeholder="e.g. A-01"></label>
        <label><span>QTY</span><input name="quantity" type="number" min="0" max="999999" step="1" value="1" required></label>
        <input name="editId" type="hidden" value="">
        <button type="submit" id="stores-submit">ADD ITEM +</button>
        <button type="button" id="stores-cancel" hidden>CANCEL EDIT</button>
      </form>
      <div class="stores-table-wrap">
        <table class="stores-table">
          <thead><tr><th>ID</th><th>ITEM</th><th>STORE</th><th>LOCATION</th><th>QTY</th><th>STATUS</th><th><span class="visually-hidden">Actions</span></th></tr></thead>
          <tbody id="stores-rows"></tbody>
        </table>
        <p id="stores-empty" class="stores-empty" hidden>No matching items. Change the filter or add an item.</p>
      </div>
      <p class="quant-note">Prototype only · sample records are fictional · changes are stored in this browser, not sent to a server. Confirm the actual workflow and backend requirements before using it for real inventory.</p>
    </div>`;

  const storageKey = 'void-systems-air-ground-store-v1';
  const initialItems = [
    { id: 'AG-001', name: 'Sensor module', store: 'Air', location: 'A-01', quantity: 12 },
    { id: 'AG-002', name: 'Power unit', store: 'Air', location: 'A-03', quantity: 4 },
    { id: 'AG-003', name: 'Service kit', store: 'Air', location: 'A-06', quantity: 7 },
    { id: 'AG-004', name: 'Cable assembly', store: 'Ground', location: 'G-02', quantity: 18 },
    { id: 'AG-005', name: 'Tool case', store: 'Ground', location: 'G-04', quantity: 2 },
    { id: 'AG-006', name: 'Telemetry module', store: 'Ground', location: 'G-07', quantity: 9 }
  ];
  const rows = stage.querySelector('#stores-rows');
  const search = stage.querySelector('#stores-search');
  const filter = stage.querySelector('#stores-filter');
  const form = stage.querySelector('#stores-add');
  const empty = stage.querySelector('#stores-empty');
  const persistence = stage.querySelector('#stores-persistence');
  const submitButton = stage.querySelector('#stores-submit');
  const cancelButton = stage.querySelector('#stores-cancel');
  let items = initialItems;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(saved) && saved.every(item => item && typeof item.id === 'string' && typeof item.name === 'string' && ['Air', 'Ground'].includes(item.store) && typeof item.location === 'string' && Number.isFinite(item.quantity) && item.quantity >= 0)) items = saved;
  } catch { persistence.textContent = 'SESSION ONLY'; }

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(items)); persistence.textContent = 'BROWSER-LOCAL'; }
    catch { persistence.textContent = 'SESSION ONLY'; }
  }
  function node(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function render() {
    const needle = search.value.trim().toLowerCase();
    const visible = items.filter(item => (filter.value === 'all' || item.store === filter.value)
      && `${item.id} ${item.name} ${item.store} ${item.location}`.toLowerCase().includes(needle));
    rows.replaceChildren();
    for (const item of visible) {
      const tr = document.createElement('tr');
      tr.append(node('td', item.id, 'stores-id'));
      tr.append(node('td', item.name));
      tr.append(node('td', item.store.toUpperCase()));
      tr.append(node('td', item.location));
      tr.append(node('td', String(item.quantity)));
      tr.append(node('td', item.quantity === 0 ? 'OUT OF STOCK' : item.quantity <= 2 ? 'LOW' : 'OK', item.quantity === 0 ? 'stores-status stores-status--empty' : item.quantity <= 2 ? 'stores-status stores-status--low' : 'stores-status'));
      const actionCell = document.createElement('td');
      const edit = node('button', 'EDIT');
      edit.type = 'button';
      edit.dataset.editId = item.id;
      edit.setAttribute('aria-label', `Edit ${item.name} (${item.id})`);
      const remove = node('button', 'REMOVE');
      remove.type = 'button';
      remove.dataset.removeId = item.id;
      remove.setAttribute('aria-label', `Remove ${item.name} (${item.id})`);
      actionCell.append(edit, document.createTextNode(' '), remove);
      tr.append(actionCell);
      rows.append(tr);
    }
    empty.hidden = visible.length > 0;
    stage.querySelector('#stores-total').textContent = String(items.length);
    stage.querySelector('#stores-air').textContent = String(items.filter(item => item.store === 'Air').length);
    stage.querySelector('#stores-ground').textContent = String(items.filter(item => item.store === 'Ground').length);
    stage.querySelector('#stores-visible').textContent = String(visible.length);
    stage.querySelector('#stores-alerts').textContent = String(items.filter(item => item.quantity <= 2).length);
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const location = String(data.get('location') || '').trim();
    const store = String(data.get('store'));
    const quantity = Number(data.get('quantity'));
    if (!name || !location || !['Air', 'Ground'].includes(store) || !Number.isInteger(quantity) || quantity < 0 || quantity > 999999) return;
    const editId = String(data.get('editId') || '');
    if (editId) {
      const target = items.find(item => item.id === editId);
      if (!target) return;
      Object.assign(target, { name, store, location, quantity });
    } else {
      const numericIds = items.map(item => Number(item.id.match(/^AG-(\d+)$/)?.[1] || 0));
      const id = `AG-${String(Math.max(0, ...numericIds) + 1).padStart(3, '0')}`;
      items.push({ id, name, store, location, quantity });
    }
    save();
    form.reset();
    form.elements.quantity.value = '1';
    form.elements.editId.value = '';
    submitButton.textContent = 'ADD ITEM +';
    cancelButton.hidden = true;
    render();
  });
  rows.addEventListener('click', event => {
    const editButton = event.target.closest('button[data-edit-id]');
    if (editButton) {
      const item = items.find(entry => entry.id === editButton.dataset.editId);
      if (!item) return;
      form.elements.name.value = item.name;
      form.elements.store.value = item.store;
      form.elements.location.value = item.location;
      form.elements.quantity.value = String(item.quantity);
      form.elements.editId.value = item.id;
      submitButton.textContent = 'SAVE CHANGES';
      cancelButton.hidden = false;
      form.elements.name.focus();
      return;
    }
    const button = event.target.closest('button[data-remove-id]');
    if (!button) return;
    items = items.filter(item => item.id !== button.dataset.removeId);
    if (form.elements.editId.value === button.dataset.removeId) resetEditForm();
    save(); render();
  });
  function resetEditForm() {
    form.reset();
    form.elements.quantity.value = '1';
    form.elements.editId.value = '';
    submitButton.textContent = 'ADD ITEM +';
    cancelButton.hidden = true;
  }
  cancelButton.addEventListener('click', resetEditForm);
  search.addEventListener('input', render);
  filter.addEventListener('change', render);
  stage.querySelector('#stores-export').addEventListener('click', () => {
    const quote = value => `"${String(value).replace(/"/g, '""')}"`;
    const lines = [['ID', 'Name', 'Store', 'Location', 'Quantity'], ...items.map(item => [item.id, item.name, item.store, item.location, item.quantity])]
      .map(row => row.map(quote).join(','));
    const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'air-ground-inventory.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
  return () => {};
}

document.querySelectorAll('[data-lab]').forEach(button => {
  button.addEventListener('click', () => open(button.dataset.lab));
});

document.querySelectorAll('[data-close-modal]').forEach(button => {
  button.addEventListener('click', close);
});

addEventListener('keydown', event => {
  if (event.key === 'Escape' && modal.classList.contains('is-open')) close();
});

export { open, close };
