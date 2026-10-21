'use strict';

(() => {
  const scriptUrl = document.currentScript?.src || new URL('./index.js', location.href).href;
  const assetBase = new URL('./', scriptUrl);
  const shell = document.querySelector('#game-shell');
  const surface = document.querySelector('#game-surface');
  const canvas = document.querySelector('#doom');
  const start = document.querySelector('#start-button');
  const fullscreen = document.querySelector('#fullscreen-button');
  const returnButton = document.querySelector('#return-button');
  const panel = document.querySelector('#startup-panel');
  const status = document.querySelector('#status-text');
  const progress = document.querySelector('#load-progress');
  const progressLabel = document.querySelector('#progress-label');
  const runtimeStatus = document.querySelector('#runtime-status');
  const errorBox = document.querySelector('#error-text');
  const startupMessage = document.querySelector('#startup-message');
  let engineScript = null;
  let started = false;
  let engineInitialized = false;
  let gameReady = false;

  function setStatus(message) {
    const text = String(message || 'Loading engine…');
    status.textContent = text;
    runtimeStatus.textContent = text.toUpperCase().slice(0, 70);
    const match = text.match(/\((\d+(?:\.\d+)?)\s*\/\s*(\d+)\)/);
    if (match) {
      const percent = Math.max(0, Math.min(100, Number(match[1]) / Number(match[2]) * 100));
      progress.value = percent;
      progressLabel.textContent = `${percent.toFixed(1)}%`;
    } else if (/ready|running|initialized/i.test(text)) {
      progress.value = 100;
      progressLabel.textContent = '100%';
    }
  }

  function showError(title, error) {
    const detail = error?.message || (typeof error === 'string' ? error : 'No additional error details were provided.');
    errorBox.textContent = `${title} ${detail}`;
    errorBox.hidden = false;
    status.textContent = 'INITIALIZATION FAILED';
    runtimeStatus.textContent = 'ERROR · SEE DETAILS';
    if (window.parent !== window) window.parent.postMessage({ type: 'webdoom:runtime-error', message: detail }, window.location.origin);
    start.textContent = 'RELOAD GAME PANEL';
    start.disabled = false;
    start.onclick = () => location.reload();
    fullscreen.disabled = true;
    panel.classList.remove('is-hidden');
  }

  function isSupported() {
    if (typeof WebAssembly !== 'object') return 'This browser does not support WebAssembly.';
    if (typeof DecompressionStream !== 'function') return 'This browser cannot decompress the bundled shareware data. Update to a current desktop browser.';
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl') || probe.getContext('experimental-webgl');
    if (!gl) return 'WebGL is unavailable. Enable hardware acceleration or try another current browser.';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return '';
  }

  function handleKeyboard(event) {
    const focused = document.activeElement === canvas || document.pointerLockElement === canvas || document.fullscreenElement === surface;
    if (!focused || event.key === 'Escape') return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Control', 'Alt'].includes(event.key)) event.preventDefault();
  }

  function onReturn() {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    try { window.parent.postMessage({ type: 'webdoom:return-to-portfolio' }, window.location.origin); }
    catch { window.parent.postMessage({ type: 'webdoom:return-to-portfolio' }, '*'); }
    if (window.parent === window) location.hash = '#return';
  }

  async function enterFullscreen() {
    try {
      if (surface.requestFullscreen) await surface.requestFullscreen();
      else if (window.Module?.requestFullscreen) window.Module.requestFullscreen(true, false);
      else {
        runtimeStatus.textContent = 'FULLSCREEN UNSUPPORTED';
        return;
      }
      canvas.focus({ preventScroll: true });
    } catch (error) {
      runtimeStatus.textContent = `FULLSCREEN FAILED: ${(error?.message || 'unsupported').slice(0, 52)}`;
    }
  }

  // Track actual WebGL drawing activity. Pixel readback is unreliable for
  // some browser/compositor configurations and can report black even when the
  // engine is drawing. Install the tracker before loading Emscripten.
  let webglDrawCalls = 0;
  let webglContext = null;

  function trackGameDrawing() {
    const originalGetContext = canvas.getContext.bind(canvas);
    try {
      canvas.getContext = function (type, attributes) {
        const isWebGL = type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl';
        const gl = originalGetContext(type, isWebGL
          ? { ...(attributes || {}), preserveDrawingBuffer: true }
          : attributes);

        if (isWebGL && gl && !gl.__webdoomDrawTrackerInstalled) {
          webglContext = gl;
          try {
            Object.defineProperty(gl, '__webdoomDrawTrackerInstalled', { value: true });
            for (const name of [
              'drawArrays',
              'drawElements',
              'drawArraysInstanced',
              'drawElementsInstanced',
              'drawRangeElements'
            ]) {
              if (typeof gl[name] !== 'function') continue;
              const original = gl[name].bind(gl);
              gl[name] = (...args) => {
                webglDrawCalls++;
                return original(...args);
              };
            }
          } catch (error) {
            console.warn('[WebDOOM] Could not instrument WebGL draw calls.', error);
          }
        }
        return gl;
      };
    } catch (error) {
      console.warn('[WebDOOM] Could not wrap canvas.getContext.', error);
    }
  }

  function hasRenderedGameFrame() {
    return Boolean(
      webglContext &&
      !webglContext.isContextLost() &&
      canvas.width >= 64 &&
      canvas.height >= 32 &&
      webglDrawCalls > 0
    );
  }

  function checkForFirstFrame(attempt = 0) {
    window.requestAnimationFrame(() => {
      if (gameReady || !engineInitialized || !started) return;
      // Readback synchronizes the GPU; poll every six animation frames instead of every frame.
      if (attempt % 6 === 0 && hasRenderedGameFrame()) {
        gameReady = true;
        status.textContent = 'GAME READY';
        runtimeStatus.textContent = 'GAME RUNNING';
        startupMessage.textContent = 'The engine initialized and a rendered game frame was detected. Click the canvas to focus keyboard input.';
        start.textContent = 'GAME RUNNING';
        start.disabled = true;
        fullscreen.disabled = false;
        panel.classList.add('is-hidden');
        canvas.focus({ preventScroll: true });
        if (window.parent !== window) window.parent.postMessage({ type: 'webdoom:runtime-running' }, window.location.origin);
        return;
      }
      if (attempt >= 180) {
        showError(
          'THE ENGINE INITIALIZED, BUT NO GAME FRAME WAS DETECTED.',
          new Error(`No WebGL draw activity was detected within the startup window. Canvas: ${canvas.width}×${canvas.height}; WebGL context: ${Boolean(webglContext)}; context lost: ${webglContext ? webglContext.isContextLost() : 'unknown'}; draw calls: ${webglDrawCalls}. Check the console and network requests for doom1.wasm and doom1.data.gz.`)
        );
        return;
      }
      checkForFirstFrame(attempt + 1);
    });
  }

  function startGame() {
    if (started) return;
    const unsupported = isSupported();
    if (unsupported) {
      showError('UNSUPPORTED BROWSER.', new Error(unsupported));
      return;
    }
    started = true;
    start.disabled = true;
    start.textContent = 'LOADING ENGINE…';
    startupMessage.textContent = 'Loading the local WebAssembly engine and compressed shareware data. The first download is several megabytes; it stays on this page.';
    errorBox.hidden = true;
    setStatus('Loading engine assets…');

    trackGameDrawing();

    window.Module = {
      canvas,
      arguments: [],
      print: text => console.log('[WebDOOM]', text),
      printErr: text => console.warn('[WebDOOM]', text),
      setStatus,
      locateFile(path, prefix) {
        try { return new URL(path, prefix || assetBase).href; }
        catch { return new URL(path, assetBase).href; }
      },
      monitorRunDependencies(left) {
        if (left > 0) setStatus(`Preparing runtime · ${left} dependencies remaining`);
        else setStatus('Runtime dependencies loaded');
      },
      onRuntimeInitialized() {
        engineInitialized = true;
        progress.value = 100;
        progressLabel.textContent = '100%';
        status.textContent = 'ENGINE INITIALIZED';
        runtimeStatus.textContent = 'WAITING FOR GAME FRAME';
        startupMessage.textContent = 'The WebAssembly runtime initialized. Waiting for the first rendered game frame before marking the game ready.';
        start.textContent = 'INITIALIZING GAME…';
        start.disabled = true;
        checkForFirstFrame();
      },
      onAbort(reason) {
        showError('THE DOOM RUNTIME ABORTED.', new Error(String(reason || 'Unknown WebAssembly runtime error.')));
      }
    };

    engineScript = document.createElement('script');
    engineScript.async = true;
    engineScript.src = new URL('doom1.js', assetBase).href;
    engineScript.onerror = () => showError('THE ENGINE SCRIPT COULD NOT BE LOADED.', new Error(`Check ${new URL('doom1.js', assetBase).pathname} and the static-host asset paths.`));
    engineScript.onload = () => {
      // wasm/data loading happens after script load; the Module callbacks own runtime state.
      window.setTimeout(() => {
        if (!engineInitialized && !errorBox.hidden && errorBox.textContent) return;
        if (!engineInitialized) setStatus('Loading WebAssembly + shareware data…');
      }, 250);
    };
    document.body.append(engineScript);
  }

  canvas.addEventListener('click', () => canvas.focus({ preventScroll: true }));
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    showError('THE GRAPHICS CONTEXT WAS LOST.', new Error('Reload this panel to initialize a fresh WebGL context.'));
  });
  fullscreen.addEventListener('click', enterFullscreen);
  returnButton.addEventListener('click', onReturn);
  start.addEventListener('click', startGame);
  window.addEventListener('keydown', handleKeyboard, true);
  document.addEventListener('pointerlockchange', () => {
    runtimeStatus.textContent = document.pointerLockElement === canvas ? 'MOUSE CAPTURED · ESC TO RELEASE' : (gameReady ? 'GAME RUNNING' : engineInitialized ? 'WAITING FOR GAME FRAME' : runtimeStatus.textContent);
  });
  window.addEventListener('error', event => {
    if (started && !gameReady) showError('A RUNTIME ERROR OCCURRED.', event.error || new Error(event.message || 'Unknown error.'));
  });
  window.addEventListener('unhandledrejection', event => {
    if (started && !gameReady) showError('RUNTIME INITIALIZATION REJECTED.', event.reason);
  });
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    if (event.data?.type === 'webdoom:ping') window.parent.postMessage({ type: 'webdoom:ready' }, window.location.origin);
  });
  if (window.parent === window) {
    shell.classList.add('standalone');
  }
})();
