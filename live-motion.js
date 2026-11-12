/**
 * Live bidirectional scroll choreography (up & down) and smooth GPU scroll parallax.
 * Shared by index.html and praktik-baik.html.
 */
(function initLiveMotion() {
  if (typeof window === 'undefined') return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const observedItems = new WeakSet();
  let observer = null;
  let lastScrollY = window.scrollY || 0;
  let scrollDir = 'down';

  function revealAllFallback() {
    document.querySelectorAll('.reveal-item').forEach((el) => {
      el.classList.add('is-visible');
    });
  }

  function ensureObserver() {
    if (observer || !('IntersectionObserver' in window)) return observer;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target;
          if (entry.isIntersecting) {
            el.classList.add('is-visible');
            return;
          }

          // Track whether item exited above or below viewport so re-entry animates naturally
          const rect = entry.boundingClientRect;
          el.dataset.revealFrom = rect.top < 0 ? 'top' : 'bottom';
          el.classList.remove('is-visible');
        });
      },
      {
        threshold: 0.04,
        rootMargin: '20px 0px -16px 0px'
      }
    );

    return observer;
  }

  function refreshLiveReveal() {
    const items = document.querySelectorAll('.reveal-item');
    if (!items.length) return;

    if (prefersReduced || !('IntersectionObserver' in window)) {
      revealAllFallback();
      return;
    }

    document.documentElement.classList.add('js-anim-ready');
    const obs = ensureObserver();

    items.forEach((item, index) => {
      if (!item.style.getPropertyValue('--reveal-delay')) {
        item.style.setProperty('--reveal-delay', `${(index % 4) * 55}ms`);
      }

      if (!observedItems.has(item)) {
        observedItems.add(item);
        const rect = item.getBoundingClientRect();
        const inViewport = rect.top < window.innerHeight * 0.96 && rect.bottom > 0;
        item.dataset.revealFrom = rect.top < 0 ? 'top' : (scrollDir === 'up' ? 'top' : 'bottom');
        if (inViewport) {
          item.classList.add('is-visible');
        }
        obs.observe(item);
      }
    });
  }

  function initScrollTracking() {
    if (prefersReduced) return;

    let rafPending = false;

    const updateOnScroll = () => {
      const y = window.scrollY || 0;
      if (Math.abs(y - lastScrollY) > 1) {
        scrollDir = y < lastScrollY ? 'up' : 'down';
        lastScrollY = y;
      }

      const heroStage = document.querySelector('.hero-glass-stage');
      if (heroStage) {
        const rect = heroStage.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          const offset = Math.max(-14, Math.min(14, y * 0.04));
          heroStage.style.setProperty('--hero-parallax', `${offset.toFixed(2)}px`);
        }
      }

      rafPending = false;
    };

    window.addEventListener(
      'scroll',
      () => {
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(updateOnScroll);
        }
      },
      { passive: true }
    );

    updateOnScroll();
  }

  function observeDynamicContainers() {
    if (!('MutationObserver' in window)) return;

    ['news-container', 'cardsGrid'].forEach((id) => {
      const container = document.getElementById(id);
      if (!container) return;
      const mo = new MutationObserver(() => refreshLiveReveal());
      mo.observe(container, { childList: true });
    });
  }

  window.refreshLiveReveal = refreshLiveReveal;

  function boot() {
    refreshLiveReveal();
    initScrollTracking();
    observeDynamicContainers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

