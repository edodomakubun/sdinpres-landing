/* SD INPRES LELINGLUAN | Portal Resmi & Layanan Digital Terpadu */
const CONFIG = {
  bloggerBase: 'https://blog.sdinpreslelingluan.com',
  newsLabel: 'Berita',
  storyLabel: 'Story',
  newsLimit: 4,
  timeout: 10000
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));
}

function safeUrl(value = '') {
  try {
    const url = new URL(value, window.location.href);
    return /^https?:$/i.test(url.protocol) ? url.href : '#';
  } catch {
    return '#';
  }
}

function postUrl(post) {
  const alternate = Array.isArray(post?.link)
    ? post.link.find(link => link.rel === 'alternate')
    : null;
  return safeUrl(alternate?.href || CONFIG.bloggerBase);
}

function postTitle(post) {
  return post?.title?.$t || 'Informasi Sekolah';
}

function postDate(post) {
  const raw = post?.published?.$t || post?.updated?.$t;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
    : 'Terkini';
}

function postThumbnail(post) {
  if (post?.media$thumbnail?.url) {
    return post.media$thumbnail.url.replace(/\/s[0-9]+(-c)?\//, '/w600-h360-p-k-no-nu/');
  }
  const content = post?.content?.$t || post?.summary?.$t || '';
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && match[1]) {
    return match[1];
  }
  return 'https://lh3.googleusercontent.com/aida-public/AB6AXuAgfeEr4EpMs6Q7BAdxhvRz_Lo4mAd2xKjeAgj-tJKxv2unXfeEddr2APY0w-diyLGCCdWjcQUSnDllKo1X93Um73RbPrsYan5my3a80APIko7iHDqxFVkoyKRxrWwjnHtKgMXGnBYR7bKT49b6sxPiTMA9DNX6Xed8oDYLS-24DdDcaOHaaAn65o501a9tzYDID2oW0ZO-TcSFKHnHWeHSdXzlBlU7YF1fxsAm_kU8';
}

