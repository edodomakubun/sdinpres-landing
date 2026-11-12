/* SD INPRES LELINGLUAN — Portal Resmi & Layanan Digital Terpadu */
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
  container.innerHTML = validPosts.map((post, idx) => {
    const title = escapeHTML(postTitle(post));
    const href = escapeHTML(postUrl(post));
    const date = escapeHTML(postDate(post));
    const desc = escapeHTML(excerpt(post));
    const thumb = escapeHTML(postThumbnail(post));

    const categoryThemes = [
      { bg: 'bg-[#EFF6FF]', text: 'text-primary', label: 'Kesehatan' },
      { bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', label: 'Seni & Budaya' },
      { bg: 'bg-[#ECFDF5]', text: 'text-[#047857]', label: 'Guru & KBM' },
      { bg: 'bg-[#F5F3FF]', text: 'text-[#6D28D9]', label: 'Kesiswaan' }
    ];
    const cat = categoryThemes[idx % categoryThemes.length];

    return `
      <article class="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
        <div>
          <div class="h-32 sm:h-36 md:h-44 w-full bg-surface-container overflow-hidden relative">
            <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="${thumb}" alt="${title}" loading="lazy">
            <span class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full ${cat.bg} ${cat.text} text-[10px] font-bold shadow-xs">
              ${cat.label}
            </span>
          </div>
          <div class="p-3.5 sm:p-4">
            <div class="flex items-center gap-1.5 text-outline text-[11px] mb-1.5">
              <span class="material-symbols-outlined text-[14px]">calendar_today</span>
              <span>${date}</span>
            </div>
            <h3 class="font-headline-sm text-[13px] sm:text-[14px] md:text-[15px] leading-tight text-on-surface font-bold line-clamp-2 group-hover:text-primary transition-colors">
              ${title}
            </h3>
            <p class="font-body-sm text-[11px] sm:text-[12px] text-on-surface-variant mt-1.5 line-clamp-2 leading-relaxed">
              ${desc}
            </p>
          </div>
        </div>
        <div class="p-3.5 sm:p-4 pt-0">
          <a class="inline-flex items-center gap-1 text-[11px] sm:text-label-sm text-primary font-bold hover:underline" href="${href}">
            <span>Baca Selengkapnya</span>
            <span class="material-symbols-outlined text-[13px]">arrow_forward</span>
          </a>
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
        tab.className = 'flex flex-col items-center justify-center text-primary font-bold py-1 px-0.5 active:scale-95 transition-transform duration-100 min-w-0';
        if (icon) icon.style.fontVariationSettings = "'FILL' 1, 'wght' 500";
        if (text) text.classList.add('font-bold');
      } else {
        tab.className = 'flex flex-col items-center justify-center text-on-surface-variant py-1 px-0.5 hover:text-primary active:scale-95 transition-transform duration-100 min-w-0';
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
        target.scrollIntoView({ behavior: 'smooth' });
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

// ── FAQ Accordion Toggle Helper ──────────────────────────
function initFaqAccordion() {
  const faqItems = $$('#faq details');
  faqItems.forEach(item => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        // Optional: close other items for an accordion experience
        faqItems.forEach(other => {
          if (other !== item && other.open) {
            other.removeAttribute('open');
          }
        });
      }
    });
  });
}

// ── Firebase Firestore Site Visits & Realtime Online Tracking ──
const SITE_STATS_DOC_ID = 'site-stats';
const LOCAL_SITE_VISITS_KEY = 'sdinpres_site_visits_backup';
let hasCountedSiteVisit = false;

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
      el.innerHTML = `<span class="material-symbols-outlined text-[14px] text-primary shrink-0">visibility</span> <span class="visit-count-text">${formatted} Kunjungan</span>`;
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
      el.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#10B981] animate-pulse shrink-0"></span> <span class="online-count-text">${safeCount} Online</span>`;
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
  } catch {}

  try {
    const [
      { initializeApp, getApps, getApp },
      { getFirestore, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp },
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

    // 2. Total Kunjungan Halaman Utama (Cloud Firestore — cara kerja identik dengan view postingan)
    if (totalElements.length && !hasCountedSiteVisit) {
      hasCountedSiteVisit = true;
      const db = getFirestore(app);
      const statsRef = doc(db, 'posts', SITE_STATS_DOC_ID);

      try {
        const snap = await getDoc(statsRef);
        if (snap.exists()) {
          const currentViews = Number(snap.data()?.views) || 0;
          const newViews = currentViews + 1;
          updateSiteVisitsDisplay(newViews);
          try {
            localStorage.setItem(LOCAL_SITE_VISITS_KEY, String(newViews));
          } catch {}

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
          } catch {}

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
        } catch {}
      }
    }
  } catch (error) {
    console.warn('Pelacakan kunjungan beralih ke cadangan lokal:', error);
    if (!hasCountedSiteVisit && totalElements.length) {
      hasCountedSiteVisit = true;
      const fallbackVisits = cachedVisits + 1;
      updateSiteVisitsDisplay(fallbackVisits);
      try {
        localStorage.setItem(LOCAL_SITE_VISITS_KEY, String(fallbackVisits));
      } catch {}
    }
  }
}

// ── Desktop Visi & Misi Slide Bar ────────────────────────
function initVisiMisiSlider() {
  const slides = [
    {
      badgeLabel: 'VISI',
      badgeClass: 'bg-[#F59E0B] text-slate-900',
      text: '“Menjadi sekolah unggul yang melahirkan generasi penerus bangsa yang literat, cerdas, berkarakter mulia, dan tangguh dalam menghadapi berbagai tantangan, serta menciptakan lingkungan belajar yang aman, nyaman, inklusif dan Religius.”'
    },
    {
      badgeLabel: 'MISI 1',
      badgeClass: 'bg-[#00288e] text-white',
      text: '1. Meningkatkan skor literasi siswa melalui program pembinaan minat baca dan literasi secara berkelanjutan.'
    },
    {
      badgeLabel: 'MISI 2',
      badgeClass: 'bg-[#00288e] text-white',
      text: '2. Menanamkan nilai-nilai moral dan budi pekerti luhur melalui pembinaan karakter dan akhlak mulia.'
    },
    {
      badgeLabel: 'MISI 3',
      badgeClass: 'bg-[#00288e] text-white',
      text: '3. Meningkatkan kompetensi guru dalam merancang pembelajaran inovatif melalui pelatihan berkala.'
    },
    {
      badgeLabel: 'MISI 4',
      badgeClass: 'bg-[#00288e] text-white',
      text: '4. Mewujudkan sekolah yang aman dan nyaman melalui program anti-bullying dan penanggulangan kekerasan.'
    }
  ];

  let currentIndex = 0;
  let timer = null;
  const container = document.getElementById('visi-misi-slider');
  const badgeEl = document.getElementById('visi-misi-badge');
  const textEl = document.getElementById('visi-misi-text');
  const dotsContainer = document.getElementById('visi-misi-dots');
  const prevBtn = document.getElementById('visi-misi-prev');
  const nextBtn = document.getElementById('visi-misi-next');

  if (!container || !badgeEl || !textEl) return;

  function updateDots(activeIdx) {
    if (!dotsContainer) return;
    const dots = dotsContainer.querySelectorAll('button');
    dots.forEach((dot, idx) => {
      if (idx === activeIdx) {
        dot.className = 'w-6 h-2 rounded-full bg-[#00288e] transition-all duration-300';
      } else {
        dot.className = 'w-2 h-2 rounded-full bg-slate-300 hover:bg-slate-400 transition-all duration-300';
      }
    });
  }

  function renderSlide(index) {
    const item = slides[index];
    textEl.style.opacity = '0';
    textEl.style.transform = 'translateY(-4px)';

    setTimeout(() => {
      badgeEl.className = `px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 transition-colors duration-200 shadow-2xs ${item.badgeClass}`;
      badgeEl.textContent = item.badgeLabel;
      textEl.textContent = item.text;
      textEl.setAttribute('title', item.text);
      updateDots(index);

      textEl.style.transform = 'translateY(4px)';
      requestAnimationFrame(() => {
        textEl.style.opacity = '1';
        textEl.style.transform = 'translateY(0)';
      });
    }, 180);
  }

  function nextSlide() {
    currentIndex = (currentIndex + 1) % slides.length;
    renderSlide(currentIndex);
  }

  function prevSlide() {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    renderSlide(currentIndex);
  }

  function startAutoplay() {
    stopAutoplay();
    timer = setInterval(nextSlide, 6000);
  }

  function stopAutoplay() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Generate indicator dots
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    slides.forEach((slide, idx) => {
      const dot = document.createElement('button');
      dot.setAttribute('type', 'button');
      dot.setAttribute('aria-label', `Pindah ke slide ${slide.badgeLabel}`);
      dot.className = idx === 0
        ? 'w-6 h-2 rounded-full bg-[#00288e] transition-all duration-300'
        : 'w-2 h-2 rounded-full bg-slate-300 hover:bg-slate-400 transition-all duration-300';
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

  container.addEventListener('mouseenter', stopAutoplay);
  container.addEventListener('mouseleave', startAutoplay);

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
