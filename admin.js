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
  isYouTubeThumb: false,
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

        // Simpan sebagai JPEG kualitas 0.85 untuk kompatibilitas mutlak 100% pada scraper media sosial (WhatsApp, Facebook, Twitter)
        const base64 = canvas.toDataURL('image/jpeg', Math.min(quality || 0.85, 0.85));

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
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Ekstraksi 11 karakter YouTube Video ID dari berbagai variasi URL
 */
export function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/|watch\?.+&v=))([\w-]{11})/);
  if (match && match[1]) return match[1];
  const fallback = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/.exec(trimmed);
  return (fallback && fallback[2]?.length === 11) ? fallback[2] : null;
}

/**
 * Mengambil blob thumbnail YouTube (prioritas maxresdefault, fallback hqdefault)
 */
export async function fetchYouTubeThumbnailBlob(videoId) {
  // 1. Coba resolusi tinggi (maxresdefault) terlebih dahulu
  try {
    const maxresUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    const res = await fetch(maxresUrl, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      // Placeholder error 120x90 YouTube biasanya berukuran sangat kecil (< 3KB)
      if (blob.size > 5000) {
        return blob;
      }
    }
  } catch (e) {
    console.warn("maxresdefault tidak tersedia, mencoba hqdefault:", e);
  }

  // 2. Fallback ke hqdefault (480x360, terjamin ada pada seluruh video YouTube)
  const hqUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const resHq = await fetch(hqUrl, { mode: 'cors' });
  if (!resHq.ok) {
    throw new Error('Gagal mengambil gambar thumbnail YouTube.');
  }
  return await resHq.blob();
}

/**
 * Mengonversi thumbnail video YouTube menjadi foto cover Base64
 */
export async function applyYouTubeThumbnailAsCover(videoId, notify = true) {
  try {
    if (notify) showToast('Mengambil thumbnail dari YouTube...', 'info');

    const blob = await fetchYouTubeThumbnailBlob(videoId);
    const file = new File([blob], `youtube-thumb-${videoId}.jpg`, { type: blob.type || 'image/jpeg' });

    // Masukkan ke pipeline Canvas optimizer yang sudah ada
    await handleImageFile(file);
    state.isYouTubeThumb = true;

    syncYouTubeThumbCheckboxes(true);

    const statStatusBadge = document.getElementById('statStatusBadge');
    if (statStatusBadge) {
      statStatusBadge.innerHTML = `<span class="material-symbols-outlined text-xs">smart_display</span> Thumbnail YouTube`;
      statStatusBadge.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-red-100 text-red-800';
    }

    if (notify) showToast('Thumbnail YouTube berhasil dijadikan foto utama!', 'success');
  } catch (err) {
    console.error('Gagal mengambil thumbnail YouTube:', err);
    syncYouTubeThumbCheckboxes(false);
    if (notify) showToast(`Gagal mengambil thumbnail: ${err.message}`, 'error');
  }
}

/**
 * Sinkronisasi kedua kotak centang thumbnail YouTube di formulir
 */
export function syncYouTubeThumbCheckboxes(checked) {
  const chk1 = document.getElementById('chkUseYouTubeThumb');
  const chk2 = document.getElementById('chkUseYouTubeThumbSecondary');
  const statusEl = document.getElementById('ytThumbStatus');

  if (chk1) chk1.checked = checked;
  if (chk2) chk2.checked = checked;

  if (statusEl) {
    if (checked && state.isYouTubeThumb) {
      statusEl.classList.remove('hidden');
    } else {
      statusEl.classList.add('hidden');
    }
  }
}

/**
 * Handler saat admin mengklik kotak centang thumbnail YouTube
 */