function excerpt(post, max = 110) {
  const html = post?.summary?.$t || post?.content?.$t || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function jsonpFeed(label, limit) {
  return new Promise((resolve, reject) => {
    const callbackName = `__sdinpres_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      script.remove();
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
    };

    const fail = error => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const timeout = setTimeout(() => {
      fail(new Error(`Feed ${label} timeout`));
    }, CONFIG.timeout);

    window[callbackName] = payload => {
      if (settled) return;
      settled = true;
      cleanup();
      const entries = Array.isArray(payload?.feed?.entry) ? payload.feed.entry : [];
      resolve(entries);
    };

    script.onerror = () => {
      fail(new Error(`Feed ${label} gagal dimuat`));
    };

    const endpoint = `${CONFIG.bloggerBase}/feeds/posts/default/-/${encodeURIComponent(label)}?alt=json-in-script&max-results=${Number(limit) || 4}&orderby=published&callback=${callbackName}`;
    script.async = true;
    script.src = endpoint;
    document.body.appendChild(script);
  });
}

function renderNews(posts) {
  const container = $('#news-container');
  if (!container || !posts || !posts.length) return;

  const validPosts = posts.slice(0, CONFIG.newsLimit);
  const categoryThemes = [
    { bg: 'bg-[#EFF6FF]', text: 'text-[#00288E]', label: 'Kesehatan' },
    { bg: 'bg-[#FEF3C7]', text: 'text-[#78350F]', label: 'Seni & Budaya' },
    { bg: 'bg-[#ECFDF5]', text: 'text-[#047857]', label: 'Guru & KBM' },
    { bg: 'bg-[#F1F5F9]', text: 'text-[#334155]', label: 'Kesiswaan' }
  ];

  container.innerHTML = validPosts.map((post, idx) => {
    const title = escapeHTML(postTitle(post));
    const href = escapeHTML(postUrl(post));
    const date = escapeHTML(postDate(post));
    const desc = escapeHTML(excerpt(post));
    const thumb = escapeHTML(postThumbnail(post));
    const cat = categoryThemes[idx % categoryThemes.length];

    if (idx === 0) {
      return `
        <article class="spotlight-card reveal-item lg:col-span-6 lg:row-span-3 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-[#00288E]/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
          <div>
            <div class="aspect-[16/10] w-full bg-slate-100 overflow-hidden">
              <img class="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" src="${thumb}" alt="${title}" width="640" height="400" loading="lazy" decoding="async">
            </div>
            <div class="p-5 sm:p-6">
              <div class="flex flex-wrap items-center gap-2.5 mb-3">
                <span class="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${cat.bg} ${cat.text}">${cat.label}</span>
                <span class="text-xs font-medium text-slate-500 tabular-nums">${date}</span>
              </div>
              <h3 class="text-xl sm:text-2xl font-bold tracking-tight leading-snug text-slate-900 group-hover:text-[#00288E] transition-colors">
                ${title}
              </h3>
              <p class="text-sm text-slate-600 mt-2.5 leading-relaxed max-w-[65ch]">
                ${desc}
              </p>
            </div>
          </div>
          <div class="px-5 sm:px-6 pb-5 pt-3 border-t border-slate-100">
            <a class="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-[#00288E] font-bold hover:underline" href="${href}">
              <span>Baca selengkapnya</span>
              <span class="visually-hidden">: ${title}</span>
              <span class="material-symbols-outlined text-[17px] group-hover:translate-x-1 transition-transform" aria-hidden="true">arrow_forward</span>
            </a>
          </div>
        </article>
      `;
    }

    return `
      <article class="spotlight-card reveal-item lg:col-span-6 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-[#00288E]/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col sm:flex-row group">
        <div class="sm:w-44 md:w-48 aspect-[16/10] sm:aspect-auto bg-slate-100 overflow-hidden shrink-0">
          <img class="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" src="${thumb}" alt="${title}" width="320" height="220" loading="lazy" decoding="async">
        </div>
        <div class="p-4 sm:p-5 flex flex-col justify-between flex-1 min-w-0">
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-1.5">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${cat.bg} ${cat.text}">${cat.label}</span>
              <span class="text-xs font-medium text-slate-500 tabular-nums">${date}</span>
            </div>
            <h3 class="text-base sm:text-lg font-bold tracking-tight leading-snug text-slate-900 line-clamp-2 group-hover:text-[#00288E] transition-colors">
              ${title}
            </h3>
            <p class="text-xs sm:text-sm text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
              ${desc}
            </p>
          </div>
          <div class="mt-2 pt-2 border-t border-slate-100">
            <a class="inline-flex items-center gap-1 min-h-[44px] text-xs sm:text-sm text-[#00288E] font-bold hover:underline" href="${href}">
              <span>Baca selengkapnya</span>
              <span class="visually-hidden">: ${title}</span>
              <span class="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform" aria-hidden="true">arrow_forward</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  initSpotlightCards();
  window.refreshLiveReveal?.();
}

async function loadLandingNews() {
  try {
    const news = await jsonpFeed(CONFIG.newsLabel, CONFIG.newsLimit);
    if (news && news.length > 0) {
      renderNews(news);
    }
  } catch (err) {
    // Keep the pre-rendered non-dummy news cards in HTML untouched
    console.warn('Menggunakan berita pre-rendered lokal:', err.message);
  }
}

// ── Mobile Bottom Navigation & Scrollspy ──────────────────
function initScrollspy() {
  const sections = ['beranda', 'portal', 'berita', 'profil'];
  const navTabs = $$('nav.md\\:hidden a[data-tab]');

  if (!navTabs.length) return;

  const updateActiveTab = () => {
    const scrollPos = window.scrollY + 180;
    let currentId = 'beranda';

    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.offsetTop <= scrollPos) {
        currentId = id;
      }
    });

    navTabs.forEach(tab => {
      const tabTarget = tab.getAttribute('data-tab');
      const icon = tab.querySelector('.material-symbols-outlined');
      const text = tab.querySelector('span:not(.material-symbols-outlined)');

      if (tabTarget === currentId) {
        tab.className = 'flex flex-col items-center justify-center min-h-[48px] text-[#00288E] font-bold py-1.5 px-1 rounded-xl bg-[#EFF6FF]/90 transition-colors min-w-0';
        tab.setAttribute('aria-current', 'location');
        if (icon) icon.style.fontVariationSettings = "'FILL' 1, 'wght' 550";
        if (text) text.classList.add('font-bold');
      } else {
        tab.className = 'flex flex-col items-center justify-center min-h-[48px] text-slate-600 py-1.5 px-1 rounded-xl hover:text-[#00288E] transition-colors min-w-0';
        tab.removeAttribute('aria-current');
        if (icon) icon.style.fontVariationSettings = "'FILL' 0, 'wght' 400";
        if (text) text.classList.remove('font-bold');
      }
    });
  };

  window.addEventListener('scroll', updateActiveTab, { passive: true });
  updateActiveTab();
}

