/* SD INPRES LELINGLUAN — Cloudflare Landing Page v2 */
const CONFIG = {
  bloggerBase: 'https://blog.sdinpreslelingluan.com',
  brandLogo: 'assets/logo.png',
  newsLabel: 'Berita',
  storyLabel: 'Story',
  galleryLabel: 'Galeri',
  newsLimit: 4,
  storyLimit: 4,
  galleryPosts: 6,
  galleryImagesPerPost: 4,
  imageSize: 's1200',
  timeout: 15000,
  schoolLinks: {
    main: 'https://blog.sdinpreslelingluan.com',
    profil: 'https://blog.sdinpreslelingluan.com/p/profil.html',
    berita: 'https://blog.sdinpreslelingluan.com/search/label/Berita',
    story: 'https://blog.sdinpreslelingluan.com/search/label/Story',
    galeri: 'https://blog.sdinpreslelingluan.com/search/label/Galeri',
    download: 'https://blog.sdinpreslelingluan.com/p/download.html',
    portalGuru: 'https://portal.sdinpreslelingluan.com',
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
    story: [],
    gallery: []
  },
  galleryItems: [],
  lightboxIndex: 0
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

function normalizeImageUrl(url, size = CONFIG.imageSize) {
  if (!url) return '';

  return String(url)
    .replace(/\/s\d+(?:-[a-zA-Z0-9-]+)?\//, `/${size}/`)
    .replace(/\/w\d+-h\d+(?:-[a-zA-Z0-9-]+)?\//, `/${size}/`);
}

function extractImagesFromHtml(html = '') {
  if (!html) return [];

  const doc = new DOMParser().parseFromString(html, 'text/html');

  return [...doc.querySelectorAll('img')]
    .map(img => ({
      src: normalizeImageUrl(img.getAttribute('src') || img.getAttribute('data-src')),
      alt: img.getAttribute('alt') || ''
    }))
    .filter(item => item.src);
}

function extractPostImages(post) {
  const images = [];

  if (post?.media$thumbnail?.url) {
    images.push({
      src: normalizeImageUrl(post.media$thumbnail.url),
      alt: postTitle(post)
    });
  }

  const htmlImages = extractImagesFromHtml(
    post?.content?.$t || post?.summary?.$t || ''
  );

  htmlImages.forEach(item => {
    if (!images.some(existing => existing.src === item.src)) {
      images.push(item);
    }
  });

  return images;
}

function firstImage(post) {
  return extractPostImages(post)[0]?.src || '';
}

function excerpt(post, max = 125) {
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

function setDynamicImage(container, imageUrl, alt = '') {
  if (!container || !imageUrl) return false;

  const current = container.querySelector('img.dynamic-img');

  if (current) {
    current.src = imageUrl;
    current.alt = alt;
  } else {
    const image = document.createElement('img');
    image.className = 'dynamic-img';
    image.src = imageUrl;
    image.alt = alt;
    image.loading = 'eager';
    image.decoding = 'async';

    image.addEventListener('error', () => {
      image.remove();
      container.classList.add('image-failed');
    }, { once: true });

    container.appendChild(image);
  }

  container.classList.add('image-ready');
  const loading = $('.image-loading', container);
  if (loading) loading.remove();

  const fallback = $('.photo-fallback', container);
  if (fallback) fallback.hidden = true;

  return true;
}

function chooseVisualImages() {
  const all = [
    ...State.posts.gallery.flatMap(post => extractPostImages(post)),
    ...State.posts.story.flatMap(post => extractPostImages(post)),
    ...State.posts.news.flatMap(post => extractPostImages(post))
  ];

  const unique = [];
  all.forEach(item => {
    if (item.src && !unique.some(current => current.src === item.src)) {
      unique.push(item);
    }
  });

  return unique;
}

function renderHeroVisuals() {
  const images = chooseVisualImages();

  const hero = images[0]?.src || '';
  const about = images[1]?.src || hero;
  const program1 = images[2]?.src || about;
  const program2 = images[3]?.src || program1;

  setDynamicImage($('#hero-photo'), hero, 'SD Inpres Lelingluan');
  setDynamicImage($('#about-photo'), about, 'Kegiatan SD Inpres Lelingluan');
  setDynamicImage($('#program-photo-1'), program1, 'Kegiatan SD Inpres Lelingluan');
  setDynamicImage($('#program-photo-2'), program2, 'Kegiatan SD Inpres Lelingluan');
}

function renderBrandLogo() {
  const logoUrl = CONFIG.brandLogo || 'assets/logo.png';

  ['#brand-logo', '#footer-logo'].forEach(selector => {
    const image = $(selector);
    if (!image) return;
    image.src = logoUrl;
    image.hidden = false;
    image.onerror = () => {
      if (!image.src.endsWith('assets/logo.png')) {
        image.src = 'assets/logo.png';
      }
    };
  });
}

function renderNews(posts) {
  const container = $('#news-container');
  if (!container) return;

  State.posts.news = posts.slice(0, CONFIG.newsLimit);

  if (!State.posts.news.length) {
    container.innerHTML =
      '<div class="loading-card">Belum ada berita dengan label Berita.</div>';
    return;
  }

  container.innerHTML = State.posts.news.map((post, index) => {
    const image = firstImage(post);
    const title = escapeHTML(postTitle(post));
    const href = escapeHTML(postUrl(post));

    return `
      <a class="news-card${index === 0 ? ' news-card-featured' : ''}"
         href="${href}" target="_blank" rel="noopener">
        ${image
          ? `<img src="${escapeHTML(image)}" alt="${title}" loading="${index === 0 ? 'eager' : 'lazy'}">`
          : '<div class="feed-fallback">BERITA</div>'}
        <div class="news-overlay">
          <small>${escapeHTML(postDate(post))} · BERITA</small>
          <b>${title}</b>
          ${index === 0
            ? `<span class="news-excerpt">${escapeHTML(excerpt(post, 135))}</span>`
            : ''}
        </div>
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
      '<div class="loading-card dark-loading">Belum ada kegiatan dengan label Story.</div>';
    return;
  }

  container.innerHTML = State.posts.story.map(post => {
    const image = firstImage(post);
    const title = escapeHTML(postTitle(post));
    const href = escapeHTML(postUrl(post));

    return `
      <a class="activity-card" href="${href}" target="_blank" rel="noopener">
        ${image
          ? `<img src="${escapeHTML(image)}" alt="${title}" loading="lazy">`
          : '<div class="activity-fallback">STORY</div>'}
        <div>
          <small>${escapeHTML(postDate(post))}</small>
          <b>${title}</b>
        </div>
      </a>
    `;
  }).join('');
}

function renderGallery(posts) {
  const container = $('#gallery-container');
  if (!container) return;

  State.posts.gallery = posts.slice(0, CONFIG.galleryPosts);
  State.galleryItems = [];

  State.posts.gallery.forEach(post => {
    const images = extractPostImages(post).slice(0, CONFIG.galleryImagesPerPost);

    images.forEach(image => {
      State.galleryItems.push({
        src: image.src,
        alt: image.alt || postTitle(post),
        title: postTitle(post),
        date: postDate(post),
        url: postUrl(post)
      });
    });
  });

  if (!State.galleryItems.length) {
    container.innerHTML =
      '<div class="loading-card">Belum ada foto dengan label Galeri.</div>';
    return;
  }

  /*
   * Maksimum 8 visual pada homepage.
   * Semua gambar tetap berasal dari posting Blogger.
   */
  State.galleryItems = State.galleryItems.slice(0, 8);

  container.innerHTML = State.galleryItems.map((item, index) => `
    <button
      class="gallery-item"
      type="button"
      data-gallery-index="${index}"
      aria-label="Buka ${escapeHTML(item.title)}"
    >
      <img
        src="${escapeHTML(item.src)}"
        alt="${escapeHTML(item.alt)}"
        loading="${index < 3 ? 'eager' : 'lazy'}"
      >
      <span>${escapeHTML(item.title)}</span>
    </button>
  `).join('');

  $$('.gallery-item', container).forEach(button => {
    button.addEventListener('click', () => {
      openLightbox(Number(button.dataset.galleryIndex) || 0);
    });
  });
}

function openLightbox(index) {
  if (!State.galleryItems.length) return;

  State.lightboxIndex =
    (index + State.galleryItems.length) % State.galleryItems.length;

  const item = State.galleryItems[State.lightboxIndex];
  const lightbox = $('#lightbox');
  const image = $('#lightbox-image');
  const caption = $('#lightbox-caption');

  if (!lightbox || !image || !caption) return;

  image.src = item.src;
  image.alt = item.alt || item.title;
  caption.textContent = `${item.title} · ${item.date}`;

  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lightbox-open');
}

function closeLightbox() {
  const lightbox = $('#lightbox');
  if (!lightbox) return;

  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lightbox-open');
}

function nextLightbox() {
  openLightbox(State.lightboxIndex + 1);
}

function previousLightbox() {
  openLightbox(State.lightboxIndex - 1);
}

function initLightbox() {
  $('#lightbox-close')?.addEventListener('click', closeLightbox);
  $('#lightbox-next')?.addEventListener('click', nextLightbox);
  $('#lightbox-prev')?.addEventListener('click', previousLightbox);

  $('#lightbox')?.addEventListener('click', event => {
    if (event.target.id === 'lightbox') closeLightbox();
  });

  document.addEventListener('keydown', event => {
    if (!$('#lightbox')?.classList.contains('open')) return;

    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowRight') nextLightbox();
    if (event.key === 'ArrowLeft') previousLightbox();
  });
}

function initMobileMenu() {
  const button = $('#menu-btn');
  const menu = $('#mobile-menu');

  if (!button || !menu) return;

  button.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
  });

  $$('#mobile-menu a').forEach(link => {
    link.addEventListener('click', () => {
      menu.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
    });
  });
}

function initHeader() {
  const header = $('#site-header');
  if (!header) return;

  const update = () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  };

  update();
  window.addEventListener('scroll', update, { passive: true });
}

function initReveal() {
  const elements = $$('.reveal:not(.visible)');

  if (!('IntersectionObserver' in window)) {
    elements.forEach(element => element.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  elements.forEach(element => observer.observe(element));
}

function finishLoader() {
  const loader = $('#page-loader');
  if (!loader) return;

  loader.classList.add('loaded');

  setTimeout(() => {
    loader.remove();
  }, 700);
}

async function loadLandingContent() {
  const results = await Promise.allSettled([
    jsonpFeed(CONFIG.newsLabel, CONFIG.newsLimit),
    jsonpFeed(CONFIG.storyLabel, CONFIG.storyLimit),
    jsonpFeed(CONFIG.galleryLabel, CONFIG.galleryPosts)
  ]);

  const [news, story, gallery] = results;

  if (news.status === 'fulfilled') {
    renderNews(news.value);
  } else {
    $('#news-container').innerHTML =
      '<div class="loading-card">Berita belum dapat dimuat. Periksa koneksi ke Blogger.</div>';
  }

  if (story.status === 'fulfilled') {
    renderStory(story.value);
  } else {
    $('#story-container').innerHTML =
      '<div class="loading-card dark-loading">Kegiatan belum dapat dimuat.</div>';
  }

  if (gallery.status === 'fulfilled') {
    renderGallery(gallery.value);
  } else {
    $('#gallery-container').innerHTML =
      '<div class="loading-card">Galeri belum dapat dimuat.</div>';
  }

  renderHeroVisuals();
  renderBrandLogo();
}

async function init() {
  initHeader();
  initMobileMenu();
  initLightbox();
  initReveal();

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