export async function handleYouTubeThumbCheckboxChange(isChecked) {
  if (!isChecked) {
    if (state.isYouTubeThumb) {
      clearCoverImage();
      showToast('Thumbnail YouTube dilepas dari foto utama', 'info');
    }
    syncYouTubeThumbCheckboxes(false);
    return;
  }

  const videoInput = document.getElementById('postVideoUrl');
  const videoUrl = videoInput?.value.trim() || '';
  const videoId = extractYouTubeVideoId(videoUrl);

  if (!videoId) {
    syncYouTubeThumbCheckboxes(false);
    showToast('Silakan masukkan Tautan Video YouTube terlebih dahulu!', 'warning');
    videoInput?.focus();
    return;
  }

  if (state.currentImageBase64 && !state.isYouTubeThumb) {
    const change = confirm('Anda sudah mengunggah file foto utama. Apakah Anda ingin menggantinya dengan thumbnail video YouTube?');
    if (!change) {
      syncYouTubeThumbCheckboxes(false);
      return;
    }
  }

  await applyYouTubeThumbnailAsCover(videoId, true);
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
        if (docSnap.id === '__site_stats__' || data.status === 'system' || data.type === 'site_stats') return;
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

  // Fallback: baca dari local storage (hanya postingan buatan admin)
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    state.posts = Array.isArray(parsed) ? parsed.filter(p => p.id !== '__site_stats__' && p.status !== 'system' && p.type !== 'site_stats' && (!p.id || (!p.id.startsWith('demo-') && !p.id.startsWith('pb-')))) : [];
  } catch (e) {
    state.posts = [];
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
        views: 0,
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
      views: 0,
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

// Data awal (kosong tanpa data dummy)
function getInitialMockPosts() {
  return [];
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

  // Auto-slug generator & validator
  let isSlugCustomized = false;

  postTitle?.addEventListener('input', () => {
    // Selalu perbarui jika belum diubah secara manual oleh admin atau jika slug kosong
    if (!isSlugCustomized || !postSlug.value.trim()) {
      postSlug.value = generateSlug(postTitle.value);
    }
  });

  // Sanitasi slug otomatis saat pengguna mengetik slug manual
  postSlug?.addEventListener('input', () => {
    isSlugCustomized = true;
    const sanitized = postSlug.value
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-');
    if (postSlug.value !== sanitized) {
      postSlug.value = sanitized;
    }
  });

  // Saat selesai mengetik slug (blur), rapikan strip di awal/akhir
  postSlug?.addEventListener('blur', () => {
    postSlug.value = generateSlug(postSlug.value || postTitle.value);
  });

  // Tombol Buat Ulang Slug
  document.getElementById('btnRegenerateSlug')?.addEventListener('click', () => {
    isSlugCustomized = false;
    postSlug.value = generateSlug(postTitle.value);
    showToast('Slug diperbarui sesuai judul', 'info');
  });

  // Tombol Salin Tautan Postingan
  document.getElementById('btnCopySlugUrl')?.addEventListener('click', () => {
    const slug = postSlug.value.trim() || generateSlug(postTitle.value);
    if (!slug) {
      showToast('Masukkan judul postingan terlebih dahulu!', 'warning');
      return;
    }
    const fullUrl = `${window.location.origin}/praktik-baik?slug=${encodeURIComponent(slug)}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      showToast('Tautan postingan berhasil disalin ke clipboard!', 'success');
    }).catch(() => {
      prompt('Salin tautan postingan ini:', fullUrl);
    });
  });

  // Tombol Buka / Tes Tautan Postingan
  document.getElementById('btnTestSlugUrl')?.addEventListener('click', () => {
    const slug = postSlug.value.trim() || generateSlug(postTitle.value);
    if (!slug) {
      showToast('Masukkan judul postingan terlebih dahulu!', 'warning');
      return;
    }
    window.open(`praktik-baik?slug=${encodeURIComponent(slug)}`, '_blank');
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

  // YouTube Thumbnail Checkbox Handlers
  const chkUseYouTubeThumb = document.getElementById('chkUseYouTubeThumb');
  const chkUseYouTubeThumbSecondary = document.getElementById('chkUseYouTubeThumbSecondary');

  chkUseYouTubeThumb?.addEventListener('change', (e) => {
    handleYouTubeThumbCheckboxChange(e.target.checked);
  });

  chkUseYouTubeThumbSecondary?.addEventListener('change', (e) => {
    handleYouTubeThumbCheckboxChange(e.target.checked);
  });

  // Listener input pada postVideoUrl: jika centang sedang aktif dan admin memasukkan/mengganti URL
  const videoInput = document.getElementById('postVideoUrl');
  videoInput?.addEventListener('input', async (e) => {
    const url = e.target.value.trim();
    const videoId = extractYouTubeVideoId(url);
    const isChecked = document.getElementById('chkUseYouTubeThumb')?.checked || document.getElementById('chkUseYouTubeThumbSecondary')?.checked;

    if (isChecked && videoId && (!state.currentImageBase64 || state.isYouTubeThumb)) {
      await applyYouTubeThumbnailAsCover(videoId, false);
    }
  });
}

/**
 * Memproses dan mengompresi file gambar yang dipilih pengguna
 */
async function handleImageFile(file) {
  try {
    const isYtFile = file && file.name && file.name.startsWith('youtube-thumb-');
    if (!isYtFile) {
      state.isYouTubeThumb = false;
      syncYouTubeThumbCheckboxes(false);
    }

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
    const statStatusBadge = document.getElementById('statStatusBadge');

    previewImg.src = result.base64;
    statOriginalSize.textContent = isYtFile ? 'YouTube CDN' : formatBytes(result.originalSize);
    statCompressedSize.textContent = `${formatBytes(result.compressedSize)} (${result.format.split('/')[1]?.toUpperCase()})`;

    if (isYtFile && statStatusBadge) {
      statStatusBadge.innerHTML = `<span class="material-symbols-outlined text-xs">smart_display</span> Thumbnail YouTube`;
      statStatusBadge.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-red-100 text-red-800';
    } else if (statStatusBadge) {
      statStatusBadge.innerHTML = `<span class="material-symbols-outlined text-xs">check_circle</span> Aman (&lt;1MB)`;
      statStatusBadge.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800';
    }

    dropZoneEmpty.classList.add('hidden');
    dropZonePreview.classList.remove('hidden');

    if (!isYtFile) {
      showToast(`Foto berhasil dioptimasi ke ${formatBytes(result.compressedSize)} Base64!`, 'success');
    }
  } catch (err) {
    console.error("Gagal mengompresi gambar:", err);
    showToast(`Gagal memproses gambar: ${err.message}`, 'error');
  }
}

function clearCoverImage() {
  state.currentImageBase64 = '';
  state.currentImageMeta = null;
  state.isYouTubeThumb = false;
  syncYouTubeThumbCheckboxes(false);

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
  const rawSlug = document.getElementById('postSlug').value.trim();
  const slug = generateSlug(rawSlug || title) || ('post-' + Date.now());
  const slugEl = document.getElementById('postSlug');
  if (slugEl) slugEl.value = slug;
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

  // Jika foto utama belum ada, tapi centang thumbnail YouTube aktif dan ada link video,
  // otomatis muat thumbnail sebelum postingan disimpan ke database
  const isThumbChecked = document.getElementById('chkUseYouTubeThumb')?.checked || document.getElementById('chkUseYouTubeThumbSecondary')?.checked;
  if (!state.currentImageBase64 && isThumbChecked && videoUrl) {
    const videoId = extractYouTubeVideoId(videoUrl);
    if (videoId) {
      try {
        await applyYouTubeThumbnailAsCover(videoId, false);
      } catch (e) {
        console.warn("Gagal auto-fetch thumbnail YouTube sebelum simpan:", e);
      }
    }
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
  const btnPublishText = document.getElementById('btnPublishPrimaryText');
  const btnSaveText = document.getElementById('btnSavePostText');

  try {
    if (btnPublish) btnPublish.disabled = true;
    if (btnSave) btnSave.disabled = true;
    if (btnPublishText) btnPublishText.textContent = 'Menyimpan ke Firestore...';
    if (btnSaveText) btnSaveText.textContent = 'Menyimpan...';

    const savedId = await savePostToDatabase(postData, state.editingPostId);
    showToast(state.editingPostId ? 'Postingan berhasil diperbarui!' : 'Postingan berhasil disimpan ke Firestore!', 'success');

    resetEditorForm();
    await fetchPosts();
    navigateTo('viewList');
  } catch (err) {
    console.error("Gagal menyimpan postingan:", err);
    showToast(`Gagal menyimpan postingan: ${err.message}`, 'error');
  } finally {
    if (btnPublish) btnPublish.disabled = false;
    if (btnSave) btnSave.disabled = false;
    if (btnPublishText) {
      btnPublishText.textContent = state.editingPostId ? 'Perbarui di Firestore' : 'Simpan ke Firestore';
    }
    if (btnSaveText) {
      btnSaveText.textContent = state.editingPostId ? 'Perbarui Postingan' : 'Simpan & Publikasikan';
    }
  }
}

function resetEditorForm() {
  state.editingPostId = null;
  state.isYouTubeThumb = false;
  syncYouTubeThumbCheckboxes(false);

  const postForm = document.getElementById('postForm');
  if (postForm) postForm.reset();
  clearCoverImage();

  const videoInput = document.getElementById('postVideoUrl');
  if (videoInput) videoInput.value = '';
  const extInput = document.getElementById('postExternalUrl');
  if (extInput) extInput.value = '';
  const postSlugInput = document.getElementById('postSlug');
  if (postSlugInput) postSlugInput.value = '';

  const editorModeBadge = document.getElementById('editorModeBadge');
  if (editorModeBadge) {
    editorModeBadge.textContent = 'POST BARU';
    editorModeBadge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-full bg-primary/10 text-primary';
  }

  const editorHeading = document.getElementById('editorHeading');
  if (editorHeading) editorHeading.textContent = 'Tulis Postingan Sekolah';

  const btnSavePostText = document.getElementById('btnSavePostText');
  if (btnSavePostText) btnSavePostText.textContent = 'Simpan & Publikasikan';

  const btnPublishPrimaryText = document.getElementById('btnPublishPrimaryText');
  if (btnPublishPrimaryText) btnPublishPrimaryText.textContent = 'Simpan ke Firestore';

  const btnCancelEdit = document.getElementById('btnCancelEdit');
  if (btnCancelEdit) btnCancelEdit.classList.add('hidden');

  const charCount = document.getElementById('charCount');
  if (charCount) charCount.textContent = '0 karakter';

  const postDate = document.getElementById('postDate');
  if (postDate) postDate.value = new Date().toISOString().split('T')[0];

  const postAuthor = document.getElementById('postAuthor');
  if (postAuthor) postAuthor.value = 'Edo Domakubun';
}

function startEditPost(post) {
  state.editingPostId = post.id;

  document.getElementById('postTitle').value = post.title || '';
  document.getElementById('postSlug').value = post.slug || generateSlug(post.title || '');
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
    state.isYouTubeThumb = false;
    syncYouTubeThumbCheckboxes(false);
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
  const editorModeBadge = document.getElementById('editorModeBadge');
  if (editorModeBadge) {
    editorModeBadge.textContent = 'SEDANG MENGEDIT';
    editorModeBadge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-500/10 text-amber-600';
  }
  const editorHeading = document.getElementById('editorHeading');
  if (editorHeading) editorHeading.textContent = 'Edit Postingan Sekolah';

  const btnSavePostText = document.getElementById('btnSavePostText');
  if (btnSavePostText) btnSavePostText.textContent = 'Perbarui Postingan';

  const btnPublishPrimaryText = document.getElementById('btnPublishPrimaryText');
  if (btnPublishPrimaryText) btnPublishPrimaryText.textContent = 'Perbarui di Firestore';

  const btnCancelEdit = document.getElementById('btnCancelEdit');
  if (btnCancelEdit) btnCancelEdit.classList.remove('hidden');

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

  const elTotal = document.getElementById('statTotalPosts');
  const elPublished = document.getElementById('statPublishedPosts');
  const elDraft = document.getElementById('statDraftPosts');
  const elBadge = document.getElementById('postCountBadge');

  if (elTotal) elTotal.textContent = totalPosts;
  if (elPublished) elPublished.textContent = publishedCount;
  if (elDraft) elDraft.textContent = draftCount;
  if (elBadge) elBadge.textContent = totalPosts;

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

          <div class="flex flex-wrap items-center gap-2 text-[11px] text-outline">
            <span class="inline-flex items-center gap-1">
              <span class="material-symbols-outlined text-xs">person</span>
              <span>${escapeHtml(post.author || 'Admin')}</span>
            </span>
            <span>•</span>
            <span class="inline-flex items-center gap-1 font-semibold text-on-surface-variant" title="Jumlah dilihat pengunjung">
              <span class="material-symbols-outlined text-xs text-primary">visibility</span>
              <span>${(Number(post.views) || 0).toLocaleString('id-ID')} dilihat</span>
            </span>
            <span>•</span>
            <span class="inline-flex items-center gap-1 font-mono text-[10px] text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/20">
              <span class="material-symbols-outlined text-[12px]">link</span>
              <a href="praktik-baik?slug=${encodeURIComponent(post.slug || post.id)}" target="_blank" class="hover:underline font-semibold" title="Buka tautan postingan di tab baru">/${escapeHtml(post.slug || post.id)}</a>
              <button type="button" class="btn-copy-post-slug text-outline hover:text-primary transition-colors ml-1" data-slug="${escapeHtml(post.slug || post.id)}" title="Salin Tautan Postingan">
                <span class="material-symbols-outlined text-[12px]">content_copy</span>
              </button>
            </span>
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

  // Listener tombol salin tautan langsung di kartu postingan
  container.querySelectorAll('.btn-copy-post-slug').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slug = btn.dataset.slug;
      const url = `${window.location.origin}/praktik-baik?slug=${encodeURIComponent(slug)}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Tautan postingan berhasil disalin ke clipboard!', 'success');
      }).catch(() => {
        prompt('Salin tautan postingan:', url);
      });
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
  const viewCountSpan = document.getElementById('previewViewCount');
  if (viewCountSpan) viewCountSpan.textContent = (Number(post.views) || 0).toLocaleString('id-ID');
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

  // Hapus data dummy lokal lama
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(p => !p.id || (!p.id.startsWith('demo-') && !p.id.startsWith('pb-')));
        localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(cleaned));
      }
    }
  } catch (e) {}

  // Initialize Firebase
  initFirebase();

  // Check auth session
  checkAuth();

  console.log("SD Inpres Lelingluan Admin SPA dengan autentikasi siap digunakan.");
});