// ── Smooth Anchor Scrolling ──────────────────────────────
function initSmoothScroll() {
  const anchors = $$('a[href^="#"]');
  anchors.forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      const target = $(href);
      if (target) {
        e.preventDefault();
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
      }
    });
  });
}

// ── Blog Links Same-Tab Navigation ───────────────────────
function initBlogLinks() {
  document.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (link && link.href && link.href.includes('blog.sdinpreslelingluan.com')) {
      link.removeAttribute('target');
      link.removeAttribute('rel');
    }
  }, { capture: true });
}

// ── FAQ Accordion Disclosure Helper ──────────────────────
function initFaqAccordion() {
  // Preserve native independent <details> disclosure per modern-web-guidance
}

// ── Firebase Firestore Site Visits & Realtime Online Tracking ──
const SITE_STATS_DOC_ID = 'site-stats';
const LOCAL_SITE_VISITS_KEY = 'sdinpres_site_visits_backup';
let hasCountedSiteVisit = false;
let siteStatsUnsubscribe = null;

function formatVisitCount(count) {
  return (Number(count) || 0).toLocaleString('id-ID');
}

function updateSiteVisitsDisplay(count) {
  const formatted = formatVisitCount(count);
  $$('.live-total-visits').forEach(el => {
    const textEl = el.querySelector('.visit-count-text');
    if (textEl) {
      textEl.textContent = `${formatted} Kunjungan`;
    } else {
      el.innerHTML = `<span class="material-symbols-outlined text-[15px] text-[#00288E] shrink-0" aria-hidden="true">visibility</span> <span class="visit-count-text tabular-nums">${formatted} Kunjungan</span>`;
    }
  });
}

function updateOnlineDisplay(count) {
  const safeCount = Math.max(1, Number(count) || 1);
  $$('.live-online-count').forEach(el => {
    const textEl = el.querySelector('.online-count-text');
    if (textEl) {
      textEl.textContent = `${safeCount} Online`;
    } else {
      el.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#047857] shrink-0" aria-hidden="true"></span> <span class="online-count-text tabular-nums">${safeCount} Online</span>`;
    }
  });
}

async function fetchLegacyRtdbVisits(databaseURL) {
  if (!databaseURL) return 0;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`${databaseURL.replace(/\/$/, '')}/stats/totalVisits.json`, {
      signal: controller.signal
    });
    if (!res.ok) return 0;
    const val = await res.json();
    return typeof val === 'number' && val > 0 ? val : 0;
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

