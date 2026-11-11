/**
 * Cloudflare Pages Function: Dynamic Binary Image Server
 * 
 * Melayani gambar cover Base64 dari Firestore sebagai file biner asli (JPEG/WebP)
 * yang dapat di-cache dan dibaca oleh scraper WhatsApp, Facebook, Twitter, dan media sosial lainnya.
 */

function extractYouTubeVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/|watch\?.+&v=))([\w-]{11})/);
  return (match && match[1]) ? match[1] : null;
}

export async function onRequest(context) {
  const { params } = context;
  const slug = params.slug;

  const defaultImageUrl = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh7fRJe9SVBEej0swcVC4DM7hCsCrH-RTrh8f7bjetyGiuwXQ3DV6bvM2f-gEsF67S5Tlh7-VM-zLbuc_nR5X-VRsdqgILF_qUBhC8EG6getFTTbI4xJkPJRxFPf2UbibB2KyYwVt1_nnvNITK3Q3oNfyxU4nxTc7aGiASXRbiUWf31i5nKThNzZTZGQ5P5/s1280/img1.jpeg';

  if (!slug) {
    return Response.redirect(defaultImageUrl, 302);
  }

  try {
    const firestoreUrl = 'https://firestore.googleapis.com/v1/projects/attendez-2k0ks/databases/(default)/documents/posts';
    const res = await fetch(firestoreUrl);
    if (!res.ok) {
      return Response.redirect(defaultImageUrl, 302);
    }

    const data = await res.json();
    const docs = data.documents || [];

    const postDoc = docs.find(d => {
      const docSlug = d.fields?.slug?.stringValue || '';
      const docId = d.name?.split('/').pop() || '';
      return docSlug.toLowerCase() === slug.toLowerCase() || docId.toLowerCase() === slug.toLowerCase();
    });

    if (!postDoc) {
      return Response.redirect(defaultImageUrl, 302);
    }

    const fields = postDoc.fields || {};
    const base64Str = fields.coverImageBase64?.stringValue || '';
    const videoUrl = fields.videoUrl?.stringValue || '';

    // Jika tidak ada gambar base64 tapi ada video YouTube, alihkan ke thumbnail YouTube
    if (!base64Str && videoUrl) {
      const ytId = extractYouTubeVideoId(videoUrl);
      if (ytId) {
        return Response.redirect(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`, 302);
      }
    }

    // Jika ada gambar Base64, decode menjadi byte biner murni
    if (base64Str.startsWith('data:')) {
      const commaIdx = base64Str.indexOf(',');
      const header = base64Str.substring(0, commaIdx);
      const base64Data = base64Str.substring(commaIdx + 1);
      
      const mimeMatch = header.match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      return new Response(bytes, {
        headers: {
          'Content-Type': mime,
          'Content-Length': len.toString(),
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return Response.redirect(defaultImageUrl, 302);
  } catch (e) {
    console.error('Image API error:', e);
    return Response.redirect(defaultImageUrl, 302);
  }
}

