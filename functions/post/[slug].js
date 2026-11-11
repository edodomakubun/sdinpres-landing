/**
 * Cloudflare Pages Function: Pretty URL Router (/post/:slug)
 * Mengalihkan pengunjung manusia ke /praktik-baik.html?slug=:slug
 */
export async function onRequest(context) {
  const { params, request } = context;
  const url = new URL(request.url);
  const slug = params.slug;
  
  return Response.redirect(`${url.origin}/praktik-baik.html?slug=${encodeURIComponent(slug)}`, 302);
}

