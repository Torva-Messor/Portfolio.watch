export function initInteraction(silk) {
  let lastScroll = scrollY;
  let lastTime = performance.now();

  addEventListener('scroll', () => {
    const now = performance.now();
    const distance = scrollY - lastScroll;
    const elapsed = Math.max(16, now - lastTime);
    silk?.addScrollImpulse(distance / elapsed);
    lastScroll = scrollY;
    lastTime = now;
  }, { passive: true });

  addEventListener('pointermove', event => {
    silk?.setMouse(event.clientX / innerWidth, 1 - event.clientY / innerHeight);
  }, { passive: true });
}
