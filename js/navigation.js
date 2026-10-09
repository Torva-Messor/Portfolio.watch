export function initNavigation() {
  const menu = document.querySelector('.menu-toggle');
  const panel = document.querySelector('#nav-panel');

  const close = () => {
    panel?.classList.remove('is-open');
    menu?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
  };

  menu?.addEventListener('click', () => {
    const open = !panel.classList.contains('is-open');
    panel.classList.toggle('is-open', open);
    menu.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('is-locked', open);
  });

  panel?.querySelectorAll('[data-nav]').forEach(link => link.addEventListener('click', close));
  document.querySelectorAll('[data-nav]').forEach(link => link.addEventListener('click', event => {
    const target = link.getAttribute('href');
    if (!target?.startsWith('#')) return;

    event.preventDefault();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector(target)?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  }));
}
