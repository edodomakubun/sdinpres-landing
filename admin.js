/**
 * SD Inpres Lelingluan — Admin SPA Controller
 * 
 * Modul SPA mandiri untuk membuat dan mengelola postingan sekolah
 * dengan Cloud Firestore, autentikasi admin resmi, dan kompresi gambar Base64.
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  Timestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { 
  getActiveFirebaseConfig, 
  saveActiveFirebaseConfig, 
  resetFirebaseConfig, 
  isFirebaseConfigured 
} from "./firebase-config.js";

// ============================================================================
// ADMIN CREDENTIALS & SECURITY
// ============================================================================
const ADMIN_CREDENTIALS = {
  email: "edo.domakubun@gmail.com",
  password: "adminsdin2026",
  name: "Edo Domakubun"
};

const AUTH_SESSION_KEY = 'sdinpres_admin_session';

// ============================================================================
// APP STATE
// ============================================================================
const state = {
  currentView: 'viewEditor',
  firebaseApp: null,
  db: null,
  auth: null,
  currentUser: null,
  isAuthenticated: false,
  isLiveFirestore: false,
  posts: [],
  editingPostId: null,
  currentImageBase64: '',
  currentImageMeta: null,
  deleteTargetId: null
};

const LOCAL_STORAGE_POSTS_KEY = 'sdinpres_local_posts_backup';

// ============================================================================
// AUTHENTICATION MODULE
// ============================================================================

/**
 * Memeriksa status sesi login saat halaman pertama kali dibuka
 */
function checkAuth() {
  let session = null;
  try {
    const rawLocal = localStorage.getItem(AUTH_SESSION_KEY);
    const rawSession = sessionStorage.getItem(AUTH_SESSION_KEY);
    session = rawSession ? JSON.parse(rawSession) : (rawLocal ? JSON.parse(rawLocal) : null);
  } catch (e) {
    session = null;
  }

  if (session && session.email && session.email.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase()) {
    setAuthenticatedState(true);
  } else {
    setAuthenticatedState(false);
  }
}

/**
 * Mengatur tampilan antara halaman login dan aplikasi utama
 */
function setAuthenticatedState(isAuth) {
  state.isAuthenticated = isAuth;
  const loginContainer = document.getElementById('loginContainer');
  const appContainer = document.getElementById('appContainer');

  if (isAuth) {
    loginContainer?.classList.add('hidden');
    appContainer?.classList.remove('hidden');
    fetchPosts().then(() => renderPostsList());
  } else {
    appContainer?.classList.add('hidden');
    loginContainer?.classList.remove('hidden');
    const pwdInput = document.getElementById('loginPassword');
    if (pwdInput) pwdInput.value = '';
  }
}

/**
 * Menangani proses masuk (Login) akun Admin
 */
async function handleLogin() {
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const rememberMe = document.getElementById('loginRememberMe')?.checked;
  const errorAlert = document.getElementById('loginErrorAlert');
  const errorMessage = document.getElementById('loginErrorMessage');
  const btnSubmit = document.getElementById('btnSubmitLogin');
  const btnSubmitText = document.getElementById('btnSubmitLoginText');

  const email = emailInput?.value.trim().toLowerCase();
  const password = passwordInput?.value;

  errorAlert?.classList.add('hidden');

  if (!email || !password) {
    errorMessage.textContent = 'Email dan kata sandi wajib diisi.';
    errorAlert?.classList.remove('hidden');
    return;
  }

  // Validasi kredensial administrator resmi
  if (email !== ADMIN_CREDENTIALS.email.toLowerCase() || password !== ADMIN_CREDENTIALS.password) {
    errorMessage.textContent = 'Akses Ditolak: Email atau kata sandi admin tidak sesuai.';
    errorAlert?.classList.remove('hidden');
    showToast('Akses ditolak: Akun tidak dikenali', 'error');
    return;
  }

  // Ubah status tombol jadi memuat
  const originalHtml = btnSubmitText.textContent;
  btnSubmit.disabled = true;
  btnSubmitText.textContent = 'Memverifikasi Akses...';

  try {
    // Upayakan sinkronisasi dengan Firebase Authentication Cloud jika tersedia
    if (state.auth) {
      try {
        await signInWithEmailAndPassword(state.auth, email, password);
        console.log("Firebase Auth berhasil masuk:", email);
      } catch (authErr) {
        // Jika akun belum dibuat di Firebase Auth Console, daftarkan otomatis
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
          try {
            await createUserWithEmailAndPassword(state.auth, email, password);
            console.log("Akun admin baru berhasil didaftarkan di Firebase Auth:", email);
          } catch (createErr) {
            console.warn("Info Firebase Auth:", createErr.message);
          }
        } else {
          console.warn("Info Firebase Auth:", authErr.message);
        }
      }
    }

    // Simpan sesi administrator
    const sessionData = {
      email: ADMIN_CREDENTIALS.email,
      name: ADMIN_CREDENTIALS.name,
      loggedInAt: Date.now()
    };

    if (rememberMe) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
    } else {
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
    }

    setAuthenticatedState(true);
    showToast(`Selamat datang kembali, ${ADMIN_CREDENTIALS.name}!`, 'success');
  } catch (err) {
    console.error("Gagal login:", err);
    errorMessage.textContent = `Gagal masuk: ${err.message}`;
    errorAlert?.classList.remove('hidden');
  } finally {
    btnSubmit.disabled = false;
    btnSubmitText.textContent = originalHtml;
  }
}

/**
 * Menangani proses keluar (Logout)
 */
async function handleLogout() {
  if (confirm("Apakah Anda yakin ingin keluar dari panel admin SD Inpres Lelingluan?")) {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);

    if (state.auth) {
      try {
        await signOut(state.auth);
      } catch (e) {
        console.warn("Signout error:", e);
      }
    }

    setAuthenticatedState(false);
    showToast("Anda telah keluar dari panel admin.", "info");
  }
}

