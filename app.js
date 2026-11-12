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
        <article class="lg:col-span-6 lg:row-span-3 bg-white border border-[#D8D3C8] rounded-lg overflow-hidden flex flex-col justify-between group hover:border-[#00288E] transition-colors">
          <div>
            <div class="aspect-[16/10] w-full bg-[#EFECE4] overflow-hidden border-b border-[#D8D3C8]">
              <img class="w-full h-full object-cover" src="${thumb}" alt="${title}" width="640" height="400" loading="lazy" decoding="async">
            </div>
            <div class="p-5 sm:p-6">
              <div class="flex flex-wrap items-center gap-2.5 mb-3">
                <span class="px-2 py-0.5 rounded-xs text-[11px] font-bold uppercase tracking-wider ${cat.bg} ${cat.text}">${cat.label}</span>
                <span class="text-xs text-[#475569] tabular-nums">${date}</span>
              </div>
              <h3 class="font-display text-xl sm:text-2xl leading-snug text-[#111827] font-semibold group-hover:text-[#00288E] transition-colors">
                ${title}
              </h3>
              <p class="text-sm text-[#475569] mt-2.5 leading-relaxed max-w-[65ch]">
                ${desc}
              </p>
            </div>
          </div>
          <div class="px-5 sm:px-6 pb-5 pt-2 border-t border-[#EFECE4]">
            <a class="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-[#00288E] font-bold hover:underline" href="${href}">
              <span>Baca selengkapnya</span>
              <span class="visually-hidden">: ${title}</span>
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
            </a>
          </div>
        </article>
      `;
    }

    return `
      <article class="lg:col-span-6 bg-white border border-[#D8D3C8] rounded-lg overflow-hidden flex flex-col sm:flex-row group hover:border-[#00288E] transition-colors">
        <div class="sm:w-44 md:w-48 aspect-[16/10] sm:aspect-auto bg-[#EFECE4] overflow-hidden shrink-0 border-b sm:border-b-0 sm:border-r border-[#D8D3C8]">
          <img class="w-full h-full object-cover" src="${thumb}" alt="${title}" width="320" height="220" loading="lazy" decoding="async">
        </div>
        <div class="p-4 sm:p-5 flex flex-col justify-between flex-1 min-w-0">
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-1.5">
              <span class="px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-wider ${cat.bg} ${cat.text}">${cat.label}</span>
              <span class="text-xs text-[#475569] tabular-nums">${date}</span>
            </div>
            <h3 class="font-display text-base sm:text-lg leading-snug text-[#111827] font-semibold line-clamp-2 group-hover:text-[#00288E] transition-colors">
              ${title}
            </h3>
            <p class="text-xs sm:text-sm text-[#475569] mt-1.5 line-clamp-2 leading-relaxed">
              ${desc}
            </p>
          </div>
          <div class="mt-2 pt-2 border-t border-[#EFECE4]">
            <a class="inline-flex items-center gap-1 min-h-[44px] text-xs sm:text-sm text-[#00288E] font-bold hover:underline" href="${href}">
              <span>Baca selengkapnya</span>
              <span class="visually-hidden">: ${title}</span>
              <span class="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_forward</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');
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
        tab.className = 'flex flex-col items-center justify-center min-h-[44px] text-[#00288E] font-bold py-1.5 px-1 border-t-2 border-[#00288E] -mt-[1px] min-w-0';
        tab.setAttribute('aria-current', 'location');
        if (icon) icon.style.fontVariationSettings = "'FILL' 1, 'wght' 500";
        if (text) text.classList.add('font-bold');
      } else {
        tab.className = 'flex flex-col items-center justify-center min-h-[44px] text-[#475569] py-1.5 px-1 hover:text-[#00288E] border-t-2 border-transparent -mt-[1px] min-w-0';
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
        ? 'block w-5 h-1.5 rounded-xs bg-[#00288E] transition-colors'
        : 'block w-2 h-1.5 rounded-xs bg-[#C7C1B5] group-hover:bg-[#64748B] transition-colors';
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

// ── Application Bootstrap ────────────────────────────────
function init() {
  initSmoothScroll();
  initBlogLinks();
  initScrollspy();
  initFaqAccordion();
  initVisitorTracking();
  initVisiMisiSlider();
  loadLandingNews();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
