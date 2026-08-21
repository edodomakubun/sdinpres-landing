/* SD INPRES LELINGLUAN — Cloudflare Landing Page v2 */
const CONFIG = {
  bloggerBase: 'https://blog.sdinpreslelingluan.com',
  brandLogo: 'assets/logo.png',
  newsLabel: 'Berita',
  storyLabel: 'Story',
  newsLimit: 4,
  storyLimit: 4,
  timeout: 15000,
  schoolLinks: {
    main: 'https://blog.sdinpreslelingluan.com',
    profil: 'https://blog.sdinpreslelingluan.com/p/profil.html',
    berita: 'https://blog.sdinpreslelingluan.com/search/label/Berita',
    story: 'https://blog.sdinpreslelingluan.com/search/label/Story',
    galeri: 'https://blog.sdinpreslelingluan.com/search/label/Galeri',
    download: 'https://blog.sdinpreslelingluan.com/p/download.html',
    portalGuru: 'https://portalguru.sdinpreslelingluan.com',
    portalSiswa: 'https://portalsiswa.sdinpreslelingluan.com',
    spmb: 'https://spmb2026.sdinpreslelingluan.com',
    archive: 'https://archive-sdinleling.blogspot.com',
    postArtikel: 'https://postartikel.sdinpreslelingluan.com',
    jurnalGuru: 'https://jurnal.sdinpreslelingluan.com',
    presensiGuru: 'https://siakad.sdinpreslelingluan.com'
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const State = {
  posts: {
    news: [],
    story: []
  }
};

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
  return post?.title?.$t || 'Tanpa judul';
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
    : 'Info terbaru';
}

function excerpt(post, max = 130) {
  const html = post?.summary?.$t || post?.content?.$t || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();

  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function jsonpFeed(label, limit) {
  return new Promise((resolve, reject) => {
    const callbackName =
      `__sdinpres_${Date.now()}_${Math.random().toString(36).slice(2)}`;

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

      const entries = Array.isArray(payload?.feed?.entry)
        ? payload.feed.entry
        : [];

      resolve(entries);
    };

    script.onerror = () => {
      fail(new Error(`Feed ${label} gagal dimuat`));
    };

    const endpoint =
      `${CONFIG.bloggerBase}/feeds/posts/default/-/${encodeURIComponent(label)}` +
      `?alt=json-in-script&max-results=${Number(limit) || 4}` +
      `&orderby=published&callback=${callbackName}`;

    script.async = true;
    script.src = endpoint;
    document.body.appendChild(script);
  });
}

function renderBrandLogo() {
  const logoUrl = CONFIG.brandLogo || 'assets/logo.png';
  ['#brand-logo', '#footer-logo'].forEach(selector => {
    const image = $(selector);
    if (!image) return;
    image.src = logoUrl;
    image.onerror = () => { image.src = 'assets/logo.png'; };
  });
}

function renderNews(posts) {
  const container = $('#news-container');
  if (!container) return;

  State.posts.news = posts.slice(0, CONFIG.newsLimit);

  if (!State.posts.news.length) {
    container.innerHTML =
      '<div class="loading-placeholder-box">Belum ada berita terbaru saat ini. Kunjungi arsip berita untuk informasi lengkap.</div>';
    return;
  }

  container.innerHTML = State.posts.news.map(post => {
    const title = escapeHTML(postTitle(post));
    const href = escapeHTML(postUrl(post));
    const date = escapeHTML(postDate(post));
    const desc = escapeHTML(excerpt(post));
    return `
      <a class="news-card-editorial" href="${href}" target="_blank" rel="noopener">
        <div class="news-card-badge">BERITA SEKOLAH</div>
        <div class="news-card-date">${date}</div>
        <b class="news-card-title">${title}</b>
        <p class="news-card-desc">${desc}</p>
        <span class="news-card-link">Baca Selengkapnya ↗</span>
      </a>
    `;
  }).join('');
}

function renderStory(posts) {
  const container = $('#story-container');
  if (!container) return;

  State.posts.story = posts.slice(0, CONFIG.storyLimit);

  if (!State.posts.story.length) {
    container.innerHTML =
      '<div class="loading-placeholder-box dark">Belum ada dokumentasi kegiatan publik saat ini.</div>';
    return;
  }

  container.innerHTML = State.posts.story.map(post => {
    const title = escapeHTML(postTitle(post));
    const href = escapeHTML(postUrl(post));
    const date = escapeHTML(postDate(post));
    const desc = escapeHTML(excerpt(post, 100));

    return `
      <a class="activity-card-modern" href="${href}" target="_blank" rel="noopener">
        <span class="activity-tag">KEGIATAN</span>
        <span class="activity-date">${date}</span>
        <b class="activity-title">${title}</b>
        <p class="activity-desc">${desc}</p>
        <span class="activity-read-more">Lihat Kegiatan ↗</span>
      </a>
    `;
  }).join('');
}

function initHeader() {
  const header = $('#site-header');
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initMobileMenu() {
  const btn = $('#menu-btn');
  const menu = $('#mobile-menu');
  const iconMenu  = $('#icon-menu');
  const iconClose = $('#icon-close');

  if (!btn || !menu) return;

  const toggle = (open = !menu.classList.contains('open')) => {
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (iconMenu)  iconMenu.style.display  = open ? 'none'  : 'block';
    if (iconClose) iconClose.style.display = open ? 'block' : 'none';
  };

  btn.addEventListener('click', () => toggle());
  $$('a', menu).forEach(link => link.addEventListener('click', () => toggle(false)));
}

function initReveal() {
  const elements = $$('.reveal:not(.visible)');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1 });

  elements.forEach(element => observer.observe(element));
}

