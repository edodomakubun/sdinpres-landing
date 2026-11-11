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
  'Googlebot'
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
    
    // Tentukan URL gambar untuk Open Graph:
    // WA / FB memerlukan URL HTTPS biner asli, BUKAN string data base64!
    let ogImageUrl = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh7fRJe9SVBEej0swcVC4DM7hCsCrH-RTrh8f7bjetyGiuwXQ3DV6bvM2f-gEsF67S5Tlh7-VM-zLbuc_nR5X-VRsdqgILF_qUBhC8EG6getFTTbI4xJkPJRxFPf2UbibB2KyYwVt1_nnvNITK3Q3oNfyxU4nxTc7aGiASXRbiUWf31i5nKThNzZTZGQ5P5/s1280/img1.jpeg';
    
    const ytId = extractYouTubeVideoId(videoUrl);
    if (ytId && !hasBase64) {
      ogImageUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    } else if (hasBase64) {
      ogImageUrl = `${url.origin}/api/image/${encodeURIComponent(slug)}`;
    }

    const postFullUrl = `${url.origin}/praktik-baik.html?slug=${encodeURIComponent(slug)}`;

    // 4. Ambil respon HTML asli
    const response = await next();
    let html = await response.text();

    // 5. Gantikan Meta Tag Open Graph & Twitter Card khusus crawler
    html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)} — SD Inpres Lelingluan</title>`);
    html = html.replace(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)} — SD Inpres Lelingluan">`);
    html = html.replace(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(summary)}">`);
    html = html.replace(/<meta property="og:image"[^>]*>/i, `<meta property="og:image" content="${ogImageUrl}">`);
    html = html.replace(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${postFullUrl}">`);
    html = html.replace(/<meta name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)} — SD Inpres Lelingluan">`);
    html = html.replace(/<meta name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(summary)}">`);
    html = html.replace(/<meta name="twitter:image"[^>]*>/i, `<meta name="twitter:image" content="${ogImageUrl}">`);

    return new Response(html, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers),
        'Content-Type': 'text/html; charset=utf-8'
      }
    });

  } catch (err) {
    console.error('Middleware error for bot scraper:', err);
    return next();
  }
}

