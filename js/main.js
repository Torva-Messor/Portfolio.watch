import { SilkSurface } from './fabric.js';
import { initNavigation } from './navigation.js';
import { initInteraction } from './interaction.js';
import './case-studies.js';

const silk = new SilkSurface(
  document.querySelector('#silk-canvas'),
  document.querySelector('#silk-fallback-canvas')
);

initNavigation();
initInteraction(silk);

let lastFrame = performance.now();

function renderFrame(now) {
  const delta = Math.min(50, now - lastFrame);
  lastFrame = now;

  if (!document.hidden) {
    silk.update(now, delta);
    silk.render();
  }

  requestAnimationFrame(renderFrame);
}

requestAnimationFrame(renderFrame);
setTimeout(() => document.querySelector('#boot')?.classList.add('is-done'), 500);

const watchLab = document.querySelector('#watch-lab');
let watchViewer = null;
let watchLoading = null;

async function openWatchLab(event) {
  event?.preventDefault?.();
  document.querySelector('#nav-panel')?.classList.remove('is-open');
  document.querySelector('.menu-toggle')?.setAttribute('aria-expanded', 'false');
  watchLab.classList.add('is-open');
  watchLab.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-locked');
  if (location.hash !== '#watch-lab') history.replaceState(null, '', `${location.pathname}${location.search}#watch-lab`);

  if (!watchViewer) {
    if (!watchLoading) {
      watchLoading = Promise.all([
        import('./watch/watch-viewer.js'),
        import('./watch/watch-controls.js')
      ])
        .then(async ([viewerModule, controlsModule]) => {
          watchViewer = new viewerModule.WatchViewer(document.querySelector('#watch-canvas'));
          controlsModule.initWatchControls(watchViewer);
          // Load the public ETA 6497-1 assembly on first open, not only after a manual re-click.
          await watchViewer.setMovement('eta-6497-1');
        })
        .catch(error => {
          console.error('Watch lab could not start:', error);
          const notice = document.querySelector('#model-error');
          if (notice) {
            notice.hidden = false;
            const reason = error?.message ? ` ${error.message}` : '';
            notice.textContent = `WATCH LAB COULD NOT START.${reason} Check that WebGL is enabled and the Three.js CDN is reachable.`;
          }
        })
        .finally(() => {
          watchLoading = null;
        });
    }

    await watchLoading;
  }

  requestAnimationFrame(() => {
    watchViewer?.resize();
    watchViewer?.setActive(!document.hidden && watchLab.classList.contains('is-open'));
  });
}

function closeWatchLab() {
  watchLab.classList.remove('is-open');
  watchLab.setAttribute('aria-hidden', 'true');
  watchViewer?.setActive(false);
  document.body.classList.remove('is-locked');
  if (location.hash === '#watch-lab') history.replaceState(null, '', `${location.pathname}${location.search}`);
}

document.querySelectorAll('#open-watch, #open-watch-hero, [data-open-watch]').forEach(button => button.addEventListener('click', openWatchLab));
document.querySelector('#close-watch')?.addEventListener('click', closeWatchLab);

addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (watchLab.classList.contains('is-open')) closeWatchLab();
});

document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('tab-hidden', document.hidden);
  watchViewer?.setActive(!document.hidden && watchLab.classList.contains('is-open'));
});

// Direct links open the Watch Lab without going through a dead external inspector.
if (location.hash === '#watch-lab') requestAnimationFrame(() => openWatchLab());
