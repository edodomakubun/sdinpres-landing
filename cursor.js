/**
 * Progressive GPU-composited trailing halo for desktop fine pointers.
 * Works alongside custom SVG OS cursors defined in styles.css.
 */
(function initCustomCursor() {
  if (typeof window === 'undefined') return;

  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!isFinePointer || prefersReduced) return;

  const INTERACTIVE_SELECTOR = [
    'a[href]',
    'button',
    'summary',
    '[role="button"]',
    '[role="tab"]',
    'label:has(input)',
    'select',
    '.open-post-btn'
  ].join(',');

  const ring = document.createElement('div');
  ring.className = 'custom-cursor-ring';
  ring.setAttribute('aria-hidden', 'true');
  ring.innerHTML = '<span class="custom-cursor-ring-inner"></span>';

  let targetX = -100;
  let targetY = -100;
  let currentX = -100;
  let currentY = -100;
  let rafId = null;
  let hasMoved = false;

  function tick() {
    currentX += (targetX - currentX) * 0.24;
    currentY += (targetY - currentY) * 0.24;

    ring.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;

    if (Math.abs(targetX - currentX) > 0.15 || Math.abs(targetY - currentY) > 0.15) {
      rafId = requestAnimationFrame(tick);
    } else {
      currentX = targetX;
      currentY = targetY;
      ring.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
      rafId = null;
    }
  }

  function scheduleTick() {
    if (rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function mount() {
    if (!document.body) return;
    document.body.appendChild(ring);

    document.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!hasMoved) {
        currentX = targetX;
        currentY = targetY;
        hasMoved = true;
      }
      ring.classList.add('is-visible');
      const interactiveTarget = e.target instanceof Element ? e.target.closest(INTERACTIVE_SELECTOR) : null;
      ring.classList.toggle('is-interactive', Boolean(interactiveTarget));
      scheduleTick();
    }, { passive: true });

    document.addEventListener('mousedown', () => ring.classList.add('is-pressed'), { passive: true });
    document.addEventListener('mouseup', () => ring.classList.remove('is-pressed'), { passive: true });
    document.addEventListener('mouseleave', () => ring.classList.remove('is-visible'), { passive: true });
    window.addEventListener('blur', () => ring.classList.remove('is-visible', 'is-pressed'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