function subscribeSiteStatsRealtime(onSnapshotFn, statsRef) {
  if (typeof siteStatsUnsubscribe === 'function') {
    siteStatsUnsubscribe();
    siteStatsUnsubscribe = null;
  }
  siteStatsUnsubscribe = onSnapshotFn(
    statsRef,
    snap => {
      if (!snap.exists()) return;
      const liveViews = Number(snap.data()?.views);
      if (!Number.isFinite(liveViews) || liveViews < 0) return;
      updateSiteVisitsDisplay(liveViews);
      try {
        localStorage.setItem(LOCAL_SITE_VISITS_KEY, String(liveViews));
      } catch { }
    },
    err => {
      console.warn('Listener realtime kunjungan Firestore terganggu:', err);
    }
  );
}

async function initVisitorTracking() {
  const onlineElements = $$('.live-online-count');
  const totalElements = $$('.live-total-visits');
  if (!onlineElements.length && !totalElements.length) return;

  // Tampilkan cadangan lokal lebih dulu agar tidak berkedip di angka 0
  let cachedVisits = 0;
  try {
    cachedVisits = Number(localStorage.getItem(LOCAL_SITE_VISITS_KEY)) || 0;
    if (cachedVisits > 0) {
      updateSiteVisitsDisplay(cachedVisits);
    }
  } catch { }

  try {
    const [
      { initializeApp, getApps, getApp },
      { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, increment, serverTimestamp },
      { getDatabase, ref: rtdbRef, onValue, push: rtdbPush, set: rtdbSet, onDisconnect },
      { getActiveFirebaseConfig, isFirebaseConfigured }
    ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js'),
      import('./firebase-config.js')
    ]);

    const config = getActiveFirebaseConfig();
    if (!isFirebaseConfigured(config)) return;

    const app = getApps().length === 0 ? initializeApp(config) : getApp();

    // 1. Online Users Presence (RTDB)
    if (onlineElements.length && config.databaseURL) {
      try {
        const rtdb = getDatabase(app);
        const onlineRef = rtdbRef(rtdb, 'stats/onlineUsers');
        const connectedRef = rtdbRef(rtdb, '.info/connected');

        onValue(connectedRef, snap => {
          if (snap.val() === true) {
            const sessionRef = rtdbPush(onlineRef);
            onDisconnect(sessionRef).remove();
            rtdbSet(sessionRef, true);
          }
        });

        onValue(onlineRef, snap => {
          const activeSessions = snap.exists() ? Object.keys(snap.val() || {}).length : 0;
          updateOnlineDisplay(activeSessions > 0 ? activeSessions : 1);
        });
      } catch (rtdbErr) {
        console.warn('Info kehadiran online RTDB:', rtdbErr);
      }
    }

    // 2. Total Kunjungan Halaman Utama (Cloud Firestore + realtime onSnapshot tanpa reload)
    if (totalElements.length) {
      const db = getFirestore(app);
      const statsRef = doc(db, 'posts', SITE_STATS_DOC_ID);

      if (!hasCountedSiteVisit) {
        hasCountedSiteVisit = true;
        try {
          const snap = await getDoc(statsRef);
          if (snap.exists()) {
            const currentViews = Number(snap.data()?.views) || 0;
            const newViews = currentViews + 1;
            updateSiteVisitsDisplay(newViews);
            try {
              localStorage.setItem(LOCAL_SITE_VISITS_KEY, String(newViews));
            } catch { }

            await updateDoc(statsRef, {
              views: increment(1),
              updatedAt: serverTimestamp()
            });
          } else {
            // Migrasi otomatis satu kali dari hitungan RTDB lama jika tersedia
            const legacyCount = await fetchLegacyRtdbVisits(config.databaseURL);
            const initialViews = Math.max(legacyCount, cachedVisits) + 1;
            updateSiteVisitsDisplay(initialViews);
            try {
              localStorage.setItem(LOCAL_SITE_VISITS_KEY, String(initialViews));
            } catch { }

            await setDoc(statsRef, {
              type: 'site_stats',
              status: 'system',
              title: 'Statistik Kunjungan Halaman Utama',
              views: initialViews,
              updatedAt: serverTimestamp()
            });
          }
        } catch (firestoreErr) {
          console.warn('Gagal memperbarui kunjungan ke Firestore, beralih ke cadangan lokal:', firestoreErr);
          const fallbackVisits = cachedVisits + 1;
          updateSiteVisitsDisplay(fallbackVisits);
          try {
            localStorage.setItem(LOCAL_SITE_VISITS_KEY, String(fallbackVisits));
          } catch { }
        }
      }

      subscribeSiteStatsRealtime(onSnapshot, statsRef);
    }
  } catch (error) {
    console.warn('Pelacakan kunjungan beralih ke cadangan lokal:', error);
    if (!hasCountedSiteVisit && totalElements.length) {
      hasCountedSiteVisit = true;
      const fallbackVisits = cachedVisits + 1;
      updateSiteVisitsDisplay(fallbackVisits);
      try {
        localStorage.setItem(LOCAL_SITE_VISITS_KEY, String(fallbackVisits));
      } catch { }
    }
  }
}

