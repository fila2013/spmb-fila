import { randomBytes, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { PrismaClient } from "../generated/prisma/client";
import {
  JenisPembayaran,
  KategoriTipe,
  StatusKeseluruhan,
  StatusPembayaran,
  StatusUndanganWa,
  UserRole,
} from "../generated/prisma/enums";

config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const bucket = process.env.SUPABASE_STORAGE_BUCKET_PEMBAYARAN;
const appUrl = process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
if (!supabaseUrl || !publishableKey || !secretKey || !databaseUrl || !bucket) {
  throw new Error("Environment integration test Phase 9 belum lengkap.");
}

const authUrl = supabaseUrl;
const publicKey = publishableKey;
const adminKey = secretKey;
const connectionString = databaseUrl;
const paymentBucket = bucket;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const adminClient = createClient(authUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
const marker = randomUUID().slice(0, 8);
const password = randomBytes(24).toString("base64url");
const authIds: string[] = [];
const profileIds: string[] = [];
const childIds: string[] = [];
const routeIds: string[] = [];
const categoryIds: string[] = [];
const contentIds: string[] = [];
const paymentIds: string[] = [];
const storagePaths: string[] = [];

async function loginCookie(email: string) {
  const cookies = new Map<string, string>();
  const client = createServerClient(authUrl, publicKey, {
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
  const email = `phase9-${label}-${marker}@example.invalid`;
  const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Gagal membuat akun uji.");
  authIds.push(data.user.id);
  const profile = await prisma.user.findUniqueOrThrow({ where: { supabaseAuthUserId: data.user.id } });
  profileIds.push(profile.id);
  if (profile.role !== role) await prisma.user.update({ where: { id: profile.id }, data: { role } });
  return { profile, cookie: await loginCookie(email) };
}

type ApiBody = { data?: Record<string, unknown>; error?: { code?: string; message?: string } };
async function api(path: string, cookie: string, init?: RequestInit) {
  const isForm = init?.body instanceof FormData;
  const response = await fetch(`${appUrl}${path}`, {
    ...init,
    headers: { cookie, ...(isForm ? {} : { "content-type": "application/json" }), ...init?.headers },
  });
  const body = await response.json().catch(() => ({})) as ApiBody;
  return { response, body };
}

function pngProof(label: string) {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new TextEncoder().encode(label)]);
  return new File([bytes], `${label}.png`, { type: "image/png" });
}

function proofBody(file: File) {
  const body = new FormData();
  body.set("bukti", file);
  return body;
}

try {
  const [admin, waliA, waliB] = await Promise.all([
    createAccount("admin", UserRole.ADMIN),
    createAccount("wali-a", UserRole.WALI_MURID),
    createAccount("wali-b", UserRole.WALI_MURID),
  ]);
  const [route, category] = await Promise.all([
    prisma.jalur.create({ data: { nama: `Phase 9 Reguler ${marker}` } }),
    prisma.kategoriPendaftar.create({ data: { nama: `Phase 9 Kategori ${marker}`, tipe: KategoriTipe.EKSTERNAL } }),
  ]);
  routeIds.push(route.id);
  categoryIds.push(category.id);
  const [child, sibling, otherChild, blockedChild] = await Promise.all([
    prisma.calonMurid.create({ data: { userId: waliA.profile.id, namaAnak: `Phase 9 Anak ${marker}`, jalurId: route.id, kategoriId: category.id, statusKeseluruhan: StatusKeseluruhan.DITERIMA } }),
    prisma.calonMurid.create({ data: { userId: waliA.profile.id, namaAnak: `Phase 9 Saudara ${marker}`, jalurId: route.id, kategoriId: category.id, statusKeseluruhan: StatusKeseluruhan.DITERIMA } }),
    prisma.calonMurid.create({ data: { userId: waliB.profile.id, namaAnak: `Phase 9 Anak Lain ${marker}`, jalurId: route.id, kategoriId: category.id, statusKeseluruhan: StatusKeseluruhan.DITERIMA } }),
    prisma.calonMurid.create({ data: { userId: waliA.profile.id, namaAnak: `Phase 9 Belum Lulus ${marker}`, jalurId: route.id, kategoriId: category.id, statusKeseluruhan: StatusKeseluruhan.MENUNGGU_PENGUMUMAN } }),
  ]);
  childIds.push(child.id, sibling.id, otherChild.id, blockedChild.id);

  for (const payload of [
    { tahap: "ADMISSION_FEE", judul: `Kebijakan DU ${marker}`, tanggal: "2026-11-30", isiTeks: "Nominal dan periode pembayaran ditetapkan panitia.", gambarUrl: null, urutanLayout: 1, statusAktif: true, jalurId: route.id, kategoriId: category.id },
    { tahap: "JOIN_WA", judul: `Informasi Grup ${marker}`, tanggal: null, isiTeks: "Undangan dilakukan manual oleh panitia.", gambarUrl: null, urutanLayout: 1, statusAktif: true, jalurId: route.id, kategoriId: category.id },
  ]) {
    const created = await api("/api/admin/konten-tahap", admin.cookie, { method: "POST", body: JSON.stringify(payload) });
    if (created.response.status !== 201) throw new Error(`CMS Phase 9 gagal dibuat: ${created.response.status}`);
    contentIds.push(String(created.body.data?.id));
  }

  const gate = await api(`/api/calon-murid/${blockedChild.id}/du`, waliA.cookie);
  if (gate.response.status !== 403 || gate.body.error?.code !== "STAGE_FORBIDDEN") throw new Error("Backend gate DU dapat dilompati sebelum diterima.");
  const ownership = await api(`/api/calon-murid/${otherChild.id}/du`, waliA.cookie);
  if (ownership.response.status !== 403) throw new Error("Ownership DU bocor antar wali.");
  const admissionContent = await api(`/api/konten-tahap/admission-fee?calon_murid_id=${child.id}`, waliA.cookie);
  if (admissionContent.response.status !== 200 || !Array.isArray(admissionContent.body.data?.content) || admissionContent.body.data.content.length !== 1) throw new Error("Konten DU scoped tidak tersedia melalui kontrak info.");

  const fake = await api(`/api/calon-murid/${child.id}/du`, waliA.cookie, { method: "POST", body: proofBody(new File(["fake"], "fake.png", { type: "image/png" })) });
  if (fake.response.status !== 422 || fake.body.error?.code !== "INVALID_FILE") throw new Error("Signature file palsu diterima.");

  const uploaded = await api(`/api/calon-murid/${child.id}/du`, waliA.cookie, { method: "POST", body: proofBody(pngProof(`phase9-${marker}-first`)) });
  if (uploaded.response.status !== 201) throw new Error(`Upload DU gagal: ${uploaded.response.status} ${uploaded.body.error?.code ?? ""}`);
  const firstPaymentId = String(uploaded.body.data?.id);
  paymentIds.push(firstPaymentId);
  const firstPayment = await prisma.pembayaran.findUniqueOrThrow({ where: { id: firstPaymentId } });
  if (firstPayment.jenis !== JenisPembayaran.DU || firstPayment.status !== StatusPembayaran.PENDING || firstPayment.nominal !== null || !firstPayment.fileBuktiUrl) throw new Error("Ledger DU pending tidak sesuai kontrak.");
  storagePaths.push(firstPayment.fileBuktiUrl);
  const afterUpload = await prisma.calonMurid.findUniqueOrThrow({ where: { id: child.id } });
  if (afterUpload.statusKeseluruhan !== StatusKeseluruhan.MENUNGGU_DU) throw new Error("Upload DU tidak memajukan status.");

  const duplicate = await api(`/api/calon-murid/${child.id}/du`, waliA.cookie, { method: "POST", body: proofBody(pngProof(`phase9-${marker}-duplicate`)) });
  if (duplicate.response.status !== 409 || duplicate.body.error?.code !== "PAYMENT_PENDING") throw new Error("Transaksi DU aktif dapat diduplikasi.");

  const roleGuard = await api(`/api/admin/pembayaran/${firstPaymentId}/verifikasi`, waliA.cookie, { method: "PATCH", body: JSON.stringify({ status: "VERIFIED", nominal: 2_500_000, catatanAdmin: null }) });
  if (roleGuard.response.status !== 403) throw new Error("Verifikasi DU tidak dilindungi role admin.");
  const missingNominal = await api(`/api/admin/pembayaran/${firstPaymentId}/verifikasi`, admin.cookie, { method: "PATCH", body: JSON.stringify({ status: "VERIFIED", nominal: null, catatanAdmin: null }) });
  if (missingNominal.response.status !== 422) throw new Error("DU dapat diverifikasi tanpa nominal aktual.");

  const rejected = await api(`/api/admin/pembayaran/${firstPaymentId}/verifikasi`, admin.cookie, { method: "PATCH", body: JSON.stringify({ status: "REJECTED", nominal: null, catatanAdmin: "Bukti belum terbaca jelas." }) });
  if (rejected.response.status !== 200) throw new Error("Penolakan DU gagal.");
  const rejectedPayment = await prisma.pembayaran.findUniqueOrThrow({ where: { id: firstPaymentId } });
  if (rejectedPayment.status !== StatusPembayaran.REJECTED || !rejectedPayment.catatanAdmin) throw new Error("Alasan penolakan DU tidak tersimpan.");

  const reuploaded = await api(`/api/calon-murid/${child.id}/du`, waliA.cookie, { method: "POST", body: proofBody(pngProof(`phase9-${marker}-second`)) });
  if (reuploaded.response.status !== 201) throw new Error("Upload ulang setelah reject gagal.");
  const secondPaymentId = String(reuploaded.body.data?.id);
  paymentIds.push(secondPaymentId);
  const secondPayment = await prisma.pembayaran.findUniqueOrThrow({ where: { id: secondPaymentId } });
  if (!secondPayment.fileBuktiUrl) throw new Error("Path bukti kedua tidak tersimpan.");
  storagePaths.push(secondPayment.fileBuktiUrl);

  const verified = await api(`/api/admin/pembayaran/${secondPaymentId}/verifikasi`, admin.cookie, { method: "PATCH", body: JSON.stringify({ status: "VERIFIED", nominal: 2_500_000, catatanAdmin: "Sesuai mutasi rekening." }) });
  if (verified.response.status !== 200) throw new Error(`Verifikasi DU gagal: ${verified.response.status}`);
  const [verifiedPayment, afterVerified] = await Promise.all([
    prisma.pembayaran.findUniqueOrThrow({ where: { id: secondPaymentId } }),
    prisma.calonMurid.findUniqueOrThrow({ where: { id: child.id }, include: { statusGrupWa: true } }),
  ]);
  if (verifiedPayment.status !== StatusPembayaran.VERIFIED || verifiedPayment.nominal !== 2_500_000 || !verifiedPayment.verifiedAt || verifiedPayment.verifiedById !== admin.profile.id) throw new Error("Ledger verifikasi DU tidak lengkap.");
  if (afterVerified.statusKeseluruhan !== StatusKeseluruhan.MENUNGGU_JOIN_WA || afterVerified.statusGrupWa?.status !== StatusUndanganWa.MENUNGGU) throw new Error("Verifikasi DU tidak membuka Join WhatsApp.");

  const finalAgain = await api(`/api/admin/pembayaran/${secondPaymentId}/verifikasi`, admin.cookie, { method: "PATCH", body: JSON.stringify({ status: "VERIFIED", nominal: 2_500_000, catatanAdmin: null }) });
  if (finalAgain.response.status !== 409 || finalAgain.body.error?.code !== "PAYMENT_FINAL") throw new Error("Keputusan DU final tidak idempotent-safe.");

  const duView = await api(`/api/calon-murid/${child.id}/du`, waliA.cookie);
  const duPayment = duView.body.data?.payment as { status?: string; proofUrl?: string } | undefined;
  if (duView.response.status !== 200 || duPayment?.status !== "VERIFIED" || !duPayment.proofUrl || !Array.isArray(duView.body.data?.content)) throw new Error("Status atau signed URL DU tidak tampil ke pemilik.");
  const proofResponse = await fetch(duPayment.proofUrl);
  if (!proofResponse.ok) throw new Error("Signed URL bukti private tidak dapat digunakan.");

  const waOwnership = await api(`/api/calon-murid/${child.id}/status-wa`, waliB.cookie);
  if (waOwnership.response.status !== 403) throw new Error("Ownership status WhatsApp bocor.");
  const waWaiting = await api(`/api/calon-murid/${child.id}/status-wa`, waliA.cookie);
  if (waWaiting.response.status !== 200 || waWaiting.body.data?.status !== "MENUNGGU" || !Array.isArray(waWaiting.body.data?.content)) throw new Error("Status Join WhatsApp awal tidak tersedia.");
  const joinContent = await api(`/api/konten-tahap/join-wa?calon_murid_id=${child.id}`, waliA.cookie);
  if (joinContent.response.status !== 200 || !Array.isArray(joinContent.body.data?.content) || joinContent.body.data.content.length !== 1) throw new Error("Konten Join WhatsApp scoped tidak tersedia melalui kontrak info.");
  const waRoleGuard = await api(`/api/admin/peserta/${child.id}/status-wa`, waliA.cookie, { method: "PATCH", body: JSON.stringify({ status: "SUDAH_DIUNDANG" }) });
  if (waRoleGuard.response.status !== 403) throw new Error("Status WhatsApp tidak dilindungi role admin.");

  const invited = await api(`/api/admin/peserta/${child.id}/status-wa`, admin.cookie, { method: "PATCH", body: JSON.stringify({ status: "SUDAH_DIUNDANG" }) });
  if (invited.response.status !== 200) throw new Error("Update status undangan WhatsApp gagal.");
  const finished = await prisma.calonMurid.findUniqueOrThrow({ where: { id: child.id }, include: { statusGrupWa: true } });
  if (finished.statusKeseluruhan !== StatusKeseluruhan.SELESAI || finished.statusGrupWa?.status !== StatusUndanganWa.SUDAH_DIUNDANG) throw new Error("Status selesai tidak sinkron dengan undangan WhatsApp.");

  const reverted = await api(`/api/admin/peserta/${child.id}/status-wa`, admin.cookie, { method: "PATCH", body: JSON.stringify({ status: "MENUNGGU" }) });
  if (reverted.response.status !== 200) throw new Error("Status undangan tidak dapat dikoreksi admin.");
  const afterRevert = await prisma.calonMurid.findUniqueOrThrow({ where: { id: child.id } });
  if (afterRevert.statusKeseluruhan !== StatusKeseluruhan.MENUNGGU_JOIN_WA) throw new Error("Koreksi status WA tidak mengembalikan gate tahap.");

  const siblingAfter = await prisma.calonMurid.findUniqueOrThrow({ where: { id: sibling.id } });
  const siblingPayments = await prisma.pembayaran.count({ where: { calonMuridReference: sibling.id, jenis: JenisPembayaran.DU } });
  if (siblingAfter.statusKeseluruhan !== StatusKeseluruhan.DITERIMA || siblingPayments !== 0) throw new Error("Alur DU satu anak memengaruhi saudara dalam akun yang sama.");
  const audits = await prisma.auditLog.count({ where: { actorId: { in: [admin.profile.id, waliA.profile.id] }, action: { in: ["UPLOAD_DU_PROOF", "VERIFY_DU_PAYMENT", "UPDATE_WHATSAPP_INVITATION"] } } });
  if (audits < 6) throw new Error("Audit Phase 9 tidak lengkap.");

  console.log("Phase 9 DU manual & Join WhatsApp integration: OK");
} finally {
  if (storagePaths.length) await adminClient.storage.from(paymentBucket).remove(storagePaths);
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: profileIds } }, { entityId: { in: [...childIds, ...contentIds, ...paymentIds] } }] } });
  if (paymentIds.length) await prisma.pembayaran.deleteMany({ where: { id: { in: paymentIds } } });
  if (contentIds.length) await prisma.kontenTahap.deleteMany({ where: { id: { in: contentIds } } });
  if (childIds.length) await prisma.calonMurid.deleteMany({ where: { id: { in: childIds } } });
  if (categoryIds.length) await prisma.kategoriPendaftar.deleteMany({ where: { id: { in: categoryIds } } });
  if (routeIds.length) await prisma.jalur.deleteMany({ where: { id: { in: routeIds } } });
  if (profileIds.length) await prisma.user.deleteMany({ where: { id: { in: profileIds } } });
  for (const id of authIds) await adminClient.auth.admin.deleteUser(id);
  await prisma.$disconnect();
}