function finishLoader() {
  const loader = $('#page-loader');
  if (!loader) return;
  loader.classList.add('loaded');
  setTimeout(() => loader.remove(), 500);
}

async function loadLandingContent() {
  const results = await Promise.allSettled([
    jsonpFeed(CONFIG.newsLabel, CONFIG.newsLimit),
    jsonpFeed(CONFIG.storyLabel, CONFIG.storyLimit)
  ]);

  const [news, story] = results;

  if (news.status === 'fulfilled') {
    renderNews(news.value);
  } else {
    const newsContainer = $('#news-container');
    if (newsContainer) {
      newsContainer.innerHTML =
        '<div class="loading-placeholder-box">Berita belum dapat dimuat saat ini. Silakan kunjungi website utama sekolah.</div>';
    }
  }

  if (story.status === 'fulfilled') {
    renderStory(story.value);
  } else {
    const storyContainer = $('#story-container');
    if (storyContainer) {
      storyContainer.innerHTML =
        '<div class="loading-placeholder-box dark">Dokumentasi kegiatan belum dapat dimuat saat ini.</div>';
    }
  }

  renderBrandLogo();
}

async function init() {
  initHeader();
  initMobileMenu();
  initReveal();
  initVisitorTracking();

  try {
    await loadLandingContent();
  } finally {
    finishLoader();
    initReveal();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

// ── Firebase Realtime Visitor Tracking ────────────────────
function initVisitorTracking() {
  const widget = $('#visitor-widget');
  const onlineEl = $('#online-count');
  const totalEl = $('#total-visits');
  if (!widget || !onlineEl || !totalEl || typeof firebase === 'undefined') return;

  // Placeholder Config - Gantilah dengan konfigurasi Firebase Anda
  // Anda wajib memasukkan firebaseConfig Anda dari Firebase Console di bawah ini
  const firebaseConfig = {
    apiKey: "AIzaSyBFt6boJNvB1oV0eusQZPlvybr_OXd_dSI",
    authDomain: "attendez-2k0ks.firebaseapp.com",
    databaseURL: "https://attendez-2k0ks-default-rtdb.firebaseio.com",
    projectId: "attendez-2k0ks",
    storageBucket: "attendez-2k0ks.firebasestorage.app",
    messagingSenderId: "1082706342744",
    appId: "1:1082706342744:web:2a5988aa01351bc715ab2d"
  };

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    const db = firebase.database();
    const onlineRef = db.ref('stats/onlineUsers');
    const totalRef = db.ref('stats/totalVisits');
    const connectedRef = db.ref('.info/connected');

    // 1. Hitung Pengunjung Online
    connectedRef.on('value', (snap) => {
      if (snap.val() === true) {
        const sessionRef = onlineRef.push();
        
        // Ketika user disconnect, hapus sesi dari Firebase
        sessionRef.onDisconnect().remove();
        
        // Tandai user ini sebagai online
        sessionRef.set(true);
      }
    });

    onlineRef.on('value', (snap) => {
      const activeSessions = snap.numChildren();
      // Selalu minimal 1 (karena user yang sedang membuka web ini juga online)
      onlineEl.textContent = activeSessions > 0 ? activeSessions : 1;
      widget.setAttribute('aria-hidden', 'false');
    });

    // 2. Hitung Total Kunjungan
    // Cek sessionStorage agar tidak bertambah saat tab di-refresh di sesi yang sama
    const hasVisited = sessionStorage.getItem('hasVisited');
    if (!hasVisited) {
      totalRef.transaction((currentTotal) => {
        return (currentTotal || 0) + 1;
      });
      sessionStorage.setItem('hasVisited', 'true');
    }

    totalRef.on('value', (snap) => {
      const total = snap.val() || 0;
      totalEl.textContent = total.toLocaleString('id-ID');
    });

  } catch (error) {
    console.error('Firebase tracking error:', error);
    // Sembunyikan widget jika terjadi error inisialisasi
    if (widget) widget.style.display = 'none';
  }
}
