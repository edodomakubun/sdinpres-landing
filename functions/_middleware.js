/**
 * Cloudflare Pages Middleware for Open Graph & Social Media Crawlers
 * 
 * Mendeteksi scraper media sosial (WhatsApp, Facebook, Twitter, Telegram, LinkedIn, dll.)
 * dan menyuntikkan meta tag og:title, og:description, og:image, og:url yang akurat
 * dari Cloud Firestore ke dalam HTML sebelum dikirimkan ke crawler.
 */

const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'WhatsApp',
  'Twitterbot',
  'TelegramBot',
  'LinkedInBot',
  'Pinterest',
  'Slackbot',
  'Googlebot',
  'Discordbot',
  'SkypeUriPreview',
  'Applebot',
  'bingbot'
];

function isBot(userAgent) {
  if (!userAgent) return false;
  return BOT_USER_AGENTS.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));
}

function extractYouTubeVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/|watch\?.+&v=))([\w-]{11})/);
  return (match && match[1]) ? match[1] : null;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';

  // 1. Jika bukan crawler bot media sosial, lanjutkan halaman statis normal tanpa jeda
  if (!isBot(userAgent)) {
    return next();
  }

  // 2. Ambil slug dari query parameter (?slug= atau ?post=) atau path /post/:slug
  let slug = url.searchParams.get('slug') || url.searchParams.get('post');
  if (!slug && url.pathname.startsWith('/post/')) {
    slug = url.pathname.replace(/^\/post\//, '').replace(/\/$/, '');
  }

  // Bersihkan ekstensi jika ada (.html dsb.)
  if (slug) {
    slug = slug.replace(/\.html$/i, '');
  }

  // Jika bot mengakses halaman beranda umum tanpa slug spesifik, sajikan normal
  if (!slug) {
    return next();
  }

  try {
    // 3. Ambil data postingan langsung dari REST API Cloud Firestore
    const firestoreUrl = 'https://firestore.googleapis.com/v1/projects/attendez-2k0ks/databases/(default)/documents/posts';
    const firestoreRes = await fetch(firestoreUrl);
    
    if (!firestoreRes.ok) {
      return next();
    }

    const data = await firestoreRes.json();
    const docs = data.documents || [];
    
    // Cari dokumen yang slug atau id-nya cocok
    const postDoc = docs.find(d => {
      const docSlug = d.fields?.slug?.stringValue || '';
      const docId = d.name?.split('/').pop() || '';
      const docStatus = d.fields?.status?.stringValue || '';
      const docType = d.fields?.type?.stringValue || '';
      if (docId === 'site-stats' || docStatus === 'system' || docType === 'site_stats') return false;
      return docSlug.toLowerCase() === slug.toLowerCase() || docId.toLowerCase() === slug.toLowerCase();
    });

    if (!postDoc) {
      return next();
    }

    const fields = postDoc.fields || {};
    const title = fields.title?.stringValue || 'Praktik Baik — SD Inpres Lelingluan';
    const summary = fields.summary?.stringValue || fields.content?.stringValue?.substring(0, 160) || 'Ruang berbagi praktik baik pendidikan SD Inpres Lelingluan.';
    const videoUrl = fields.videoUrl?.stringValue || '';
    const hasBase64 = Boolean(fields.coverImageBase64?.stringValue);
    const ytId = extractYouTubeVideoId(videoUrl);

    // Tentukan URL gambar untuk Open Graph:
    // WhatsApp dan Facebook memerlukan gambar JPEG/PNG biner asli dengan URL publik HTTPS.
    let ogImageUrl = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh7fRJe9SVBEej0swcVC4DM7hCsCrH-RTrh8f7bjetyGiuwXQ3DV6bvM2f-gEsF67S5Tlh7-VM-zLbuc_nR5X-VRsdqgILF_qUBhC8EG6getFTTbI4xJkPJRxFPf2UbibB2KyYwVt1_nnvNITK3Q3oNfyxU4nxTc7aGiASXRbiUWf31i5nKThNzZTZGQ5P5/s1280/img1.jpeg';
    
    if (ytId) {
      // Thumbnail YouTube resmi Google CDN adalah file JPEG murni berkualitas tinggi (paling kompatibel dgn WA/FB)
      ogImageUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    } else if (hasBase64) {
      // Foto cover kustom yang diunggah dilayani via edge binary endpoint biner dengan ekstensi .jpg
      ogImageUrl = `${url.origin}/api/image/${encodeURIComponent(slug)}.jpg`;
    }

    // URL kanonikal postingan (selalu bersih tanpa .html agar tidak memicu 308 redirect)
    const canonicalPostUrl = `${url.origin}/praktik-baik?slug=${encodeURIComponent(slug)}`;

    // 4. Ambil respon HTML asli praktik-baik secara langsung tanpa memicu redirect 308/302
    let html = '';
    try {
      if (context.env && context.env.ASSETS) {
        const assetRes = await context.env.ASSETS.fetch(new URL('/praktik-baik', request.url));
        if (assetRes.ok) {
          html = await assetRes.text();
        }
      }
    } catch (e) {
      console.warn('ASSETS.fetch failed:', e);
    }

    if (!html) {
      try {
        const originRes = await fetch(new URL('/praktik-baik', request.url));
        if (originRes.ok) {
          html = await originRes.text();
        }
      } catch (e) {
        console.warn('Origin fetch failed:', e);
      }
    }

    if (!html) {
      const response = await next();
      html = await response.text();
    }

    // 5. Gantikan <title>
    html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)} — SD Inpres Lelingluan</title>`);

    // 6. Buat blok Open Graph & Twitter Card lengkap dan valid
    const ogTags = `
  <!-- Open Graph / WhatsApp / Facebook Meta Tags -->
  <meta property="og:site_name" content="SD Inpres Lelingluan">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(title)} — SD Inpres Lelingluan">
  <meta property="og:description" content="${escapeHtml(summary)}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:secure_url" content="${ogImageUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  <meta property="og:url" content="${canonicalPostUrl}">

  <!-- Twitter Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)} — SD Inpres Lelingluan">
  <meta name="twitter:description" content="${escapeHtml(summary)}">
  <meta name="twitter:image" content="${ogImageUrl}">
    `.trim();

    // Hapus meta tags Open Graph dan Twitter lama dari HTML dasar, lalu sisipkan yang baru ke dalam <head>
    html = html.replace(/<meta property="og:[^>]*>/gi, '');
    html = html.replace(/<meta name="twitter:[^>]*>/gi, '');
    html = html.replace(/<\/head>/i, `  ${ogTags}\n</head>`);

    // Kembalikan langsung HTTP 200 OK ke crawler tanpa redirect
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600'
      }
    });

  } catch (err) {
    console.error('Middleware error for bot scraper:', err);
    return next();
  }
}
