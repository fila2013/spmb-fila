import { randomBytes, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { PrismaClient } from "../generated/prisma/client";
import { KategoriTipe, StatusKeseluruhan, UserRole } from "../generated/prisma/enums";

config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const appUrl = process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
if (!supabaseUrl || !publishableKey || !secretKey || !databaseUrl) throw new Error("Environment integration test Phase 7 belum lengkap.");

const authUrl = supabaseUrl;
const publicKey = publishableKey;
const adminKey = secretKey;
const connectionString = databaseUrl;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const adminClient = createClient(authUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
const marker = randomUUID().slice(0, 8);
const password = randomBytes(24).toString("base64url");
const authIds: string[] = [];
const profileIds: string[] = [];
const childIds: string[] = [];
const contentIds: string[] = [];
const routeIds: string[] = [];
const categoryIds: string[] = [];

async function loginCookie(email: string) {
  const cookies = new Map<string, string>();
  const client = createServerClient(authUrl, publicKey, { cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: (values: Array<{ name: string; value: string }>) => values.forEach(({ name, value }) => cookies.set(name, value)) } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error("Login akun uji gagal.");
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function createAccount(label: string, role: UserRole) {
  const email = `phase7-${label}-${marker}@example.invalid`;
  const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Gagal membuat akun uji.");
  authIds.push(data.user.id);
  const profile = await prisma.user.findUniqueOrThrow({ where: { supabaseAuthUserId: data.user.id } });
  profileIds.push(profile.id);
  if (profile.role !== role) await prisma.user.update({ where: { id: profile.id }, data: { role } });
  return { profile, email, cookie: await loginCookie(email) };
}

async function api(path: string, cookie: string, init?: RequestInit) {
  const response = await fetch(`${appUrl}${path}`, { ...init, headers: { cookie, "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({})) as { data?: Record<string, unknown>; error?: { code?: string } };
  return { response, body };
}

try {
  const [admin, waliA, waliB] = await Promise.all([createAccount("admin", UserRole.ADMIN), createAccount("wali-a", UserRole.WALI_MURID), createAccount("wali-b", UserRole.WALI_MURID)]);
  const [normalRoute, deleteRoute, category] = await Promise.all([
    prisma.jalur.create({ data: { nama: `Phase 7 Normal ${marker}` } }),
    prisma.jalur.create({ data: { nama: `Phase 7 Delete ${marker}`, hapusDataJikaGagal: true } }),
    prisma.kategoriPendaftar.create({ data: { nama: `Phase 7 Kategori ${marker}`, tipe: KategoriTipe.EKSTERNAL } }),
  ]);
  routeIds.push(normalRoute.id, deleteRoute.id); categoryIds.push(category.id);
  const [child, otherChild, deleteChild] = await Promise.all([
    prisma.calonMurid.create({ data: { userId: waliA.profile.id, namaAnak: `Anak A ${marker}`, jalurId: normalRoute.id, kategoriId: category.id, statusKeseluruhan: StatusKeseluruhan.MENUNGGU_ASESMEN } }),
    prisma.calonMurid.create({ data: { userId: waliB.profile.id, namaAnak: `Anak B ${marker}`, jalurId: normalRoute.id, kategoriId: category.id, statusKeseluruhan: StatusKeseluruhan.MENUNGGU_ASESMEN } }),
    prisma.calonMurid.create({ data: { userId: waliA.profile.id, namaAnak: `Anak Delete ${marker}`, jalurId: deleteRoute.id, kategoriId: category.id, statusKeseluruhan: StatusKeseluruhan.MENUNGGU_ASESMEN } }),
  ]);
  childIds.push(child.id, otherChild.id, deleteChild.id);

  const forbiddenAdmin = await api("/api/admin/peserta", waliA.cookie);
  if (forbiddenAdmin.response.status !== 403) throw new Error(`Role admin bocor: ${forbiddenAdmin.response.status}`);
  const ownership = await api(`/api/konten-tahap/assessment?calon_murid_id=${otherChild.id}`, waliA.cookie);
  if (ownership.response.status !== 403) throw new Error(`Ownership konten bocor: ${ownership.response.status}`);

  for (const payload of [
    { tahap: "ASSESSMENT", judul: `Jadwal ${marker}`, tanggal: "2026-09-26", isiTeks: "Hadir sesuai jadwal.", gambarUrl: null, urutanLayout: 1, statusAktif: true, jalurId: normalRoute.id, kategoriId: category.id },
    { tahap: "ANNOUNCEMENT", judul: `Pesan ${marker}`, tanggal: null, isiTeks: "Informasi lanjutan hasil seleksi.", gambarUrl: null, urutanLayout: 1, statusAktif: true, jalurId: normalRoute.id, kategoriId: category.id },
  ]) {
    const created = await api("/api/admin/konten-tahap", admin.cookie, { method: "POST", body: JSON.stringify(payload) });
    if (created.response.status !== 201) throw new Error(`CMS gagal dibuat: ${created.response.status}`);
    contentIds.push(String(created.body.data?.id));
  }
  const assessmentContent = await api(`/api/konten-tahap/assessment?calon_murid_id=${child.id}`, waliA.cookie);
  if (assessmentContent.response.status !== 200 || !Array.isArray(assessmentContent.body.data?.content) || assessmentContent.body.data.content.length !== 1) throw new Error("Konten assessment scoped tidak ditemukan.");

  const assessment = await api(`/api/admin/peserta/${child.id}/hasil-assessment`, admin.cookie, { method: "PATCH", body: JSON.stringify({ status: "HADIR", catatan: "Lulus pemeriksaan administrasi." }) });
  if (assessment.response.status !== 200) throw new Error(`Update assessment gagal: ${assessment.response.status}`);
  const afterAssessment = await prisma.calonMurid.findUniqueOrThrow({ where: { id: child.id } });
  if (afterAssessment.statusKeseluruhan !== StatusKeseluruhan.MENUNGGU_PENGUMUMAN) throw new Error("Assessment tidak memajukan status.");

  const future = await api(`/api/admin/peserta/${child.id}/pengumuman`, admin.cookie, { method: "PATCH", body: JSON.stringify({ statusAkhir: "DITERIMA", tanggalRilis: "2099-12-31" }) });
  if (future.response.status !== 200) throw new Error(`Pengumuman future gagal: ${future.response.status}`);
  const hidden = await api(`/api/calon-murid/${child.id}/pengumuman`, waliA.cookie);
  if (hidden.response.status !== 200 || hidden.body.data?.released !== false || hidden.body.data?.statusAkhir !== null || (hidden.body.data?.content as unknown[])?.length) throw new Error("Hasil/konten pengumuman bocor sebelum rilis.");

  const released = await api(`/api/admin/peserta/${child.id}/pengumuman`, admin.cookie, { method: "PATCH", body: JSON.stringify({ statusAkhir: "DITERIMA", tanggalRilis: "2020-01-01" }) });
  if (released.response.status !== 200) throw new Error(`Pengumuman rilis gagal: ${released.response.status}`);
  const visible = await api(`/api/calon-murid/${child.id}/pengumuman`, waliA.cookie);
  if (visible.body.data?.released !== true || visible.body.data?.statusAkhir !== "DITERIMA" || !Array.isArray(visible.body.data?.content) || visible.body.data.content.length !== 1) throw new Error("Pengumuman rilis tidak tampil lengkap.");

  await api(`/api/admin/peserta/${deleteChild.id}/hasil-assessment`, admin.cookie, { method: "PATCH", body: JSON.stringify({ status: "TIDAK_HADIR", catatan: null }) });
  const blocked = await api(`/api/admin/peserta/${deleteChild.id}/pengumuman`, admin.cookie, { method: "PATCH", body: JSON.stringify({ statusAkhir: "TIDAK_DITERIMA", tanggalRilis: "2020-01-01" }) });
  if (blocked.response.status !== 409 || blocked.body.error?.code !== "PHASE8_REQUIRED") throw new Error("Kasus auto-delete tidak ditahan untuk Phase 8.");

  const audits = await prisma.auditLog.count({ where: { actorId: admin.profile.id, action: { in: ["CREATE_STAGE_CONTENT", "UPDATE_ASSESSMENT_RESULT", "UPDATE_ANNOUNCEMENT_RESULT"] } } });
  if (audits < 4) throw new Error("Audit Phase 7 tidak lengkap.");
  console.log("Phase 7 assessment & announcement integration: OK");
} finally {
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: profileIds } }, { entityId: { in: [...childIds, ...contentIds] } }] } });
  if (contentIds.length) await prisma.kontenTahap.deleteMany({ where: { id: { in: contentIds } } });
  if (childIds.length) await prisma.calonMurid.deleteMany({ where: { id: { in: childIds } } });
  if (categoryIds.length) await prisma.kategoriPendaftar.deleteMany({ where: { id: { in: categoryIds } } });
  if (routeIds.length) await prisma.jalur.deleteMany({ where: { id: { in: routeIds } } });
  if (profileIds.length) await prisma.user.deleteMany({ where: { id: { in: profileIds } } });
  for (const id of authIds) await adminClient.auth.admin.deleteUser(id);
  await prisma.$disconnect();
}
