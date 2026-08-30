import { randomBytes, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import ExcelJS from "exceljs";

import { PrismaClient } from "../generated/prisma/client";
import {
  JenisPembayaran,
  KategoriTipe,
  MetodePembayaran,
  StatusAssessment,
  StatusKeseluruhan,
  StatusPembayaran,
  StatusPengumuman,
  StatusUndanganWa,
  UserRole,
} from "../generated/prisma/enums";

config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const appUrl = process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
if (!supabaseUrl || !publishableKey || !secretKey || !databaseUrl) {
  throw new Error("Environment integration test Phase 10 belum lengkap.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const adminClient = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
const marker = randomUUID().slice(0, 8);
const password = randomBytes(24).toString("base64url");
const authIds: string[] = [];
const profileIds: string[] = [];
const childIds: string[] = [];
const paymentIds: string[] = [];
let routeId: string | null = null;
let categoryId: string | null = null;

async function loginCookie(email: string) {
  const cookies = new Map<string, string>();
  const client = createServerClient(supabaseUrl!, publishableKey!, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (values: Array<{ name: string; value: string }>) => values.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error("Login akun uji gagal.");
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function createAccount(label: string, role: UserRole) {
  const email = `phase10-${label}-${marker}@example.invalid`;
  const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Gagal membuat akun uji.");
  authIds.push(data.user.id);
  const profile = await prisma.user.findUniqueOrThrow({ where: { supabaseAuthUserId: data.user.id } });
  profileIds.push(profile.id);
  if (profile.role !== role) await prisma.user.update({ where: { id: profile.id }, data: { role } });
  return { profile, cookie: await loginCookie(email) };
}

async function request(path: string, cookie: string) {
  return fetch(`${appUrl}${path}`, { headers: { cookie } });
}

async function run() {
  const admin = await createAccount("admin", UserRole.ADMIN);
  const wali = await createAccount("wali", UserRole.WALI_MURID);
  const route = await prisma.jalur.create({ data: { nama: `Phase 10 Jalur ${marker}`, statusAktif: true } });
  routeId = route.id;
  const category = await prisma.kategoriPendaftar.create({ data: { nama: `Phase 10 Kategori ${marker}`, tipe: KategoriTipe.EKSTERNAL, statusAktif: true } });
  categoryId = category.id;

  const target = await prisma.calonMurid.create({
    data: {
      userId: wali.profile.id,
      namaAnak: `=Phase10 ${marker}`,
      jalurId: route.id,
      kategoriId: category.id,
      statusKeseluruhan: StatusKeseluruhan.SELESAI,
      hasilAssessment: { create: { status: StatusAssessment.HADIR, catatan: `PRIVATE-ASSESSMENT-${marker}` } },
      pengumuman: { create: { statusAkhir: StatusPengumuman.DITERIMA, tanggalRilis: new Date("2026-08-30T00:00:00.000Z"), updatedById: admin.profile.id } },
      statusGrupWa: { create: { status: StatusUndanganWa.SUDAH_DIUNDANG, updatedById: admin.profile.id } },
    },
  });
  childIds.push(target.id);
  const distractor = await prisma.calonMurid.create({
    data: { userId: wali.profile.id, namaAnak: `Phase10 Tidak Cocok ${marker}`, jalurId: route.id, kategoriId: category.id, statusKeseluruhan: StatusKeseluruhan.MENUNGGU_DU },
  });
  childIds.push(distractor.id);

  const oldRegistration = await prisma.pembayaran.create({
    data: {
      calonMuridId: target.id,
      calonMuridReference: target.id,
      jenis: JenisPembayaran.PENDAFTARAN,
      metodePembayaran: MetodePembayaran.MIDTRANS,
      nominal: 500_000,
      status: StatusPembayaran.REJECTED,
      midtransOrderId: `phase10-old-${marker}`,
      midtransSnapToken: `phase10-old-snap-${marker}`,
      catatanAdmin: "Transaksi uji lama ditolak.",
      createdAt: new Date("2026-08-28T00:00:00.000Z"),
    },
  });
  const currentRegistration = await prisma.pembayaran.create({
    data: {
      calonMuridId: target.id,
      calonMuridReference: target.id,
      jenis: JenisPembayaran.PENDAFTARAN,
      metodePembayaran: MetodePembayaran.MIDTRANS,
      nominal: 500_000,
      status: StatusPembayaran.VERIFIED,
      verifiedById: admin.profile.id,
      verifiedAt: new Date("2026-08-29T00:00:00.000Z"),
      midtransOrderId: `phase10-current-${marker}`,
      midtransSnapToken: `PRIVATE-SNAP-${marker}`,
      midtransRawPayload: { private: `PRIVATE-RAW-${marker}` },
      createdAt: new Date("2026-08-29T00:00:00.000Z"),
    },
  });
  const du = await prisma.pembayaran.create({
    data: {
      calonMuridId: target.id,
      calonMuridReference: target.id,
      jenis: JenisPembayaran.DU,
      metodePembayaran: MetodePembayaran.MANUAL_TRANSFER,
      nominal: 2_500_000,
      status: StatusPembayaran.VERIFIED,
      fileBuktiUrl: `PRIVATE-PROOF-${marker}`,
      catatanAdmin: `PRIVATE-NOTE-${marker}`,
      verifiedById: admin.profile.id,
      verifiedAt: new Date("2026-08-30T00:00:00.000Z"),
    },
  });
  paymentIds.push(oldRegistration.id, currentRegistration.id, du.id);
  const distractorPayment = await prisma.pembayaran.create({
    data: { calonMuridId: distractor.id, calonMuridReference: distractor.id, jenis: JenisPembayaran.DU, metodePembayaran: MetodePembayaran.MANUAL_TRANSFER, status: StatusPembayaran.PENDING, fileBuktiUrl: `PRIVATE-DISTRACTOR-${marker}` },
  });
  paymentIds.push(distractorPayment.id);

  const query = new URLSearchParams({
    q: marker,
    jalurId: route.id,
    kategoriId: category.id,
    statusPembayaran: StatusPembayaran.VERIFIED,
    statusEnrollment: "LENGKAP",
    statusAssessment: StatusAssessment.HADIR,
    statusKelulusan: StatusPengumuman.DITERIMA,
    statusDu: StatusPembayaran.VERIFIED,
    statusWa: StatusUndanganWa.SUDAH_DIUNDANG,
  });

  const roleGuard = await request(`/api/admin/laporan/export?${query}&format=csv`, wali.cookie);
  if (roleGuard.status !== 403) throw new Error(`Export laporan tidak dilindungi role admin (${roleGuard.status}: ${await roleGuard.text()}).`);
  const invalid = await request("/api/admin/laporan/export?format=pdf", admin.cookie);
  if (invalid.status !== 422) throw new Error("Format export invalid tidak ditolak.");

  const csvResponse = await request(`/api/admin/laporan/export?${query}&format=csv`, admin.cookie);
  const csvBytes = Buffer.from(await csvResponse.arrayBuffer());
  const csv = csvBytes.subarray(3).toString("utf8");
  if (csvResponse.status !== 200 || !csvResponse.headers.get("content-type")?.startsWith("text/csv")) throw new Error("CSV report gagal dibuat.");
  if (csvResponse.headers.get("x-report-row-count") !== "1" || csvBytes.subarray(0, 3).toString("hex") !== "efbbbf") throw new Error("Jumlah baris atau BOM CSV tidak benar.");
  if (!csv.includes(`'=Phase10 ${marker}`) || csv.includes("Tidak Cocok")) throw new Error("Filter atau formula neutralization CSV gagal.");
  for (const privateValue of ["PRIVATE-SNAP", "PRIVATE-RAW", "PRIVATE-PROOF", "PRIVATE-NOTE", "PRIVATE-ASSESSMENT"]) {
    if (csv.includes(privateValue)) throw new Error(`Data internal bocor ke CSV: ${privateValue}`);
  }

  const xlsxResponse = await request(`/api/admin/laporan/export?${query}&format=xlsx`, admin.cookie);
  const xlsx = Buffer.from(await xlsxResponse.arrayBuffer());
  if (xlsxResponse.status !== 200 || !xlsxResponse.headers.get("content-type")?.includes("spreadsheetml.sheet") || xlsx.subarray(0, 2).toString() !== "PK") throw new Error("XLSX report tidak valid.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsx.buffer as ArrayBuffer);
  const worksheet = workbook.getWorksheet("Rekap Peserta");
  if (worksheet?.rowCount !== 2 || worksheet.getCell("B2").value !== `'=Phase10 ${marker}`) throw new Error("Isi XLSX tidak sesuai hasil filter.");

  const logs = await prisma.auditLog.findMany({ where: { actorId: admin.profile.id, action: "EXPORT_PARTICIPANT_REPORT" }, orderBy: { createdAt: "asc" } });
  if (logs.length !== 2) throw new Error("Audit export CSV/XLSX tidak lengkap.");
  for (const log of logs) {
    const serialized = JSON.stringify(log.detail);
    if (!serialized.includes('"rowCount":1') || serialized.includes(marker)) throw new Error("Audit export menyimpan jumlah/filter secara tidak aman.");
  }

  console.log("Phase 10 integration verification passed.");
}

async function cleanup() {
  try {
    if (profileIds.length) await prisma.auditLog.deleteMany({ where: { actorId: { in: profileIds }, action: "EXPORT_PARTICIPANT_REPORT" } });
    if (paymentIds.length) await prisma.pembayaran.deleteMany({ where: { id: { in: paymentIds } } });
    if (childIds.length) await prisma.calonMurid.deleteMany({ where: { id: { in: childIds } } });
    if (routeId) await prisma.jalur.deleteMany({ where: { id: routeId } });
    if (categoryId) await prisma.kategoriPendaftar.deleteMany({ where: { id: categoryId } });
    if (profileIds.length) await prisma.user.deleteMany({ where: { id: { in: profileIds } } });
    for (const authId of authIds) await adminClient.auth.admin.deleteUser(authId);
  } finally {
    await prisma.$disconnect();
  }
}

run().finally(cleanup).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