function setupAuthListeners() {
  // Submit login form
  document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin();
  });

  // Logout button
  document.getElementById('btnLogout')?.addEventListener('click', handleLogout);

  // Toggle password visibility
  const btnTogglePassword = document.getElementById('btnTogglePassword');
  const inputPassword = document.getElementById('loginPassword');
  if (btnTogglePassword && inputPassword) {
    btnTogglePassword.addEventListener('click', () => {
      const isPassword = inputPassword.type === 'password';
      inputPassword.type = isPassword ? 'text' : 'password';
      const icon = btnTogglePassword.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.textContent = isPassword ? 'visibility_off' : 'visibility';
      }
    });
  }
}

// ============================================================================
// UTILITIES: IMAGE COMPRESSOR (HTML5 Canvas to Base64)
// ============================================================================

/**
 * Mengompresi file gambar secara cerdas di sisi browser menggunakan HTML5 Canvas
 * dan menghasilkan string Base64 berkualitas tinggi dengan ukuran aman (< 1 MB).
 */
export async function compressImageToBase64(file, maxWidth = 1200, maxHeight = 900, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('File yang dipilih bukan berkas gambar yang valid.'));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Hitung skala aspect ratio
        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Optimasi rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Prioritaskan WebP, fallback ke JPEG jika browser tidak mendukung export WebP
        let base64 = canvas.toDataURL('image/webp', quality);
        if (!base64.startsWith('data:image/webp')) {
          base64 = canvas.toDataURL('image/jpeg', quality);
        }

        // Estimasi byte data Base64
        const estimatedBytes = Math.round((base64.length * 3) / 4);

        resolve({
          base64,
          width,
          height,
          originalSize: file.size,
          compressedSize: estimatedBytes,
          format: base64.substring(5, base64.indexOf(';'))
        });
      };

      img.onerror = () => reject(new Error('Gagal memproses gambar.'));
      img.src = event.target.result;
    };

    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Simple Markdown to HTML formatter for article preview