// ── Desktop Visi & Misi Slide Bar ────────────────────────
function initVisiMisiSlider() {
  const slides = [
    {
      badgeLabel: 'VISI',
      badgeClass: 'bg-[#FEF3C7] text-[#78350F] border border-[#D97706]',
      text: '“Menjadi sekolah unggul yang melahirkan generasi penerus bangsa yang literat, cerdas, berkarakter mulia, dan tangguh dalam menghadapi berbagai tantangan, serta menciptakan lingkungan belajar yang aman, nyaman, inklusif dan Religius.”'
    },
    {
      badgeLabel: 'MISI 1',
      badgeClass: 'bg-[#00288E] text-white border border-[#00288E]',
      text: '1. Meningkatkan skor literasi siswa melalui program pembinaan minat baca dan literasi secara berkelanjutan.'
    },
    {
      badgeLabel: 'MISI 2',
      badgeClass: 'bg-[#00288E] text-white border border-[#00288E]',
      text: '2. Menanamkan nilai-nilai moral dan budi pekerti luhur melalui pembinaan karakter dan akhlak mulia.'
    },
    {
      badgeLabel: 'MISI 3',
      badgeClass: 'bg-[#00288E] text-white border border-[#00288E]',
      text: '3. Meningkatkan kompetensi guru dalam merancang pembelajaran inovatif melalui pelatihan berkala.'
    },
    {
      badgeLabel: 'MISI 4',
      badgeClass: 'bg-[#00288E] text-white border border-[#00288E]',
      text: '4. Mewujudkan sekolah yang aman dan nyaman melalui program anti-bullying dan penanggulangan kekerasan.'
    }
  ];

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let currentIndex = 0;
  let timer = null;
  let isPaused = prefersReduced;

  const container = document.getElementById('visi-misi-slider');
  const badgeEl = document.getElementById('visi-misi-badge');
  const textEl = document.getElementById('visi-misi-text');
  const dotsContainer = document.getElementById('visi-misi-dots');
  const prevBtn = document.getElementById('visi-misi-prev');
  const nextBtn = document.getElementById('visi-misi-next');
  const toggleBtn = document.getElementById('visi-misi-toggle');

  if (!container || !badgeEl || !textEl) return;

  function syncToggleButton() {
    if (!toggleBtn) return;
    const icon = toggleBtn.querySelector('.material-symbols-outlined');
    toggleBtn.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', isPaused ? 'Putar otomatis Visi & Misi' : 'Jeda otomatis Visi & Misi');
    toggleBtn.setAttribute('title', isPaused ? 'Putar slide Visi & Misi' : 'Jeda slide Visi & Misi');
    if (icon) icon.textContent = isPaused ? 'play_arrow' : 'pause';
  }

  function updateDots(activeIdx) {
    if (!dotsContainer) return;
    const dots = dotsContainer.querySelectorAll('button');
    dots.forEach((dot, idx) => {
      const bar = dot.querySelector('span');
      dot.setAttribute('aria-current', idx === activeIdx ? 'true' : 'false');
      if (bar) {
        bar.className = idx === activeIdx
          ? 'block w-5 h-1.5 rounded-xs bg-[#00288E] transition-colors'
          : 'block w-2 h-1.5 rounded-xs bg-[#C7C1B5] group-hover:bg-[#64748B] transition-colors';
      }
    });
  }

  function renderSlide(index) {
    const item = slides[index];
    if (prefersReduced) {
      badgeEl.className = `px-2 py-0.5 rounded-xs text-[11px] font-bold uppercase tracking-wider shrink-0 ${item.badgeClass}`;
      badgeEl.textContent = item.badgeLabel;
      textEl.textContent = item.text;
      textEl.setAttribute('title', item.text);
      updateDots(index);
      return;
    }

    textEl.style.opacity = '0';
    setTimeout(() => {
      badgeEl.className = `px-2 py-0.5 rounded-xs text-[11px] font-bold uppercase tracking-wider shrink-0 transition-colors duration-200 ${item.badgeClass}`;
      badgeEl.textContent = item.badgeLabel;
      textEl.textContent = item.text;
      textEl.setAttribute('title', item.text);
      updateDots(index);
      requestAnimationFrame(() => {
        textEl.style.opacity = '1';
      });
    }, 150);
  }

  function nextSlide() {
    currentIndex = (currentIndex + 1) % slides.length;
    renderSlide(currentIndex);
  }

  function prevSlide() {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    renderSlide(currentIndex);
  }

  function stopAutoplay() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    if (isPaused) return;
    timer = setInterval(nextSlide, 6000);
  }

  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    slides.forEach((slide, idx) => {
      const dot = document.createElement('button');
      dot.setAttribute('type', 'button');
      dot.setAttribute('aria-label', `Pindah ke slide ${slide.badgeLabel}`);
      dot.setAttribute('aria-current', idx === 0 ? 'true' : 'false');
      dot.className = 'group min-h-[44px] px-1.5 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#00288E]';
      const bar = document.createElement('span');
      bar.className = idx === 0
        ? 'block w-5 h-1.5 rounded-full bg-[#00288E] transition-all duration-300'
        : 'block w-2 h-1.5 rounded-full bg-slate-300 group-hover:bg-slate-400 transition-all duration-300';
      dot.appendChild(bar);
      dot.addEventListener('click', () => {
        currentIndex = idx;
        renderSlide(currentIndex);
        startAutoplay();
      });
      dotsContainer.appendChild(dot);
    });
  }

  if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); startAutoplay(); });
  if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); startAutoplay(); });
  if (toggleBtn) {
    syncToggleButton();
    toggleBtn.addEventListener('click', () => {
      isPaused = !isPaused;
      syncToggleButton();
      if (isPaused) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    });
  }

  container.addEventListener('mouseenter', stopAutoplay);
  container.addEventListener('mouseleave', () => {
    if (!isPaused) startAutoplay();
  });

  startAutoplay();
}

