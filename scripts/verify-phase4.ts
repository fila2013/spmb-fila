import { randomBytes, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../generated/prisma/client";
import {
  JenisPembayaran,
  KategoriTipe,
  MetodePembayaran,
  StatusHoldKuota,
  StatusKeseluruhan,
  StatusPembayaran,
} from "../generated/prisma/enums";
import { CRITICAL_QUOTA_HOLD_MESSAGE } from "../lib/quota-hold/rules";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const cronSecret = process.env.CRON_SECRET;

if (!supabaseUrl || !publishableKey || !secretKey || !databaseUrl || !cronSecret) {
  throw new Error("Environment integration test Phase 4 belum lengkap.");
}

const authUrl = supabaseUrl;
const publicKey = publishableKey;
const adminKey = secretKey;
const connectionString = databaseUrl;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const adminClient = createClient(authUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
const marker = randomUUID().slice(0, 8);
const password = randomBytes(24).toString("base64url");
const authUserIds: string[] = [];
const profileIds: string[] = [];
const childIds: string[] = [];
const routeIds: string[] = [];
const categoryIds: string[] = [];
const feeIds: string[] = [];
const paymentIds: string[] = [];
const holdIds: string[] = [];

async function sessionCookie(accessToken: string, refreshToken: string) {
  const cookies = new Map<string, string>();
  const client = createServerClient(authUrl, publicKey, {
    cookies: {
      getAll: () => [],
      setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) throw error;
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function createWali(label: string) {
  const email = `phase4-${label}-${marker}@example.invalid`;
  const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Gagal membuat akun uji.");
  authUserIds.push(data.user.id);
  const profile = await prisma.user.findUniqueOrThrow({ where: { supabaseAuthUserId: data.user.id } });
  profileIds.push(profile.id);
  const publicClient = createClient(authUrl, publicKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: login, error: loginError } = await publicClient.auth.signInWithPassword({ email, password });
  if (loginError || !login.session) throw loginError ?? new Error("Login akun uji gagal.");
  const cookie = await sessionCookie(login.session.access_token, login.session.refresh_token);
  await publicClient.auth.signOut();
  return { profile, cookie };
}

async function api(path: string, cookie: string, init?: RequestInit) {
  const response = await fetch(`${appUrl}${path}`, {
    ...init,
    headers: { cookie, "content-type": "application/json", ...init?.headers },
  });
  let body: unknown;
  try { body = await response.json(); } catch { body = null; }
  return { response, body: body as { data?: { id?: string } | Array<{ id: string; userId: string }>; error?: { code?: string; message?: string } } };
}

async function createDraft(cookie: string, name: string, maliciousUserId?: string) {
  const result = await api("/api/calon-murid", cookie, {
    method: "POST",
    body: JSON.stringify({ namaAnak: name, tempatLahir: "Bandar Lampung", tanggalLahir: "2020-01-01", userId: maliciousUserId }),
  });
  if (result.response.status !== 201 || !result.body.data || Array.isArray(result.body.data) || !result.body.data.id) {
    throw new Error(`Gagal membuat draft (${result.response.status}).`);
  }
  childIds.push(result.body.data.id);
  return result.body.data.id;
}

try {
  const [waliA, waliB] = await Promise.all([createWali("a"), createWali("b")]);

  const routeRace = await prisma.jalur.create({ data: { nama: `Race Jalur ${marker}`, kuotaMaks: 1 } });
  const routeCategory = await prisma.jalur.create({ data: { nama: `Kategori Jalur ${marker}`, kuotaMaks: 1 } });
  routeIds.push(routeRace.id, routeCategory.id);
  const category = await prisma.kategoriPendaftar.create({ data: { nama: `Race Kategori ${marker}`, tipe: KategoriTipe.EKSTERNAL, kuotaMaks: 1 } });
  const noFeeCategory = await prisma.kategoriPendaftar.create({ data: { nama: `Tanpa Biaya ${marker}`, tipe: KategoriTipe.EKSTERNAL, kuotaMaks: 1 } });
  categoryIds.push(category.id, noFeeCategory.id);
  const fee = await prisma.biayaPendaftaran.create({ data: { jalurId: routeCategory.id, kategoriId: category.id, nominal: 500_000 } });
  feeIds.push(fee.id);

  const raceA = await createDraft(waliA.cookie, "Anak Race A", waliB.profile.id);
  const raceB = await createDraft(waliB.cookie, "Anak Race B");
  const routeResults = await Promise.all([
    api(`/api/calon-murid/${raceA}/jalur`, waliA.cookie, { method: "PATCH", body: JSON.stringify({ jalurId: routeRace.id }) }),
    api(`/api/calon-murid/${raceB}/jalur`, waliB.cookie, { method: "PATCH", body: JSON.stringify({ jalurId: routeRace.id }) }),
  ]);
  const routeStatuses = routeResults.map(({ response }) => response.status).sort();
  if (routeStatuses.join(",") !== "200,200") throw new Error(`Pemilihan jalur memakai kuota sebelum pembayaran: ${routeStatuses.join(",")}`);
  const routeAfter = await prisma.jalur.findUniqueOrThrow({ where: { id: routeRace.id } });
  if (routeAfter.kuotaTerpakai !== 0) throw new Error("Pemilihan jalur mengubah kuota terpakai sebelum pembayaran verified.");

  const categoryA = await createDraft(waliA.cookie, "Anak Kategori A", waliB.profile.id);
  const categoryB = await createDraft(waliA.cookie, "Anak Kategori B");
  for (const id of [categoryA, categoryB]) {
    const selected = await api(`/api/calon-murid/${id}/jalur`, waliA.cookie, { method: "PATCH", body: JSON.stringify({ jalurId: routeCategory.id }) });
    if (selected.response.status !== 200) throw new Error("Pemilihan jalur kategori gagal.");
  }
  const categoryResults = await Promise.all([
    api(`/api/calon-murid/${categoryA}/kategori`, waliA.cookie, { method: "PATCH", body: JSON.stringify({ kategoriId: category.id, subKategoriText: "TK Uji A" }) }),
    api(`/api/calon-murid/${categoryB}/kategori`, waliA.cookie, { method: "PATCH", body: JSON.stringify({ kategoriId: category.id, subKategoriText: "TK Uji B" }) }),
  ]);
  const categoryStatuses = categoryResults.map(({ response }) => response.status).sort();
  if (categoryStatuses.join(",") !== "200,409") throw new Error(`Race kuota kategori tidak aman: ${categoryStatuses.join(",")}`);
  const categoryAfter = await prisma.kategoriPendaftar.findUniqueOrThrow({ where: { id: category.id } });
  if (categoryAfter.kuotaTerpakai !== 0) throw new Error("Hold kategori mengubah kuota terpakai sebelum pembayaran verified.");

  const winningCategoryChild = categoryResults[0].response.status === 200 ? categoryA : categoryB;
  const losingResult = categoryResults[0].response.status === 409 ? categoryResults[0] : categoryResults[1];
  if (losingResult.body.error?.message !== CRITICAL_QUOTA_HOLD_MESSAGE) {
    throw new Error("Peserta kedua tidak menerima peringatan hold kuota terakhir yang diwajibkan.");
  }
  const activeHold = await prisma.holdKuotaPendaftaran.findUniqueOrThrow({ where: { calonMuridId: winningCategoryChild } });
  holdIds.push(activeHold.id);
  if (activeHold.status !== StatusHoldKuota.PENDING_PAYMENT || activeHold.expiresAt <= new Date()) {
    throw new Error("Hold pembayaran pemenang race tidak aktif.");
  }
  const routeAfterHold = await prisma.jalur.findUniqueOrThrow({ where: { id: routeCategory.id } });
  if (routeAfterHold.kuotaTerpakai !== 0) throw new Error("Hold jalur tercatat sebagai kuota permanen.");
  const blockedAtRoute = await api(`/api/calon-murid/${raceA}/jalur`, waliA.cookie, { method: "PATCH", body: JSON.stringify({ jalurId: routeCategory.id }) });
  if (blockedAtRoute.response.status !== 409 || blockedAtRoute.body.error?.message !== CRITICAL_QUOTA_HOLD_MESSAGE) {
    throw new Error("Hold kuota terakhir tidak memblokir peserta baru pada pilihan jalur.");
  }

  const losingCategoryChild = categoryResults[0].response.status === 409 ? categoryA : categoryB;
  const feeMissing = await api(`/api/calon-murid/${losingCategoryChild}/kategori`, waliA.cookie, { method: "PATCH", body: JSON.stringify({ kategoriId: noFeeCategory.id, subKategoriText: "TK Uji" }) });
  if (feeMissing.response.status !== 422) throw new Error(`Kategori tanpa biaya tidak diblokir: ${feeMissing.response.status}`);
  const noFeeAfter = await prisma.kategoriPendaftar.findUniqueOrThrow({ where: { id: noFeeCategory.id } });
  if (noFeeAfter.kuotaTerpakai !== 0) throw new Error("Kategori tanpa biaya mengonsumsi kuota.");

  const forbidden = await api(`/api/calon-murid/${categoryA}`, waliB.cookie);
  if (forbidden.response.status !== 403) throw new Error(`Ownership guard gagal: ${forbidden.response.status}`);
  const list = await api("/api/calon-murid", waliA.cookie);
  if (!Array.isArray(list.body.data) || list.body.data.length < 3 || list.body.data.some((item) => item.userId !== waliA.profile.id)) {
    throw new Error("Daftar multi-child tidak terisolasi berdasarkan pemilik.");
  }
  const maliciousDraft = await prisma.calonMurid.findUniqueOrThrow({ where: { id: raceA } });
  if (maliciousDraft.userId !== waliA.profile.id) throw new Error("userId dari client dipercaya server.");
  const completed = await prisma.calonMurid.count({ where: { id: { in: [categoryA, categoryB] }, statusKeseluruhan: StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR } });
  if (completed !== 1) throw new Error("Transisi status kategori tidak tepat.");

  const cronChild = await prisma.calonMurid.create({
    data: {
      userId: waliA.profile.id,
      namaAnak: `Anak Cron ${marker}`,
      jalurId: routeRace.id,
      kategoriId: category.id,
      subKategoriText: "TK Cron",
      statusKeseluruhan: StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR,
    },
  });
  childIds.push(cronChild.id);
  const expiredHold = await prisma.holdKuotaPendaftaran.create({
    data: {
      calonMuridId: cronChild.id,
      jalurId: routeRace.id,
      kategoriId: category.id,
      status: StatusHoldKuota.PENDING_PAYMENT,
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  holdIds.push(expiredHold.id);
  const expiredPayment = await prisma.pembayaran.create({
    data: {
      calonMuridId: cronChild.id,
      calonMuridReference: cronChild.id,
      jenis: JenisPembayaran.PENDAFTARAN,
      metodePembayaran: MetodePembayaran.MIDTRANS,
      nominal: fee.nominal,
      status: StatusPembayaran.PENDING,
    },
  });
  paymentIds.push(expiredPayment.id);
  const unauthorizedCron = await fetch(`${appUrl}/api/cron/expire-registration-holds`);
  if (unauthorizedCron.status !== 401) throw new Error("Endpoint cron tidak dilindungi CRON_SECRET.");
  const cron = await fetch(`${appUrl}/api/cron/expire-registration-holds`, {
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  if (!cron.ok) throw new Error(`Cleanup hold terjadwal gagal: ${cron.status}.`);
  const [cleanedHold, cleanedPayment, cleanedChild] = await Promise.all([
    prisma.holdKuotaPendaftaran.findUniqueOrThrow({ where: { id: expiredHold.id } }),
    prisma.pembayaran.findUniqueOrThrow({ where: { id: expiredPayment.id } }),
    prisma.calonMurid.findUniqueOrThrow({ where: { id: cronChild.id } }),
  ]);
  if (
    cleanedHold.status !== StatusHoldKuota.EXPIRED ||
    cleanedPayment.status !== StatusPembayaran.REJECTED ||
    cleanedChild.statusKeseluruhan !== StatusKeseluruhan.PILIH_JALUR
  ) {
    throw new Error("Cleanup terjadwal tidak melepas hold, transaksi, dan tahap peserta secara konsisten.");
  }

  console.log("Phase 4 integration: OK");
} finally {
  const auditEntityIds = [...childIds, ...paymentIds, ...holdIds];
  if (auditEntityIds.length) {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: auditEntityIds } } });
  }
  if (paymentIds.length) {
    await prisma.pembayaran.deleteMany({ where: { id: { in: paymentIds } } });
  }
  if (childIds.length) {
    await prisma.calonMurid.deleteMany({ where: { id: { in: childIds } } });
  }
  if (feeIds.length) await prisma.biayaPendaftaran.deleteMany({ where: { id: { in: feeIds } } });
  if (categoryIds.length) await prisma.kategoriPendaftar.deleteMany({ where: { id: { in: categoryIds } } });
  if (routeIds.length) await prisma.jalur.deleteMany({ where: { id: { in: routeIds } } });
  if (profileIds.length) await prisma.user.deleteMany({ where: { id: { in: profileIds } } });
  for (const id of authUserIds) await adminClient.auth.admin.deleteUser(id);
  await prisma.$disconnect();
}
