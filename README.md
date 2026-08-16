# SD Inpres Lelingluan — Landing Page v2

Landing page statis untuk Cloudflare Pages. Template Blogger lama **tidak disentuh** dan tetap menjadi CMS/sumber konten.

## Arsitektur

- `https://sdinpreslelingluan.com` → Landing Page Cloudflare Pages
- `https://blog.sdinpreslelingluan.com` → Blogger
- Semua foto konten di homepage diambil **secara dinamis dari Blogger Feed**.
- Tidak ada foto sekolah yang dijadikan sumber konten utama dari folder `assets/`.

## Feed Blogger

`app.js` menggunakan JSONP dari:

- Label `Berita` → 4 posting terbaru
- Label `Story` → 4 posting terbaru
- Label `Galeri` → 6 posting terbaru, lalu mengambil hingga 4 gambar dari setiap posting dan menampilkan maksimal 8 visual pada homepage

Sumber gambar diprioritaskan dari `media$thumbnail`, kemudian `<img>` yang ditemukan di isi posting.

## Link layanan

Link aktif yang sudah ada di versi sebelumnya dipertahankan, termasuk:

- Website Blogger
- Info SPMB
- Portal Siswa
- Arsip Digital
- Halaman Profil
- Halaman Download
- Label Berita / Story / Galeri

Jangan mengubah URL aktif tersebut hanya karena nama host terlihat berbeda.

## Fitur versi revisi

- Editorial hero
- Dynamic hero/about/program imagery dari feed Blogger
- 4 berita terbaru
- Kegiatan/Story dinamis
- Galeri masonry dari gambar posting Blogger
- Lightbox galeri dengan keyboard navigation
- Responsive desktop/tablet/mobile
- Mobile navigation
- Scroll reveal
- Loading screen
- Loading/fallback/error state
- SEO dasar dan Open Graph
- Tidak menggunakan database tambahan

## Konfigurasi

Di `app.js`:

```js
const CONFIG = {
  bloggerBase: 'https://blog.sdinpreslelingluan.com',
  newsLabel: 'Berita',
  storyLabel: 'Story',
  galleryLabel: 'Galeri',
  newsLimit: 4,
  storyLimit: 4,
  galleryPosts: 6,
  galleryImagesPerPost: 4
};
```

`bloggerBase` **jangan diubah** selama Blogger tetap berada di `blog.sdinpreslelingluan.com`.

## Test lokal

Karena feed Blogger menggunakan JSONP, sebaiknya test melalui local server, bukan langsung membuka `file:///`.

Contoh:

```bash
python -m http.server 8080
```

kemudian buka:

`http://localhost:8080`

## Deploy Cloudflare Pages

Deploy folder project ini sebagai Cloudflare Pages.

Tahap testing yang disarankan:

1. Deploy ke domain `*.pages.dev`.
2. Pastikan hero/about/program mendapatkan gambar dari feed Blogger.
3. Pastikan tepat 4 berita tampil.
4. Pastikan Story tampil jika label `Story` tersedia.
5. Pastikan Galeri menampilkan gambar dari posting `Galeri`.
6. Uji mobile.
7. Uji semua link.
8. Setelah lolos, baru hubungkan `sdinpreslelingluan.com` ke Cloudflare Pages.

## Catatan penting

Jangan menghapus atau mengubah template Blogger lama.

Landing page hanya membaca data dari Blogger. Jika posting Blogger diubah, kontennya di landing page ikut berubah saat feed dimuat ulang.