// ── Scroll Reading Progress Indicator ────────────────────
function initScrollProgress() {
  const bar = document.querySelector('.scroll-progress-bar');
  if (!bar) return;

  let ticking = false;
  const update = () => {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / docHeight)) : 0;
    document.documentElement.style.setProperty('--scroll-progress', String(progress));
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
}

// ── Choreographed Live Scroll Reveal (delegated to live-motion.js) ──
function initScrollReveal() {
  if (typeof window.refreshLiveReveal === 'function') {
    window.refreshLiveReveal();
    return;
  }
  $$('.reveal-item').forEach(el => el.classList.add('is-visible'));
}

// ── Pointer Spotlight Micro-Interaction ──────────────────
function initSpotlightCards() {
  if (!window.matchMedia('(hover: hover)').matches) return;

  $$('.spotlight-card').forEach(card => {
    if (card.dataset.spotlightBound === '1') return;
    card.dataset.spotlightBound = '1';
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  });
}

// ── Interactive Portal Role Filter ───────────────────────
function initPortalFilter() {
  const buttons = $$('[data-portal-filter]');
  const cards = $$('[data-portal-group]');
  if (!buttons.length || !cards.length) return;

  const applyFilter = (targetGroup) => {
    buttons.forEach(btn => {
      const active = btn.dataset.portalFilter === targetGroup;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (active) {
        btn.className = 'min-h-[44px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold bg-[#00288E] text-white shadow-xs transition-all';
      } else {
        btn.className = 'min-h-[44px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-white text-slate-600 border border-slate-200 hover:border-[#00288E]/40 hover:text-[#00288E] transition-all';
      }
    });

    cards.forEach((card, idx) => {
      const group = card.dataset.portalGroup;
      const matches = targetGroup === 'all' || group === targetGroup;
      card.classList.toggle('hidden', !matches);
      if (matches) {
        card.classList.remove('animate-panel-swap');
        void card.offsetWidth;
        card.style.animationDelay = `${(idx % 4) * 35}ms`;
        card.classList.add('animate-panel-swap');
      }
    });
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.portalFilter || 'all'));
  });
}

