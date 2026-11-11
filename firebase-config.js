/**
 * SD Inpres Lelingluan — Firebase Configuration
 * 
 * Konfigurasi Firebase untuk penyimpanan postingan dan media Base64 di Cloud Firestore.
 * Diambil otomatis dari riwayat proyek `attendez-2k0ks` yang sudah terhubung dengan SD Inpres Lelingluan.
 */

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBFt6boJNvB1oV0eusQZPlvybr_OXd_dSI",
  authDomain: "attendez-2k0ks.firebaseapp.com",
  databaseURL: "https://attendez-2k0ks-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "attendez-2k0ks",
  storageBucket: "attendez-2k0ks.firebasestorage.app",
  messagingSenderId: "1082706342744",
  appId: "1:1082706342744:web:fef6e5590c2a74c4e7ab5a",
  measurementId: "G-8L54YEY3S5"
};

const STORAGE_KEY = 'sdinpres_firebase_config';

/**
 * Mendapatkan konfigurasi Firebase aktif.
 * Memprioritaskan konfigurasi yang disimpan di localStorage browser,
 * jika belum ada maka menggunakan DEFAULT_FIREBASE_CONFIG.
 */
export function getActiveFirebaseConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.projectId && parsed.apiKey) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Gagal membaca konfigurasi dari localStorage:", err);
  }
  return DEFAULT_FIREBASE_CONFIG;
}

/**
 * Menyimpan konfigurasi Firebase ke localStorage.
 */
export function saveActiveFirebaseConfig(config) {
  if (!config || !config.projectId) {
    throw new Error("Project ID wajib diisi!");
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  return true;
}

/**
 * Menghapus konfigurasi custom dan kembali ke default.
 */
export function resetFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Memeriksa apakah konfigurasi Firebase sudah terisi.
 */
export function isFirebaseConfigured(config = getActiveFirebaseConfig()) {
  return Boolean(config && config.apiKey && config.projectId);
}
