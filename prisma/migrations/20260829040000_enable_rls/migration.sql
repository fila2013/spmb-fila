-- Semua akses data aplikasi melewati server logic/Prisma. Tidak ada policy
-- browser pada MVP, sehingga role anon/authenticated ditolak secara default.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jalur" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kategori_pendaftar" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "biaya_pendaftaran" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calon_murid" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_field" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_response" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pembayaran" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "konten_tahap" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasil_assessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pengumuman" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "status_grup_wa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
