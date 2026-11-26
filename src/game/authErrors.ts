export function formatFirebaseAuthError(error: unknown): string {
  let code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const msg = error instanceof Error ? error.message : String(error || '');
  if (!code && msg) {
    const match = msg.match(/\((auth\/[a-z0-9-]+)\)/i);
    if (match) {
      code = match[1].toLowerCase();
    }
  }

  switch (code) {
    case 'auth/unauthorized-domain':
      return 'Domain website ini belum diizinkan untuk login Google. Gunakan login Email & Kata Sandi di atas (berfungsi di semua domain), atau tambahkan domain ini ke Firebase Console → Authentication → Settings → Authorized domains.';
    case 'auth/invalid-email':
      return 'Format alamat email tidak valid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email atau kata sandi salah. Periksa kembali lalu coba lagi.';
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Silakan masuk menggunakan tab Sign In with Email.';
    case 'auth/account-exists-with-different-credential':
    case 'auth/credential-already-in-use':
      return 'Email ini sudah terhubung dengan metode login lain. Gunakan Email & Kata Sandi untuk masuk.';
    case 'auth/weak-password':
      return 'Kata sandi minimal 6 karakter.';
    case 'auth/missing-password':
      return 'Masukkan kata sandi terlebih dahulu.';
    case 'auth/operation-not-allowed':
      return 'Metode login ini belum diaktifkan di Firebase Console (Authentication → Sign-in method).';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi.';
    case 'auth/network-request-failed':
      return 'Gangguan jaringan ke server autentikasi. Periksa koneksi internet Anda.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/redirect-cancelled-by-user':
      return 'Jendela login ditutup sebelum selesai.';
    case 'auth/popup-blocked':
      return 'Popup login diblokir browser. Izinkan popup atau login dengan Email & Kata Sandi di atas.';
    case 'auth/user-disabled':
      return 'Akun ini dinonaktifkan. Hubungi administrator.';
    default:
      if (msg && !/^Firebase:/i.test(msg.trim())) return msg;
      return 'Gagal memproses login. Gunakan Email & Kata Sandi di atas atau periksa koneksi Anda.';
  }
}

export function validateEmailAddress(email: string): string | null {
  const cleaned = email.trim().toLowerCase();
  if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return 'Masukkan alamat email yang valid (contoh: nama@domain.com).';
  }
  return null;
}
