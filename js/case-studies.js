const modal = document.querySelector('#lab-modal');
const content = document.querySelector('#lab-content');
const code = document.querySelector('#lab-code');
let cleanup = () => {};

const roles = {
  rom: {
    code: 'LAB / 001 · ROM',
    title: 'DOCK OF DOOM',
    copy: 'A miniature ROM-development artifact. The point is not spectacle; it is state, input, collision, timing and the discipline of making a tiny machine behave.',
    meta: [
      ['MEDIUM', 'ROM / PLAYABLE BUILD'],
      ['INPUT', 'A / D / SPACE'],
      ['STATE', 'RUNNING'],
      ['FOCUS', 'LOGIC / TIMING']
    ]
  },
  quant: {
    code: 'LAB / 002 · QUANT',
    title: 'MARKET ANALYSIS',
    copy: 'A deliberately synthetic signal instrument. Parameters change a rolling normalization, momentum and confidence score. It is a visual study, not a trading system.',
    meta: [
      ['INPUT', 'SYNTHETIC PRICE SERIES'],
      ['WINDOW', 'ROLLING'],
      ['OUTPUT', 'SIGNAL / CONFIDENCE'],
      ['STATUS', 'SYNTHETIC / NON-TRADING']
    ]
  },
  founder: {
    code: 'LAB / 003 · STARTUP',
    title: 'PRODUCT SYSTEM',
    copy: 'A founder view of a product as a set of feedback loops: user surface, core service, telemetry, operations and the decision layer. This is not a generic server diagram.',
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
    copy: 'A separate archive instrument for older domain-specific development work: protocol boundaries, deterministic state and compatibility constraints.',
    meta: [
      ['DOMAIN', 'A/G-DPLS'],
      ['MODE', 'LEGACY / DETERMINISTIC'],
      ['FOCUS', 'PROTOCOL / STATE'],
      ['STATUS', 'ARCHIVED']
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
    <div class="instrument-canvas">
      <canvas id="rom-canvas"></canvas>
      <div class="instrument-hud">
        <span>ROM TEST BUILD / v0.2</span>
        <span>STATE / LIVE</span>
      </div>
      <div class="rom-touch">
        <button data-k="a" aria-label="Move left">←</button>
        <button data-k=" " aria-label="Jump">↑</button>
        <button data-k="d" aria-label="Move right">→</button>
      </div>
    </div>`;

  const canvas = stage.querySelector('canvas');
  const box = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const keys = {};
  let frame = 0;
  let x = 0.22;
  let velocityY = 0;
  let grounded = true;
  let previous = performance.now();

  const onKeyDown = event => { keys[event.key.toLowerCase()] = true; };
  const onKeyUp = event => { keys[event.key.toLowerCase()] = false; };
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);

  stage.querySelectorAll('.rom-touch button').forEach(button => {
    const key = button.dataset.k;
    const press = event => {
      event.preventDefault();
      keys[key] = true;
    };
    const release = event => {
      event.preventDefault();
      keys[key] = false;
    };

    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
  });

  const resize = () => {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(box.clientWidth * ratio));
    canvas.height = Math.max(1, Math.floor(box.clientHeight * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(box);
  resize();

  function draw(now) {
    const elapsed = Math.min(40, now - previous);
    previous = now;
    const step = elapsed / 16.67;

    x += ((keys.a ? -1 : 0) + (keys.d ? 1 : 0)) * 0.009 * step;
    if ((keys[' '] || keys.w) && grounded) {
      velocityY = -0.018;
      grounded = false;
    }

    velocityY += 0.00075 * step;
    let y = 0.67 + velocityY;
    if (y >= 0.67) {
      y = 0.67;
      velocityY = 0;
      grounded = true;
    }
    x = Math.max(0.06, Math.min(0.94, x));

    const width = box.clientWidth;
    const height = box.clientHeight;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(21, 21, 21, 0.11)';
    ctx.lineWidth = 1;
    for (let index = 0; index < 10; index++) {
      const gridX = index * width / 9;
      ctx.beginPath();
      ctx.moveTo(gridX, 0);
      ctx.lineTo(gridX, height);
      ctx.stroke();
    }

    ctx.strokeStyle = '#151515';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.74);
    ctx.lineTo(width, height * 0.74);
    ctx.stroke();
    ctx.fillStyle = '#151515';
    ctx.fillRect(x * width - 8, y * height, 16, 16);
    ctx.font = '8px "DM Mono", monospace';
    ctx.fillStyle = '#696761';
    ctx.fillText('A / D · SPACE', 14, 24);

    frame = requestAnimationFrame(draw);
  }

  frame = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    removeEventListener('keydown', onKeyDown);
    removeEventListener('keyup', onKeyUp);
  };
}

function quant() {
  const stage = document.querySelector('#instrument-stage');
  stage.innerHTML = `
    <div class="instrument-canvas">
      <canvas id="quant-canvas"></canvas>
      <div class="instrument-hud">
        <span>SIGNAL / SYNTHETIC SERIES</span>
        <span id="signal-status">WAITING FOR PARAMETERS</span>
      </div>
    </div>
    <div class="signal-controls">
      <label class="param">
        <span>WINDOW</span>
        <input id="q-window" type="range" min="5" max="60" value="20">
        <output id="q-window-o">20</output>
      </label>
      <label class="param">
        <span>THRESHOLD</span>
        <input id="q-threshold" type="range" min="0.5" max="0.95" step="0.01" value="0.72">
        <output id="q-threshold-o">0.72</output>
      </label>
      <label class="param">
        <span>SMOOTHING</span>
        <input id="q-smoothing" type="range" min="0" max="0.9" step="0.01" value="0.35">
        <output id="q-smoothing-o">0.35</output>
      </label>
    </div>`;

  const canvas = stage.querySelector('#quant-canvas');
  const box = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const status = stage.querySelector('#signal-status');
  const series = Array.from({ length: 300 }, (_, index) => (
    1
    + Math.sin(index * 0.071) * 0.12
    + Math.sin(index * 0.021) * 0.16
    + Math.sin(index * 0.39) * 0.012
  ));
  const parameters = { window: 20, threshold: 0.72, smoothing: 0.35 };

  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(box.clientWidth * ratio));
    canvas.height = Math.max(1, Math.floor(box.clientHeight * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function draw() {
    const width = box.clientWidth;
    const height = box.clientHeight;
    if (!width || !height) return;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(21, 21, 21, 0.10)';
    ctx.lineWidth = 1;
    for (let index = 0; index < 9; index++) {
      const gridX = index * width / 8;
      ctx.beginPath();
      ctx.moveTo(gridX, 0);
      ctx.lineTo(gridX, height);
      ctx.stroke();
    }
    for (let index = 0; index < 6; index++) {
      const gridY = index * height / 5;
      ctx.beginPath();
      ctx.moveTo(0, gridY);
      ctx.lineTo(width, gridY);
      ctx.stroke();
    }

    ctx.beginPath();
    series.forEach((value, index) => {
      const x = index / (series.length - 1) * width;
      const y = height - (value - 0.65) / 0.7 * height * 0.78 - height * 0.1;
      if (index) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const windowSize = Math.max(2, Math.round(parameters.window));
    const windowValues = series.slice(-windowSize);
    const average = windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length;
    const variance = windowValues.reduce((sum, value) => sum + (value - average) ** 2, 0) / windowValues.length;
    const deviation = Math.sqrt(variance);
    const scale = Math.max(deviation, 0.015);
    const last = series.at(-1);
    const first = series[Math.max(0, series.length - windowSize)];
    const momentum = (last - first) / scale;
    const normalized = (last - average) / scale;
    const rawSignal = 0.65 * normalized + 0.35 * momentum;
    const signal = rawSignal * (1 - parameters.smoothing);
    const triggered = Math.abs(signal) >= parameters.threshold;
    const confidence = Math.min(0.99, 1 - Math.exp(-Math.abs(signal) * 0.7));

    status.textContent = triggered ? 'THRESHOLD / CROSSED' : 'THRESHOLD / HOLD';
    ctx.font = '9px "DM Mono", monospace';
    ctx.fillStyle = '#151515';
    ctx.fillText(`SIGNAL  ${signal.toFixed(2)}`, 15, height - 34);
    ctx.fillText(`CONFIDENCE  ${confidence.toFixed(2)}`, 15, height - 18);
  }

  const controls = ['window', 'threshold', 'smoothing'];
  controls.forEach(key => {
    const input = stage.querySelector(`#q-${key}`);
    const output = stage.querySelector(`#q-${key}-o`);
    input.addEventListener('input', event => {
      parameters[key] = Number(event.currentTarget.value);
      output.value = key === 'window'
        ? String(parameters[key])
        : parameters[key].toFixed(2);
      draw();
    });
  });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(box);
  resize();
  return () => resizeObserver.disconnect();
}

