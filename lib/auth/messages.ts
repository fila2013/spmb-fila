export function signupErrorMessage(code?: string) {
  switch (code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Terlalu banyak permintaan. Tunggu beberapa menit lalu coba kembali.";
    case "email_address_not_authorized":
      return "SMTP belum mengizinkan pengiriman ke alamat ini. Periksa kembali konfigurasi Custom SMTP.";
    case "email_address_invalid":
      return "Alamat atau domain email tidak dapat digunakan.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "Pendaftaran dengan email sedang dinonaktifkan.";
    case "unexpected_failure":
      return "Layanan email konfirmasi gagal. Periksa Auth Logs dan konfigurasi SMTP Supabase.";
    default:
      return "Akun belum dapat dibuat. Coba kembali beberapa saat lagi.";
  }
}

export function loginErrorMessage(code?: string) {
  if (code === "email_not_confirmed") {
    return "Email belum dikonfirmasi. Buka tautan verifikasi yang dikirim ke email Anda.";
  }
  return "Email atau password tidak sesuai.";
}