// ── Interactive 4 Pilar Tabs Showcase ────────────────────
function initPilarTabs() {
  const tabs = $$('[data-pilar-tab]');
  const panels = $$('[data-pilar-panel]');
  if (!tabs.length || !panels.length) return;

  const activatePilar = (id) => {
    tabs.forEach(tab => {
      const isSelected = tab.dataset.pilarTab === id;
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      tab.classList.toggle('bg-[#00288E]', isSelected);
      tab.classList.toggle('text-white', isSelected);
      tab.classList.toggle('border-[#00288E]', isSelected);
      tab.classList.toggle('shadow-md', isSelected);
      tab.classList.toggle('bg-white', !isSelected);
      tab.classList.toggle('text-slate-800', !isSelected);
      tab.classList.toggle('border-slate-200', !isSelected);

      const numBadge = tab.querySelector('[data-pilar-num]');
      if (numBadge) {
        numBadge.className = isSelected
          ? 'text-xs font-extrabold px-2 py-0.5 rounded-md bg-white/15 text-amber-300 tabular-nums shrink-0'
          : 'text-xs font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-[#00288E] tabular-nums shrink-0';
      }
    });

    panels.forEach(panel => {
      const match = panel.dataset.pilarPanel === id;
      panel.classList.toggle('hidden', !match);
      if (match) {
        panel.classList.remove('animate-panel-swap');
        void panel.offsetWidth;
        panel.classList.add('animate-panel-swap');
      }
    });
  };

  tabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => activatePilar(tab.dataset.pilarTab));
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = tabs[(idx + 1) % tabs.length];
        next.focus();
        activatePilar(next.dataset.pilarTab);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
        prev.focus();
        activatePilar(prev.dataset.pilarTab);
      }
    });
  });
}