function founder() {
  const stage = document.querySelector('#instrument-stage');
  stage.innerHTML = `
    <div class="instrument-map">
      <div class="instrument-hud">
        <span>PRODUCT SYSTEM / FEEDBACK LOOP</span>
        <span>DECISION LATENCY / 42 MIN</span>
      </div>
      <svg viewBox="0 0 720 520" role="img" aria-label="Product feedback loop">
        <path class="map-edge" d="M100 250 C170 110 250 110 315 250 S470 390 600 250" />
        <path class="map-edge" d="M315 250 C350 170 470 170 600 250" />
        <rect class="map-node" x="55" y="220" width="110" height="60" />
        <text class="map-label" x="76" y="247">USER</text>
        <text class="map-sub" x="76" y="264">INPUT</text>
        <rect class="map-node" x="260" y="220" width="110" height="60" />
        <text class="map-label" x="281" y="247">PRODUCT</text>
        <text class="map-sub" x="281" y="264">CORE LOOP</text>
        <rect class="map-node" x="545" y="220" width="120" height="60" />
        <text class="map-label" x="566" y="247">TELEMETRY</text>
        <text class="map-sub" x="566" y="264">OBSERVE</text>
        <rect class="map-node" x="420" y="82" width="120" height="60" />
        <text class="map-label" x="441" y="109">DECISION</text>
        <text class="map-sub" x="441" y="126">NEXT TEST</text>
        <text class="map-sub" x="70" y="340">SIMPLE SURFACE</text>
        <text class="map-sub" x="274" y="340">SMALL EXPERIMENTS</text>
        <text class="map-sub" x="552" y="340">EVIDENCE</text>
      </svg>
    </div>`;
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
    <div class="instrument-map">
      <div class="instrument-hud">
        <span>A/G-DPLS / LEGACY ARCHIVE</span>
        <span>DETERMINISTIC STATE</span>
      </div>
      <svg viewBox="0 0 720 520">
        <line class="dpls-line" x1="100" y1="110" x2="100" y2="420" />
        <line class="dpls-line" x1="100" y1="150" x2="610" y2="150" />
        <circle class="dpls-dot" cx="100" cy="150" r="5" />
        <circle class="dpls-dot" cx="260" cy="150" r="5" />
        <circle class="dpls-dot" cx="430" cy="150" r="5" />
        <circle class="dpls-dot" cx="610" cy="150" r="5" />
        <text class="dpls-muted" x="76" y="130">BOOT</text>
        <text class="dpls-muted" x="230" y="130">STATE</text>
        <text class="dpls-muted" x="395" y="130">PROTOCOL</text>
        <text class="dpls-muted" x="575" y="130">OUTPUT</text>
        <text class="dpls-muted" x="125" y="215">LEGACY CONSTRAINTS</text>
        <text class="dpls-muted" x="125" y="250">• deterministic transitions</text>
        <text class="dpls-muted" x="125" y="275">• strict compatibility</text>
        <text class="dpls-muted" x="125" y="300">• explicit failure states</text>
        <rect class="map-node" x="440" y="245" width="170" height="90" />
        <text class="map-label" x="462" y="278">ARCHIVE VIEW</text>
        <text class="map-sub" x="462" y="300">NOT NETWORK ENGINEERING</text>
        <text class="map-sub" x="462" y="318">DOMAIN-SPECIFIC DEVELOPMENT</text>
      </svg>
    </div>`;
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
