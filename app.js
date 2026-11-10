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
          <a class="inline-flex items-center gap-1 text-[11px] sm:text-label-sm text-primary font-bold hover:underline" href="${href}" target="_blank" rel="noopener">
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
        tab.className = 'flex flex-col items-center justify-center text-primary font-bold py-1 px-3 active:scale-95 transition-transform duration-100';
        if (icon) icon.style.fontVariationSettings = "'FILL' 1, 'wght' 500";
        if (text) text.classList.add('font-bold');
      } else {
        tab.className = 'flex flex-col items-center justify-center text-on-surface-variant py-1 px-3 hover:text-primary active:scale-95 transition-transform duration-100';
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

// ── Firebase Realtime Visitor Tracking ───────────────────
function initVisitorTracking() {
  const onlineElements = $$('.live-online-count');
  const totalElements = $$('.live-total-visits');

  if (typeof firebase === 'undefined') return;

  const firebaseConfig = {
    apiKey: "AIzaSyBFt6boJNvB1oV0eusQZPlvybr_OXd_dSI",
    authDomain: "attendez-2k0ks.firebaseapp.com",
    databaseURL: "https://attendez-2k0ks-default-rtdb.asia-southeast1.firebasedatabase.app",
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

    // 1. Online Users
    connectedRef.on('value', snap => {
      if (snap.val() === true) {
        const sessionRef = onlineRef.push();
        sessionRef.onDisconnect().remove();
        sessionRef.set(true);
      }
    });

    onlineRef.on('value', snap => {
      const activeSessions = snap.numChildren();
      const count = activeSessions > 0 ? activeSessions : 1;
      onlineElements.forEach(el => {
        el.textContent = `${count} Online`;
      });
    });

    // 2. Total Visits
    const hasVisited = sessionStorage.getItem('hasVisited');
    if (!hasVisited) {
      totalRef.transaction(currentTotal => (currentTotal || 0) + 1);
      sessionStorage.setItem('hasVisited', 'true');
    }

    totalRef.on('value', snap => {
      const total = snap.val() || 0;
      const formatted = total.toLocaleString('id-ID');
      totalElements.forEach(el => {
        el.textContent = `${formatted} Kunjungan`;
      });
    });
  } catch (error) {
    console.error('Firebase tracking error:', error);
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