function formatMarkdown(text) {
  if (!text) return '';
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  escaped = escaped.replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-primary mt-4 mb-1">$1</h3>');
  escaped = escaped.replace(/^## (.*$)/gim, '<h2 class="text-lg font-extrabold text-primary mt-5 mb-2">$1</h2>');

  // Bold & Italic
  escaped = escaped.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-on-surface">$1</strong>');
  escaped = escaped.replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>');

  // Quotes
  escaped = escaped.replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-primary pl-4 py-1 italic my-2 text-on-surface-variant bg-surface-container-low rounded-r-lg">$1</blockquote>');

  // Bullet Lists
  escaped = escaped.replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc text-on-surface">$1</li>');

  // Horizontal Rule
  escaped = escaped.replace(/^---$/gim, '<hr class="my-4 border-outline-variant/60">');

  // Paragraphs
  const paragraphs = escaped.split(/\n\n+/);
  return paragraphs.map(p => {
    if (p.startsWith('<h') || p.startsWith('<block') || p.startsWith('<li') || p.startsWith('<hr')) {
      return p;
    }
    return `<p class="leading-relaxed mb-3">${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto flex items-center gap-3 p-4 rounded-2xl shadow-xl border text-xs font-semibold transition-all transform duration-300 translate-y-4 opacity-0';

  let icon = 'info';
  if (type === 'success') {
    toast.classList.add('bg-emerald-900', 'text-emerald-100', 'border-emerald-700');
    icon = 'check_circle';
  } else if (type === 'error') {
    toast.classList.add('bg-red-950', 'text-red-100', 'border-red-800');
    icon = 'error';
  } else if (type === 'warning') {
    toast.classList.add('bg-amber-900', 'text-amber-100', 'border-amber-700');
    icon = 'warning';
  } else {
    toast.classList.add('bg-slate-900', 'text-white', 'border-slate-700');
    icon = 'info';
  }

  toast.innerHTML = `
    <span class="material-symbols-outlined text-base flex-shrink-0">${icon}</span>
    <span class="flex-1">${message}</span>
    <button type="button" class="text-white/70 hover:text-white p-1">
      <span class="material-symbols-outlined text-sm">close</span>
    </button>
  `;

  toast.querySelector('button').addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ============================================================================
// FIREBASE / REPOSITORY LAYER
// ============================================================================

/**
 * Inisialisasi Firebase App, Firestore Database, & Auth
 */
function initFirebase() {
  const config = getActiveFirebaseConfig();
  const statusBadge = document.getElementById('firebaseStatusBadge');
  const statusText = document.getElementById('firebaseStatusText');
  const setupBanner = document.getElementById('setupBanner');
  const storageBadge = document.getElementById('statStorageBadge');

  if (!isFirebaseConfigured(config)) {
    console.info("Firebase belum dikonfigurasi. Menggunakan penyimpanan demo lokal.");
    state.isLiveFirestore = false;
    
    if (statusBadge && statusText) {
      statusBadge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200';
      statusText.textContent = 'Mode Demo (Lokal)';
    }
    if (setupBanner) {
      setupBanner.classList.remove('hidden');
    }
    if (storageBadge) {
      storageBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500"></span> Local Backup';
    }
    return;
  }

  try {
    // Inisialisasi Firebase App
    if (getApps().length === 0) {
      state.firebaseApp = initializeApp(config);
    } else {
      state.firebaseApp = getApp();
    }

    state.db = getFirestore(state.firebaseApp);
    state.auth = getAuth(state.firebaseApp);
    state.isLiveFirestore = true;

    // Listen auth state
    onAuthStateChanged(state.auth, (user) => {
      state.currentUser = user;
      if (user) {
        console.log("Status Auth Cloud Aktif:", user.email);
      }
    });

    if (statusBadge && statusText) {
      statusBadge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200';
      statusText.textContent = 'Firestore Terhubung';
    }
    if (setupBanner) {
      setupBanner.classList.add('hidden');
    }
    if (storageBadge) {
      storageBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Cloud Firestore';
    }
    console.log("Cloud Firestore berhasil diinisialisasi:", config.projectId);
  } catch (err) {
    console.error("Gagal menginisialisasi Firebase:", err);
    state.isLiveFirestore = false;
    if (statusText) statusText.textContent = 'Koneksi Gagal';
    showToast(`Koneksi Firebase: ${err.message}`, 'error');
  }
}

/**
 * Mengambil seluruh postingan dari Firestore (atau fallback localStorage)
 */
async function fetchPosts() {
  if (state.isLiveFirestore && state.db) {
    try {
      const q = query(collection(state.db, "posts"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          ...data,
          date: data.date || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split('T')[0] : '')
        });
      });
      state.posts = items;
      localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(items));
      return items;
    } catch (err) {
      console.warn("Gagal memuat dari Firestore, beralih ke cache lokal:", err);
      if (err.code === 'permission-denied' || (err.message && err.message.toLowerCase().includes('permission'))) {
        showToast('Izin Firestore Ditolak: Buka tab Rules di Firebase Console lalu terapkan aturan "allow read, write: if true;" dan klik Publish.', 'warning');
      } else {
        showToast(`Database: ${err.message}`, 'warning');
      }
    }
  }

  // Fallback: baca dari local storage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    state.posts = raw ? JSON.parse(raw) : getInitialMockPosts();
  } catch (e) {
    state.posts = getInitialMockPosts();
  }
  return state.posts;
}

/**
 * Menyimpan atau memperbarui dokumen postingan
 */
async function savePostToDatabase(postData, postId = null) {
  if (state.isLiveFirestore && state.db) {
    if (postId) {
      // Update existing post
      const ref = doc(state.db, "posts", postId);
      await updateDoc(ref, {
        ...postData,
        updatedAt: serverTimestamp()
      });
      return postId;
    } else {
      // Add new post
      const ref = await addDoc(collection(state.db, "posts"), {
        ...postData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return ref.id;
    }
  }

  // Fallback mode lokal
  let posts = [...state.posts];
  const nowStr = new Date().toISOString();
  if (postId) {
    posts = posts.map(p => p.id === postId ? { ...p, ...postData, updatedAt: nowStr } : p);
  } else {
    const newId = 'local_' + Date.now();
    posts.unshift({
      id: newId,
      ...postData,
      createdAt: nowStr,
      updatedAt: nowStr
    });
  }
  state.posts = posts;
  localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
  return postId || 'local_' + Date.now();
}

/**
 * Menghapus dokumen postingan
 */
async function deletePostFromDatabase(postId) {
  if (state.isLiveFirestore && state.db) {
    await deleteDoc(doc(state.db, "posts", postId));
  }
  state.posts = state.posts.filter(p => p.id !== postId);
  localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(state.posts));
}

// Data awal sebagai demonstrasi jika Firestore belum dikonfigurasi
function getInitialMockPosts() {
  return [
    {
      id: "demo-praktik-1",
      title: "Inovasi Pembelajaran Berdiferensiasi Berbasis Kearifan Lokal Tanimbar",
      slug: "pembelajaran-berdiferensiasi-kearifan-lokal-tanimbar",
      category: "Praktik Baik",
      summary: "Penerapan modul ajar Kurikulum Merdeka yang memadukan literasi numerasi kontekstual dengan tenun ikat dan budaya lokal di SD Inpres Lelingluan.",
      content: "Praktik baik ini berfokus pada strategi diferensiasi konten dan produk belajar bagi peserta didik fase B dan C.\n\n### Latar Belakang & Tantangan\nBanyak peserta didik yang lebih cepat memahami konsep geometri dan pola simetri ketika dihubungkan langsung dengan motif tenun khas Tanimbar yang mereka jumpai sehari-hari di rumah.\n\n### Langkah-Langkah Pelaksanaan\n- **Asesmen Diagnostik Awal**: Mengidentifikasi kesiapan belajar dan gaya belajar visual/kinestetik murid.\n- **Eksplorasi Objek Nyata**: Mengamati pola kain tenun asli yang dibawa ke ruang kelas.\n- **Pemecahan Masalah Kolaboratif**: Membuat diagram pola numerik dan presentasi kelompok.\n\n### Dampak Positif\nMinat belajar meningkat drastis, suasana kelas lebih hidup, dan anak-anak bangga akan kekayaan budaya tanah kelahirannya.",
      coverImageBase64: "",
      imageCaption: "Aktivitas belajar berdiferensiasi kontekstual siswa kelas IV.",
      author: "Edo Domakubun",
      date: new Date().toISOString().split('T')[0],
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      externalUrl: "https://kurikulum.kemdikbud.go.id",
      status: "published",
      isPinned: true
    },
    {
      id: "demo-1",
      title: "Pelepasan & Pentas Seni Siswa Kelas VI Angkatan 2026",
      slug: "pelepasan-pentas-seni-kelas-vi-2026",
      category: "Berita",
      summary: "Suasana haru dan kebanggaan menyelimuti acara pelepasan peserta didik kelas VI SD Inpres Lelingluan dengan penampilan tarian tradisional Tanimbar.",
      content: "Hari ini menjadi momen bersejarah bagi keluarga besar SD Inpres Lelingluan. Sebanyak 32 siswa kelas VI secara resmi dilepas untuk melanjutkan pendidikan ke jenjang Sekolah Menengah Pertama (SMP).\n\nAcara dihadiri oleh Komite Sekolah, para orang tua/wali murid, serta tokoh masyarakat desa Lelingluan. Kepala Sekolah dalam sambutannya berpesan agar para lulusan senantiasa menjunjung tinggi karakter disiplin, kejujuran, dan semangat belajar di mana pun mereka berada.\n\n### Penampilan Pentas Seni\nAcara dimeriahkan dengan pagelaran tarian daerah Tanimbar yang dibawakan penuh semangat oleh peserta didik kelas IV dan V.",
      coverImageBase64: "",
      imageCaption: "Peserta didik kelas VI bersama para dewan guru pada acara pelepasan.",
      author: "Admin SD Inpres",
      date: new Date().toISOString().split('T')[0],
      status: "published",
      isPinned: false
    }
  ];
}

// ============================================================================
// SPA ROUTING & VIEW CONTROLLER
// ============================================================================
function navigateTo(targetViewId) {
  state.currentView = targetViewId;

  // Toggle active view sections
  document.querySelectorAll('.spa-view').forEach(view => {
    if (view.id === targetViewId) {
      view.classList.remove('hidden');
      view.classList.add('block');
    } else {
      view.classList.add('hidden');
      view.classList.remove('block');
    }
  });

  // Update nav tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isTarget = btn.dataset.target === targetViewId;
    if (isTarget) {
      btn.className = 'tab-btn flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white shadow-sm transition-all';
    } else {
      btn.className = 'tab-btn flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all';
    }
  });

  // If entering list view, refresh the posts table
  if (targetViewId === 'viewList') {
    renderPostsList();
  }

  // If entering settings, populate the form
  if (targetViewId === 'viewSettings') {
    populateSettingsForm();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================================
// EDITOR LOGIC & EVENT HANDLERS
// ============================================================================

function setupEditor() {
  const postTitle = document.getElementById('postTitle');
  const postSlug = document.getElementById('postSlug');
  const postSummary = document.getElementById('postSummary');
  const postContent = document.getElementById('postContent');
  const postCategory = document.getElementById('postCategory');
  const postDate = document.getElementById('postDate');
  const postAuthor = document.getElementById('postAuthor');
  const postImageCaption = document.getElementById('postImageCaption');
  const postIsPinned = document.getElementById('postIsPinned');
  const charCount = document.getElementById('charCount');

  // Default date to today
  if (postDate && !postDate.value) {
    postDate.value = new Date().toISOString().split('T')[0];
  }

  // Auto-slug generator
  postTitle?.addEventListener('input', () => {
    if (!state.editingPostId) {
      postSlug.value = generateSlug(postTitle.value);
    }
  });

  document.getElementById('btnRegenerateSlug')?.addEventListener('click', () => {
    postSlug.value = generateSlug(postTitle.value);
    showToast('Slug diperbarui sesuai judul', 'info');
  });

  // Char counter
  postContent?.addEventListener('input', () => {
    charCount.textContent = `${postContent.value.length} karakter`;
  });

  // Formatting Toolbar Buttons
  document.querySelectorAll('.fmt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.dataset.format;
      insertFormatting(postContent, format);
      charCount.textContent = `${postContent.value.length} karakter`;
    });
  });

  // Image Upload & Canvas Compressor Handler
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        await handleImageFile(e.target.files[0]);
      }
    });
  }

  // Drag & drop handlers
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('border-primary', 'bg-primary/5');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary', 'bg-primary/5');
      });
    });

    dropZone.addEventListener('drop', async (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        await handleImageFile(e.dataTransfer.files[0]);
      }
    });
  }

  // Remove image button
  document.getElementById('btnRemoveImage')?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearCoverImage();
    showToast('Foto utama dihapus', 'info');
  });

  // Preview Post Button
  document.getElementById('btnPreviewPost')?.addEventListener('click', () => {
    openPreviewModal({
      title: postTitle.value || 'Judul Postingan Belum Diisi',
      category: postCategory.value,
      date: postDate.value,
      author: postAuthor.value,
      summary: postSummary.value,
      content: postContent.value,
      coverImageBase64: state.currentImageBase64,
      imageCaption: postImageCaption.value
    });
  });

  // Submit / Publish Buttons
  document.getElementById('btnSavePost')?.addEventListener('click', () => handleSavePost());
  document.getElementById('btnPublishPrimary')?.addEventListener('click', () => handleSavePost());

  // Reset Button
  document.getElementById('btnResetForm')?.addEventListener('click', () => {
    if (confirm('Bersihkan seluruh isi formulir?')) {
      resetEditorForm();
      showToast('Formulir dibersihkan', 'info');
    }
  });

  // Cancel Edit Button
  document.getElementById('btnCancelEdit')?.addEventListener('click', () => {
    resetEditorForm();
    showToast('Batal mengedit postingan', 'info');
  });
}

/**
 * Memproses dan mengompresi file gambar yang dipilih pengguna
 */
async function handleImageFile(file) {
  try {
    showToast('Mengompresi gambar dengan Canvas...', 'info');
    const result = await compressImageToBase64(file, 1200, 900, 0.8);

    state.currentImageBase64 = result.base64;
    state.currentImageMeta = result;

    // Tampilkan pratinjau
    const dropZoneEmpty = document.getElementById('dropZoneEmpty');
    const dropZonePreview = document.getElementById('dropZonePreview');
    const previewImg = document.getElementById('previewImageElement');
    const statOriginalSize = document.getElementById('statOriginalSize');
    const statCompressedSize = document.getElementById('statCompressedSize');

    previewImg.src = result.base64;
    statOriginalSize.textContent = formatBytes(result.originalSize);
    statCompressedSize.textContent = `${formatBytes(result.compressedSize)} (${result.format.split('/')[1]?.toUpperCase()})`;

    dropZoneEmpty.classList.add('hidden');
    dropZonePreview.classList.remove('hidden');

    showToast(`Foto berhasil dioptimasi ke ${formatBytes(result.compressedSize)} Base64!`, 'success');
  } catch (err) {
    console.error("Gagal mengompresi gambar:", err);
    showToast(`Gagal memproses gambar: ${err.message}`, 'error');
  }
}

function clearCoverImage() {
  state.currentImageBase64 = '';
  state.currentImageMeta = null;
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.value = '';

  const dropZoneEmpty = document.getElementById('dropZoneEmpty');
  const dropZonePreview = document.getElementById('dropZonePreview');
  const previewImg = document.getElementById('previewImageElement');

  if (previewImg) previewImg.src = '';
  if (dropZoneEmpty) dropZoneEmpty.classList.remove('hidden');
  if (dropZonePreview) dropZonePreview.classList.add('hidden');
}

function insertFormatting(textarea, format) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);

  let replacement = '';
  let cursorOffset = 0;

  switch (format) {
    case 'bold':
      replacement = `**${selectedText || 'teks tebal'}**`;
      cursorOffset = selectedText ? replacement.length : 2;
      break;
    case 'italic':
      replacement = `*${selectedText || 'teks miring'}*`;
      cursorOffset = selectedText ? replacement.length : 1;
      break;
    case 'h2':
      replacement = `\n\n## ${selectedText || 'Judul Bagian Baru'}\n`;
      cursorOffset = replacement.length;
      break;
    case 'h3':
      replacement = `\n\n### ${selectedText || 'Subjudul Bagian'}\n`;
      cursorOffset = replacement.length;
      break;
    case 'list':
      replacement = `\n- ${selectedText || 'Poin daftar'}`;
      cursorOffset = replacement.length;
      break;
    case 'quote':
      replacement = `\n> ${selectedText || 'Kutipan penting'}\n`;
      cursorOffset = replacement.length;
      break;
    case 'link':
      replacement = `[${selectedText || 'Judul Tautan'}](https://)`;
      cursorOffset = replacement.length - 1;
      break;
    case 'hr':
      replacement = `\n\n---\n\n`;
      cursorOffset = replacement.length;
      break;
  }

  textarea.setRangeText(replacement, start, end, 'end');
  textarea.focus();
}

/**
 * Menyimpan data postingan ke Firestore / Local
 */
async function handleSavePost() {
  const title = document.getElementById('postTitle').value.trim();
  const slug = document.getElementById('postSlug').value.trim() || generateSlug(title);
  const summary = document.getElementById('postSummary').value.trim();
  const content = document.getElementById('postContent').value.trim();
  const category = document.getElementById('postCategory').value;
  const date = document.getElementById('postDate').value || new Date().toISOString().split('T')[0];
  const author = document.getElementById('postAuthor').value.trim() || 'Admin SD Inpres';
  const imageCaption = document.getElementById('postImageCaption').value.trim();
  const isPinned = document.getElementById('postIsPinned').checked;
  const videoUrl = document.getElementById('postVideoUrl')?.value.trim() || '';
  const externalUrl = document.getElementById('postExternalUrl')?.value.trim() || '';
  const statusRadios = document.getElementsByName('postStatus');
  let status = 'published';
  for (const r of statusRadios) {
    if (r.checked) status = r.value;
  }

  // Validasi input
  if (!title) {
    showToast('Judul postingan wajib diisi!', 'warning');
    document.getElementById('postTitle').focus();
    return;
  }

  if (!content) {
    showToast('Isi konten postingan wajib ditulis!', 'warning');
    document.getElementById('postContent').focus();
    return;
  }

  const postData = {
    title,
    slug,
    summary,
    content,
    coverImageBase64: state.currentImageBase64 || '',
    imageCaption,
    category,
    date,
    author,
    videoUrl,
    externalUrl,
    status,
    isPinned
  };

  const btnPublish = document.getElementById('btnPublishPrimary');
  const btnSave = document.getElementById('btnSavePost');
  const originalPublishHtml = btnPublish.innerHTML;

  try {
    btnPublish.disabled = true;
    btnPublish.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">sync</span> Menyimpan ke Firestore...';

    const savedId = await savePostToDatabase(postData, state.editingPostId);
    showToast(state.editingPostId ? 'Postingan berhasil diperbarui!' : 'Postingan berhasil disimpan ke Firestore!', 'success');

    resetEditorForm();
    await fetchPosts();
    navigateTo('viewList');
  } catch (err) {
    console.error("Gagal menyimpan postingan:", err);
    showToast(`Gagal menyimpan postingan: ${err.message}`, 'error');
  } finally {
    btnPublish.disabled = false;
    btnPublish.innerHTML = originalPublishHtml;
  }
}

function resetEditorForm() {
  state.editingPostId = null;
  document.getElementById('postForm').reset();
  clearCoverImage();

  const videoInput = document.getElementById('postVideoUrl');
  if (videoInput) videoInput.value = '';
  const extInput = document.getElementById('postExternalUrl');
  if (extInput) extInput.value = '';

  document.getElementById('editorModeBadge').textContent = 'POST BARU';
  document.getElementById('editorModeBadge').className = 'px-2.5 py-0.5 text-xs font-bold rounded-full bg-primary/10 text-primary';
  document.getElementById('editorHeading').textContent = 'Tulis Postingan Sekolah';
  document.getElementById('btnSavePostText').textContent = 'Simpan & Publikasikan';
  document.getElementById('btnPublishPrimaryText').textContent = 'Simpan ke Firestore';
  document.getElementById('btnCancelEdit').classList.add('hidden');
  document.getElementById('charCount').textContent = '0 karakter';
  document.getElementById('postDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('postAuthor').value = 'Edo Domakubun';
}

function startEditPost(post) {
  state.editingPostId = post.id;

  document.getElementById('postTitle').value = post.title || '';
  document.getElementById('postSlug').value = post.slug || '';
  document.getElementById('postSummary').value = post.summary || '';
  document.getElementById('postContent').value = post.content || '';
  document.getElementById('postCategory').value = post.category || 'Praktik Baik';
  document.getElementById('postDate').value = post.date || new Date().toISOString().split('T')[0];
  document.getElementById('postAuthor').value = post.author || 'Edo Domakubun';
  document.getElementById('postImageCaption').value = post.imageCaption || '';
  document.getElementById('postIsPinned').checked = Boolean(post.isPinned);
  const videoInput = document.getElementById('postVideoUrl');
  if (videoInput) videoInput.value = post.videoUrl || '';
  const extInput = document.getElementById('postExternalUrl');
  if (extInput) extInput.value = post.externalUrl || '';
  document.getElementById('charCount').textContent = `${(post.content || '').length} karakter`;

  // Set status radio
  const statusRadios = document.getElementsByName('postStatus');
  for (const r of statusRadios) {
    r.checked = (r.value === (post.status || 'published'));
  }

  // Cover image
  if (post.coverImageBase64) {
    state.currentImageBase64 = post.coverImageBase64;
    const dropZoneEmpty = document.getElementById('dropZoneEmpty');
    const dropZonePreview = document.getElementById('dropZonePreview');
    const previewImg = document.getElementById('previewImageElement');
    const statOriginalSize = document.getElementById('statOriginalSize');
    const statCompressedSize = document.getElementById('statCompressedSize');

    previewImg.src = post.coverImageBase64;
    statOriginalSize.textContent = 'Gambar Tersimpan';
    statCompressedSize.textContent = `${formatBytes(Math.round((post.coverImageBase64.length * 3) / 4))} (Base64)`;

    dropZoneEmpty.classList.add('hidden');
    dropZonePreview.classList.remove('hidden');
  } else {
    clearCoverImage();
  }

  // Update UI indicators
  document.getElementById('editorModeBadge').textContent = 'SEDANG MENGEDIT';
  document.getElementById('editorModeBadge').className = 'px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-500/10 text-amber-600';
  document.getElementById('editorHeading').textContent = 'Edit Postingan Sekolah';
  document.getElementById('btnSavePostText').textContent = 'Perbarui Postingan';
  document.getElementById('btnPublishPrimaryText').textContent = 'Perbarui di Firestore';
  document.getElementById('btnCancelEdit').classList.remove('hidden');

  navigateTo('viewEditor');
  showToast(`Sedang mengedit: "${post.title}"`, 'info');
}

// ============================================================================
// POSTS LIST & FILTER LOGIC
// ============================================================================

function setupListListeners() {
  document.getElementById('btnRefreshList')?.addEventListener('click', async () => {
    showToast('Memuat ulang dari Firestore...', 'info');
    await fetchPosts();
    renderPostsList();
  });

  document.getElementById('btnCreateNewFromList')?.addEventListener('click', () => {
    resetEditorForm();
    navigateTo('viewEditor');
  });

  document.getElementById('searchInput')?.addEventListener('input', () => renderPostsList());
  document.getElementById('filterCategory')?.addEventListener('change', () => renderPostsList());
  document.getElementById('filterStatus')?.addEventListener('change', () => renderPostsList());

  // Confirm delete modal buttons
  document.getElementById('btnCancelDelete')?.addEventListener('click', () => {
    document.getElementById('deleteConfirmModal').classList.add('hidden');
    state.deleteTargetId = null;
  });

  document.getElementById('btnConfirmDelete')?.addEventListener('click', async () => {
    if (state.deleteTargetId) {
      try {
        await deletePostFromDatabase(state.deleteTargetId);
        showToast('Postingan berhasil dihapus dari database', 'success');
        document.getElementById('deleteConfirmModal').classList.add('hidden');
        state.deleteTargetId = null;
        renderPostsList();
      } catch (err) {
        showToast(`Gagal menghapus postingan: ${err.message}`, 'error');
      }
    }
  });
}

function renderPostsList() {
  const container = document.getElementById('postsContainer');
  if (!container) return;

  const searchQuery = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const selectedCat = document.getElementById('filterCategory')?.value || '';
  const selectedStatus = document.getElementById('filterStatus')?.value || '';

  // Filter posts
  const filtered = state.posts.filter(p => {
    const matchSearch = !searchQuery || 
      (p.title && p.title.toLowerCase().includes(searchQuery)) ||
      (p.content && p.content.toLowerCase().includes(searchQuery)) ||
      (p.author && p.author.toLowerCase().includes(searchQuery));
    const matchCat = !selectedCat || p.category === selectedCat;
    const matchStatus = !selectedStatus || p.status === selectedStatus;
    return matchSearch && matchCat && matchStatus;
  });

  // Update Metrics
  const totalPosts = state.posts.length;
  const publishedCount = state.posts.filter(p => p.status === 'published').length;
  const draftCount = state.posts.filter(p => p.status === 'draft').length;

  document.getElementById('statTotalPosts').textContent = totalPosts;
  document.getElementById('statPublishedPosts').textContent = publishedCount;
  document.getElementById('statDraftPosts').textContent = draftCount;
  document.getElementById('postCountBadge').textContent = totalPosts;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl p-12 text-center border border-outline-variant/40 space-y-4">
        <div class="w-16 h-16 rounded-full bg-surface-container mx-auto flex items-center justify-center text-outline">
          <span class="material-symbols-outlined text-3xl">post_add</span>
        </div>
        <div class="space-y-1">
          <h4 class="text-base font-bold text-on-surface">Belum Ada Postingan Ditemukan</h4>
          <p class="text-xs text-on-surface-variant max-w-sm mx-auto">
            ${searchQuery || selectedCat || selectedStatus ? 'Coba ubah kata kunci pencarian atau reset filter kategori.' : 'Mulai publikasikan berita atau kegiatan pertama sekolah Anda.'}
          </p>
        </div>
        <button type="button" id="btnEmptyCreate" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow hover:bg-primary-container transition-all">
          <span class="material-symbols-outlined text-base">edit</span>
          <span>Tulis Postingan Sekarang</span>
        </button>
      </div>
    `;
    document.getElementById('btnEmptyCreate')?.addEventListener('click', () => {
      resetEditorForm();
      navigateTo('viewEditor');
    });
    return;
  }

  // Render cards
  container.innerHTML = filtered.map(post => {
    const isPublished = post.status === 'published';
    const statusPill = isPublished 
      ? `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Diterbitkan</span>`
      : `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Draf</span>`;

    const pinnedBadge = post.isPinned 
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary flex items-center gap-0.5"><span class="material-symbols-outlined text-xs">push_pin</span> Disematkan</span>`
      : '';

    const hasImage = Boolean(post.coverImageBase64);
    const imageSizeText = hasImage ? formatBytes(Math.round((post.coverImageBase64.length * 3) / 4)) : '';

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-outline-variant/50 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 items-start justify-between">
        
        <!-- Thumbnail -->
        <div class="w-full sm:w-36 h-28 flex-shrink-0 rounded-xl overflow-hidden bg-surface-container relative border border-outline-variant/40 flex items-center justify-center">
          ${hasImage 
            ? `<img src="${post.coverImageBase64}" alt="${escapeHtml(post.title)}" class="w-full h-full object-cover">
               <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white font-mono text-[9px]">${imageSizeText}</span>`
            : `<div class="text-center text-outline">
                 <span class="material-symbols-outlined text-2xl">image_not_supported</span>
                 <span class="block text-[10px]">Tanpa Foto</span>
               </div>`
          }
        </div>

        <!-- Details -->
        <div class="flex-1 space-y-2 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 text-primary">${escapeHtml(post.category || 'Berita')}</span>
            ${statusPill}
            ${pinnedBadge}
            <span class="text-xs text-outline font-medium">${post.date || 'Tanpa Tanggal'}</span>
          </div>

          <h3 class="text-base font-bold text-on-surface line-clamp-2 leading-snug hover:text-primary transition-colors cursor-pointer" data-action="preview" data-id="${post.id}">
            ${escapeHtml(post.title)}
          </h3>

          <p class="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
            ${escapeHtml(post.summary || post.content || '')}
          </p>

          <div class="flex items-center gap-2 text-[11px] text-outline">
            <span class="material-symbols-outlined text-xs">person</span>
            <span>${escapeHtml(post.author || 'Admin')}</span>
            <span>•</span>
            <span class="font-mono text-[10px] truncate">slug: ${escapeHtml(post.slug || '-')}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex sm:flex-col items-center gap-1.5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/30 justify-end">
          <button type="button" class="btn-action-preview p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors" data-id="${post.id}" title="Pratinjau Artikel">
            <span class="material-symbols-outlined text-lg">visibility</span>
          </button>
          <button type="button" class="btn-action-edit p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors" data-id="${post.id}" title="Edit Postingan">
            <span class="material-symbols-outlined text-lg">edit</span>
          </button>
          <button type="button" class="btn-action-delete p-2 rounded-xl text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors" data-id="${post.id}" title="Hapus Postingan">
            <span class="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>

      </div>
    `;
  }).join('');

  // Attach card event listeners
  container.querySelectorAll('[data-action="preview"], .btn-action-preview').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const post = state.posts.find(p => p.id === id);
      if (post) openPreviewModal(post);
    });
  });

  container.querySelectorAll('.btn-action-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const post = state.posts.find(p => p.id === id);
      if (post) startEditPost(post);
    });
  });

  container.querySelectorAll('.btn-action-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const post = state.posts.find(p => p.id === id);
      if (post) {
        state.deleteTargetId = id;
        document.getElementById('deleteItemTitle').textContent = post.title;
        document.getElementById('deleteConfirmModal').classList.remove('hidden');
      }
    });
  });
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

// ============================================================================
// PREVIEW MODAL
// ============================================================================

function openPreviewModal(post) {
  const modal = document.getElementById('previewModal');
  const catBadge = document.getElementById('previewCategoryBadge');
  const dateSpan = document.getElementById('previewDate');
  const authorSpan = document.getElementById('previewAuthor');
  const titleH1 = document.getElementById('previewTitle');
  const imgWrapper = document.getElementById('previewImageWrapper');
  const modalImg = document.getElementById('previewModalImage');
  const modalCaption = document.getElementById('previewModalCaption');
  const summaryWrapper = document.getElementById('previewSummaryWrapper');
  const summaryP = document.getElementById('previewSummary');
  const contentDiv = document.getElementById('previewContent');

  catBadge.textContent = post.category || 'Berita';
  dateSpan.textContent = post.date || new Date().toISOString().split('T')[0];
  authorSpan.textContent = post.author || 'Admin SD Inpres';
  titleH1.textContent = post.title || 'Judul Postingan';

  // Cover Image
  if (post.coverImageBase64) {
    modalImg.src = post.coverImageBase64;
    imgWrapper.classList.remove('hidden');
    if (post.imageCaption) {
      modalCaption.textContent = post.imageCaption;
      modalCaption.classList.remove('hidden');
    } else {
      modalCaption.classList.add('hidden');
    }
  } else {
    imgWrapper.classList.add('hidden');
  }

  // Summary
  if (post.summary) {
    summaryP.textContent = post.summary;
    summaryWrapper.classList.remove('hidden');
  } else {
    summaryWrapper.classList.add('hidden');
  }

  // Formatted Content
  contentDiv.innerHTML = formatMarkdown(post.content || '<em>Isi konten belum ditulis...</em>');

  modal.classList.remove('hidden');
}

function closePreviewModal() {
  document.getElementById('previewModal').classList.add('hidden');
}

// ============================================================================
// SETTINGS & FIREBASE CONFIGURATION
// ============================================================================

function populateSettingsForm() {
  const config = getActiveFirebaseConfig();
  document.getElementById('cfgApiKey').value = config.apiKey || '';
  document.getElementById('cfgProjectId').value = config.projectId || '';
  document.getElementById('cfgAuthDomain').value = config.authDomain || '';
  document.getElementById('cfgStorageBucket').value = config.storageBucket || '';
  document.getElementById('cfgMessagingSenderId').value = config.messagingSenderId || '';
  document.getElementById('cfgAppId').value = config.appId || '';

  const indicator = document.getElementById('configIndicator');
  if (isFirebaseConfigured(config)) {
    indicator.textContent = 'Tersimpan & Aktif';
    indicator.className = 'px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800';
  } else {
    indicator.textContent = 'Belum Dikonfigurasi';
    indicator.className = 'px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800';
  }
}

function setupSettingsListeners() {
  // Save Configuration
  document.getElementById('btnSaveConfig')?.addEventListener('click', () => {
    const config = {
      apiKey: document.getElementById('cfgApiKey').value.trim(),
      projectId: document.getElementById('cfgProjectId').value.trim(),
      authDomain: document.getElementById('cfgAuthDomain').value.trim(),
      storageBucket: document.getElementById('cfgStorageBucket').value.trim(),
      messagingSenderId: document.getElementById('cfgMessagingSenderId').value.trim(),
      appId: document.getElementById('cfgAppId').value.trim()
    };

    if (!config.apiKey || !config.projectId) {
      showToast('API Key dan Project ID wajib diisi!', 'warning');
      return;
    }

    try {
      saveActiveFirebaseConfig(config);
      showToast('Konfigurasi Firebase berhasil disimpan ke browser!', 'success');
      initFirebase();
      populateSettingsForm();
    } catch (err) {
      showToast(`Gagal menyimpan: ${err.message}`, 'error');
    }
  });

  // Test Connection
  document.getElementById('btnTestConnection')?.addEventListener('click', async () => {
    const logBox = document.getElementById('testConnectionLog');
    const msgBox = document.getElementById('testConnectionMessage');
    logBox.classList.remove('hidden');
    msgBox.textContent = `[${new Date().toLocaleTimeString()}] Memulai pengujian koneksi ke Firestore...`;

    try {
      initFirebase();
      if (!state.isLiveFirestore || !state.db) {
        throw new Error('Firebase belum terinisialisasi. Periksa Project ID dan API Key Anda.');
      }

      msgBox.textContent += `\n[${new Date().toLocaleTimeString()}] Menghubungkan ke koleksi "posts"...`;
      const q = query(collection(state.db, "posts"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);

      msgBox.textContent += `\n[${new Date().toLocaleTimeString()}] Berhasil! Terhubung ke Cloud Firestore.`;
      msgBox.textContent += `\n[${new Date().toLocaleTimeString()}] Total dokumen terbaca: ${snap.size} postingan.`;
      showToast('Koneksi Cloud Firestore Berhasil!', 'success');
    } catch (err) {
      msgBox.textContent += `\n[${new Date().toLocaleTimeString()}] ERROR: ${err.message}`;
      const pid = state.firebaseApp?.options?.projectId || 'attendez-2k0ks';
      msgBox.textContent += `\n\n[PANDUAN AKTIVASI]:\nPastikan Cloud Firestore sudah dibuat pada proyek "${pid}".\nBuka link ini di Firebase Console:\nhttps://console.firebase.google.com/project/${pid}/firestore\nLalu klik tombol "Create database" (pilih Start in test mode atau terapkan firestore.rules).`;
      showToast(`Uji koneksi: ${err.message}`, 'error');
    }
  });

  // Reset Configuration
  document.getElementById('btnResetConfig')?.addEventListener('click', () => {
    if (confirm('Reset konfigurasi Firebase kembali ke default?')) {
      resetFirebaseConfig();
      populateSettingsForm();
      initFirebase();
      showToast('Konfigurasi di-reset', 'info');
    }
  });

  // Copy Security Rules
  document.getElementById('btnCopyRules')?.addEventListener('click', () => {
    const rules = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /posts/{postId} {\n      allow read, write: if true;\n    }\n  }\n}`;
    navigator.clipboard.writeText(rules).then(() => {
      showToast('Security rules berhasil disalin ke clipboard!', 'success');
    });
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================
window.addEventListener('DOMContentLoaded', async () => {
  // Setup Authentication listeners
  setupAuthListeners();

  // Setup SPA Tab Navigation Buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      navigateTo(target);
    });
  });

  // Quick settings trigger from topbar & banner
  document.getElementById('btnQuickSettings')?.addEventListener('click', () => navigateTo('viewSettings'));
  document.getElementById('btnGoToSettingsFromBanner')?.addEventListener('click', () => navigateTo('viewSettings'));
  document.getElementById('btnDismissBanner')?.addEventListener('click', () => {
    document.getElementById('setupBanner')?.classList.add('hidden');
  });

  // Modal close buttons
  document.getElementById('btnClosePreviewModal')?.addEventListener('click', closePreviewModal);
  document.getElementById('btnClosePreviewModalBottom')?.addEventListener('click', closePreviewModal);

  // Close modals on escape key or backdrop click
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePreviewModal();
      document.getElementById('deleteConfirmModal')?.classList.add('hidden');
    }
  });

  document.getElementById('previewModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'previewModal') closePreviewModal();
  });

  document.getElementById('deleteConfirmModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'deleteConfirmModal') {
      document.getElementById('deleteConfirmModal').classList.add('hidden');
    }
  });

  // Setup modules
  setupEditor();
  setupListListeners();
  setupSettingsListeners();

  // Initialize Firebase
  initFirebase();

  // Check auth session
  checkAuth();

  console.log("SD Inpres Lelingluan Admin SPA dengan autentikasi siap digunakan.");
});
