import { CALIBERS } from './watch-database.js';

const byId = id => document.getElementById(id);

function renderMovementData(key) {
  const movement = CALIBERS[key];
  const title = byId('caliber-name');
  const data = byId('caliber-data');
  if (!movement || !title || !data) return;

  title.textContent = `${movement.manufacturer} ${movement.caliber}`;
  data.replaceChildren();
  const hiddenFields = new Set(['manufacturer', 'caliber', 'family', 'model', 'source', 'license', 'remoteUrl']);

  Object.entries(movement).forEach(([key, value]) => {
    if (hiddenFields.has(key)) return;
    const row = document.createElement('div');
    const label = document.createElement('dt');
    const detail = document.createElement('dd');
    label.textContent = key.replace(/[A-Z]/g, letter => ` ${letter}`).toUpperCase();
    detail.textContent = value;
    row.append(label, detail);
    data.append(row);
  });

  const source = byId('watch-source');
  if (source) source.textContent = `${movement.source} ${movement.license}`;
}

function resetControlValues(viewer) {
  const values = [
    ['watch-speed', 'watch-speed-out', '1.00×'],
    ['watch-explode', 'watch-explode-out', '0%'],
    ['watch-light', 'watch-light-out', '1.00×']
  ];
  values.forEach(([inputId, outputId, label]) => {
    const input = byId(inputId);
    const output = byId(outputId);
    if (input) input.value = inputId === 'watch-light' ? '1' : inputId === 'watch-speed' ? '1' : '0';
    if (output) output.value = label;
  });

  const play = byId('watch-play');
  if (play) {
    play.textContent = 'ON';
    play.classList.add('active');
  }
  viewer.setPlaying(true);
  viewer.setSpeed(1);
  viewer.setLight(1);
  viewer.setExplode(0);
}

export function initWatchControls(viewer) {
  const picker = byId('movement-picker');
  let selectionRequest = 0;
  async function selectMovement(key) {
    if (!Object.hasOwn(CALIBERS, key)) return;
    const requestId = ++selectionRequest;
    document.querySelectorAll('.caliber[data-caliber]').forEach(item => {
      item.classList.toggle('active', item.dataset.caliber === key);
      item.setAttribute('aria-pressed', String(item.dataset.caliber === key));
    });
    if (picker && picker.value !== key) picker.value = key;
    const error = byId('model-error');
    if (error) error.hidden = true;
    renderMovementData(key);
    resetControlValues(viewer);
    const loaded = await viewer.setMovement(key);
    if (loaded === null || requestId !== selectionRequest) return;
    const labels = byId('watch-labels');
    const isolate = byId('watch-isolate');
    if (labels) labels.textContent = viewer.labels ? 'LABELS / ON' : 'LABELS / OFF';
    if (isolate) isolate.textContent = 'ISOLATE';
  }

  document.querySelectorAll('.caliber[data-caliber]').forEach(button => {
    button.addEventListener('click', () => selectMovement(button.dataset.caliber));
  });
  picker?.addEventListener('change', () => selectMovement(picker.value));

  byId('watch-play')?.addEventListener('click', event => {
    viewer.setPlaying(!viewer.playing);
    event.currentTarget.textContent = viewer.playing ? 'ON' : 'OFF';
    event.currentTarget.classList.toggle('active', viewer.playing);
  });

  byId('watch-speed')?.addEventListener('input', event => {
    const speed = Number(event.currentTarget.value);
    viewer.setSpeed(speed);
    byId('watch-speed-out').value = `${speed.toFixed(2)}×`;
  });

  byId('watch-explode')?.addEventListener('input', event => {
    const amount = Number(event.currentTarget.value);
    viewer.setExplode(amount);
    byId('watch-explode-out').value = `${Math.round(amount * 100)}%`;
  });

  byId('watch-light')?.addEventListener('input', event => {
    const amount = Number(event.currentTarget.value);
    viewer.setLight(amount);
    byId('watch-light-out').value = `${amount.toFixed(2)}×`;
  });

  byId('watch-reset')?.addEventListener('click', () => {
    viewer.reset();
    resetControlValues(viewer);
    const labels = byId('watch-labels');
    const isolate = byId('watch-isolate');
    const perspective = byId('watch-perspective');
    if (labels) labels.textContent = 'LABELS / OFF';
    if (isolate) isolate.textContent = 'ISOLATE';
    if (perspective) perspective.textContent = 'PERSPECTIVE';
  });

  byId('watch-front')?.addEventListener('click', () => viewer.front());
  byId('watch-perspective')?.addEventListener('click', event => {
    event.currentTarget.textContent = viewer.togglePerspective() ? 'PERSPECTIVE' : 'ORTHOGRAPHIC';
  });
  byId('watch-labels')?.addEventListener('click', event => {
    viewer.setLabels(!viewer.labels);
    event.currentTarget.textContent = viewer.labels ? 'LABELS / ON' : 'LABELS / OFF';
  });
  byId('watch-isolate')?.addEventListener('click', event => {
    const isolated = viewer.isolateSelected();
    event.currentTarget.textContent = isolated ? 'SHOW ALL' : 'ISOLATE';
  });

  if (picker) picker.value = 'eta-6497-1';
  document.querySelectorAll('.caliber[data-caliber]').forEach(item => {
    const active = item.dataset.caliber === 'eta-6497-1';
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  renderMovementData('eta-6497-1');
}