// ── Interactive Hero Banner Carousel ─────────────────────
function initHeroCarousel() {
  const carousel = document.getElementById('hero-banner-carousel');
  if (!carousel) return;

  const slides = $$('.hero-slide', carousel);
  const captionEl = document.getElementById('hero-slide-caption');
  const counterEl = document.getElementById('hero-slide-counter');
  const dotsContainer = document.getElementById('hero-dots');
  const prevBtn = document.getElementById('hero-prev');
  const nextBtn = document.getElementById('hero-next');
  const toggleBtn = document.getElementById('hero-toggle');

  if (!slides.length) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = 0;
  let timer = null;
  let isPaused = prefersReduced;
  let touchStartX = 0;

  function syncToggleBtn() {
    if (!toggleBtn) return;
    const icon = toggleBtn.querySelector('.material-symbols-outlined');
    toggleBtn.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', isPaused ? 'Putar otomatis galeri hero' : 'Jeda putar otomatis galeri hero');
    if (icon) icon.textContent = isPaused ? 'play_arrow' : 'pause';
  }

  function updateDots(activeIdx) {
    if (!dotsContainer) return;
    const dotBtns = dotsContainer.querySelectorAll('button');
    dotBtns.forEach((btn, idx) => {
      const bar = btn.querySelector('span');
      const active = idx === activeIdx;
      btn.setAttribute('aria-current', active ? 'true' : 'false');
      if (bar) {
        bar.className = active
          ? 'block w-6 h-1.5 rounded-full bg-amber-400 transition-all duration-300'
          : 'block w-2.5 h-1.5 rounded-full bg-white/55 group-hover:bg-white/90 transition-all duration-300';
      }
    });
  }

  function goToSlide(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((img, idx) => {
      const active = idx === current;
      img.classList.toggle('opacity-100', active);
      img.classList.toggle('scale-100', active);
      img.classList.toggle('opacity-0', !active);
      img.classList.toggle('scale-[1.03]', !active);
      img.classList.toggle('pointer-events-none', !active);
      img.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    const activeSlide = slides[current];
    if (captionEl && activeSlide?.dataset.caption) {
      captionEl.textContent = activeSlide.dataset.caption;
    }
    if (counterEl) {
      const num = String(current + 1).padStart(2, '0');
      const total = String(slides.length).padStart(2, '0');
      counterEl.textContent = `${num} / ${total}`;
    }
    updateDots(current);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function startTimer() {
    stopTimer();
    if (isPaused) return;
    timer = setInterval(() => goToSlide(current + 1), 5000);
  }

  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    slides.forEach((_, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', `Tampilkan foto hero ${idx + 1} dari ${slides.length}`);
      btn.setAttribute('aria-current', idx === 0 ? 'true' : 'false');
      btn.className = 'group min-h-[44px] min-w-[28px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-amber-300';
      const bar = document.createElement('span');
      bar.className = idx === 0
        ? 'block w-6 h-1.5 rounded-full bg-amber-400 transition-all duration-300'
        : 'block w-2.5 h-1.5 rounded-full bg-white/55 group-hover:bg-white/90 transition-all duration-300';
      btn.appendChild(bar);
      btn.addEventListener('click', () => {
        goToSlide(idx);
        startTimer();
      });
      dotsContainer.appendChild(btn);
    });
  }

  prevBtn?.addEventListener('click', () => {
    goToSlide(current - 1);
    startTimer();
  });

  nextBtn?.addEventListener('click', () => {
    goToSlide(current + 1);
    startTimer();
  });

  toggleBtn?.addEventListener('click', () => {
    isPaused = !isPaused;
    syncToggleBtn();
    if (isPaused) stopTimer();
    else startTimer();
  });

  carousel.addEventListener('mouseenter', stopTimer);
  carousel.addEventListener('mouseleave', () => {
    if (!isPaused) startTimer();
  });

  carousel.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0]?.clientX || 0;
  }, { passive: true });

  carousel.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0]?.clientX || 0;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40) {
      goToSlide(diff > 0 ? current + 1 : current - 1);
      startTimer();
    }
  }, { passive: true });

  syncToggleBtn();
  goToSlide(0);
  startTimer();
}

// ── Application Bootstrap ────────────────────────────────
function init() {
  initScrollProgress();
  initSmoothScroll();
  initBlogLinks();
  initScrollspy();
  initFaqAccordion();
  initVisitorTracking();
  initHeroCarousel();
  initVisiMisiSlider();
  initPortalFilter();
  initPilarTabs();
  initScrollReveal();
  initSpotlightCards();
  loadLandingNews();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
