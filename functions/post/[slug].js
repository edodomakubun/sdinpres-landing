/**
 * Cloudflare Pages Function: Pretty URL Router (/post/:slug)
 * Mengalihkan pengunjung manusia ke /praktik-baik?slug=:slug
 * (Menggunakan URL kanonikal bersih tanpa .html untuk mencegah pemicu 308 redirect)
 */
export async function onRequest(context) {
  const { params, request } = context;
  const url = new URL(request.url);
  const rawSlug = params.slug || '';
  const cleanSlug = rawSlug.replace(/\.html$/i, '');
  
  return Response.redirect(`${url.origin}/praktik-baik?slug=${encodeURIComponent(cleanSlug)}`, 301);
}
