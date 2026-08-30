import { randomBytes, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { PrismaClient } from "../generated/prisma/client";
import {
  JenisPembayaran,
  KategoriTipe,
  MetodePembayaran,
  StatusAssessment,
  StatusKeseluruhan,
  StatusPembayaran,
  UserRole,
} from "../generated/prisma/enums";

config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const appUrl = process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
if (!supabaseUrl || !publishableKey || !secretKey || !databaseUrl) throw new Error("Environment integration test Phase 8 belum lengkap.");

const authUrl = supabaseUrl;
const publicKey = publishableKey;
const adminKey = secretKey;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const adminClient = createClient(authUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
const marker = randomUUID().slice(0, 8);
const password = randomBytes(24).toString("base64url");
const authIds: string[] = [];
const profileIds: string[] = [];
const childIds: string[] = [];
const routeIds: string[] = [];
const categoryIds: string[] = [];
const paymentIds: string[] = [];

async function retry<T>(operation: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw lastError;
}

async function cleanupStaleFixtures() {
  const [profiles, routes, children] = await Promise.all([
    prisma.user.findMany({ where: { email: { startsWith: "phase8-", endsWith: "@example.invalid" } }, select: { id: true, supabaseAuthUserId: true } }),
    prisma.jalur.findMany({ where: { nama: { startsWith: "Phase 8 " } }, select: { id: true } }),
    prisma.calonMurid.findMany({ where: { namaAnak: { contains: "Phase 8" } }, select: { id: true } }),
  ]);
  const staleProfileIds = profiles.map((item) => item.id);
  const staleRouteIds = routes.map((item) => item.id);
  const staleChildIds = children.map((item) => item.id);
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: staleProfileIds } }, { entityId: { in: staleChildIds } }, { entityId: { in: staleRouteIds } }] } });
  await prisma.pembayaran.deleteMany({ where: { OR: [{ calonMuridReference: { in: staleChildIds } }, { midtransOrderId: { startsWith: "PHASE8-" } }] } });
  await prisma.calonMurid.deleteMany({ where: { OR: [{ id: { in: staleChildIds } }, { userId: { in: staleProfileIds } }] } });
  await prisma.jalur.deleteMany({ where: { id: { in: staleRouteIds } } });
  await prisma.kategoriPendaftar.deleteMany({ where: { nama: { startsWith: "Phase 8 Kategori " } } });
  await prisma.user.deleteMany({ where: { id: { in: staleProfileIds } } });
  for (const profile of profiles) await adminClient.auth.admin.deleteUser(profile.supabaseAuthUserId);
}

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
  const email = `phase8-${label}-${marker}@example.invalid`;
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
  const response = await fetch(`${appUrl}${path}`, {
    ...init,
    headers: { cookie, "content-type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({})) as ApiBody;
  return { response, body };
}

async function createSelectionChild(input: {
  userId: string;
  name: string;
  jalurId: string;
  kategoriId: string;
  createdAt: string;
  status?: StatusKeseluruhan;
  waitingTargetId?: string;
}) {
  const child = await prisma.calonMurid.create({
    data: {
      userId: input.userId,
      namaAnak: input.name,
      jalurId: input.jalurId,
      kategoriId: input.kategoriId,
      statusKeseluruhan: input.status ?? StatusKeseluruhan.MENUNGGU_PENGUMUMAN,
      menungguFallbackJalurId: input.waitingTargetId,
      createdAt: new Date(input.createdAt),
      hasilAssessment: { create: { status: StatusAssessment.HADIR } },
      ...(input.waitingTargetId ? { pengumuman: { create: { tanggalRilis: new Date("2020-01-01T00:00:00.000Z") } } } : {}),
    },
  });
  childIds.push(child.id);
  return child;
}

await retry(cleanupStaleFixtures);

try {
  const [admin, wali] = await Promise.all([
    createAccount("admin", UserRole.ADMIN),
    createAccount("wali", UserRole.WALI_MURID),
  ]);
  const category = await prisma.kategoriPendaftar.create({ data: { nama: `Phase 8 Kategori ${marker}`, tipe: KategoriTipe.EKSTERNAL, kuotaMaks: 20 } });
  categoryIds.push(category.id);
  const [regular, tcp, raceTarget, raceSource, deleteRoute] = await Promise.all([
    prisma.jalur.create({ data: { nama: `Phase 8 Reguler ${marker}`, kuotaMaks: 1 } }),
    prisma.jalur.create({ data: { nama: `Phase 8 TCP ${marker}`, kuotaMaks: 10 } }),
    prisma.jalur.create({ data: { nama: `Phase 8 Race Target ${marker}`, kuotaMaks: 1 } }),
    prisma.jalur.create({ data: { nama: `Phase 8 Race Source ${marker}`, kuotaMaks: 10 } }),
    prisma.jalur.create({ data: { nama: `Phase 8 Delete ${marker}`, kuotaMaks: 10, hapusDataJikaGagal: true } }),
  ]);
  routeIds.push(regular.id, tcp.id, raceTarget.id, raceSource.id, deleteRoute.id);
  await Promise.all([
    prisma.jalur.update({ where: { id: tcp.id }, data: { fallbackJalurId: regular.id } }),
    prisma.jalur.update({ where: { id: raceSource.id }, data: { fallbackJalurId: raceTarget.id } }),
  ]);

  const [first, second, third] = await Promise.all([
    createSelectionChild({ userId: wali.profile.id, name: `FIFO Pertama ${marker}`, jalurId: tcp.id, kategoriId: category.id, createdAt: "2026-01-01T00:00:00.000Z" }),
    createSelectionChild({ userId: wali.profile.id, name: `FIFO Kedua ${marker}`, jalurId: tcp.id, kategoriId: category.id, createdAt: "2026-01-02T00:00:00.000Z" }),
    createSelectionChild({ userId: wali.profile.id, name: `FIFO Ketiga ${marker}`, jalurId: tcp.id, kategoriId: category.id, createdAt: "2026-01-03T00:00:00.000Z" }),
  ]);
  await prisma.jalur.update({ where: { id: tcp.id }, data: { kuotaTerpakai: 3 } });

  const payment = await prisma.pembayaran.create({
    data: {
      calonMuridId: first.id,
      calonMuridReference: first.id,
      jenis: JenisPembayaran.PENDAFTARAN,
      metodePembayaran: MetodePembayaran.MIDTRANS,
      nominal: 500_000,
      status: StatusPembayaran.VERIFIED,
      midtransOrderId: `PHASE8-TRANSFER-${marker}`,
      midtransSnapToken: `phase8-transfer-token-${marker}`,
      verifiedAt: new Date(),
    },
  });
  paymentIds.push(payment.id);

  const decision = (id: string, extra?: Record<string, unknown>) => api(`/api/admin/peserta/${id}/pengumuman`, admin.cookie, { method: "PATCH", body: JSON.stringify({ statusAkhir: "TIDAK_DITERIMA", tanggalRilis: "2020-01-01", ...extra }) });
  const transferred = await decision(first.id);
  if (transferred.response.status !== 200 || (transferred.body.data?.effect as { type?: string })?.type !== "TRANSFERRED") throw new Error("Fallback dengan kuota tidak langsung transfer.");
  const firstAfter = await prisma.calonMurid.findUniqueOrThrow({ where: { id: first.id }, include: { pengumuman: true, pembayaran: true } });
  if (firstAfter.jalurId !== regular.id || firstAfter.jalurAsalId !== tcp.id || firstAfter.statusKeseluruhan !== StatusKeseluruhan.DITERIMA || firstAfter.pengumuman?.statusAkhir !== "DITERIMA" || firstAfter.pembayaran.length !== 1) throw new Error("Efek transfer langsung tidak lengkap atau pembayaran tidak dipakai ulang.");

  const [queuedSecond, queuedThird] = await Promise.all([decision(second.id), decision(third.id)]);
  if (queuedSecond.response.status !== 200 || queuedThird.response.status !== 200) throw new Error("Peserta gagal masuk antrian fallback.");
  const queue = await api(`/api/admin/jalur/${regular.id}/antrian-fallback`, admin.cookie);
  const queueItems = queue.body.data?.queue as Array<{ id: string; position: number }>;
  if (queue.response.status !== 200 || queueItems?.[0]?.id !== second.id || queueItems?.[1]?.id !== third.id) throw new Error("Urutan FIFO tidak sesuai created_at.");
  const waliQueue = await api(`/api/calon-murid/${second.id}/pengumuman`, wali.cookie);
  if (waliQueue.response.status !== 200 || waliQueue.body.data?.waitingQuota !== true || waliQueue.body.data?.statusAkhir !== null) throw new Error("Status Menunggu Kuota tidak tampil aman untuk wali.");
  const roleGuard = await api(`/api/admin/jalur/${regular.id}/antrian-fallback`, wali.cookie);
  if (roleGuard.response.status !== 403) throw new Error("Endpoint antrian tidak dilindungi role admin.");

  const quotaIncrease = await api(`/api/admin/jalur/${regular.id}`, admin.cookie, {
    method: "PATCH",
    body: JSON.stringify({ nama: regular.nama, statusAktif: true, periodeMulai: null, periodeSelesai: null, kuotaMaks: 2, fallbackJalurId: null, hapusDataJikaGagal: false }),
  });
  if (quotaIncrease.response.status !== 200) throw new Error(`Update kuota gagal: ${quotaIncrease.response.status}`);
  const [secondAfterAuto, thirdAfterAuto] = await Promise.all([
    prisma.calonMurid.findUniqueOrThrow({ where: { id: second.id } }),
    prisma.calonMurid.findUniqueOrThrow({ where: { id: third.id } }),
  ]);
  if (secondAfterAuto.statusKeseluruhan !== StatusKeseluruhan.DITERIMA || thirdAfterAuto.statusKeseluruhan !== StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK) throw new Error("Penambahan kuota tidak memproses FIFO tepat satu peserta.");

  await prisma.jalur.update({ where: { id: regular.id }, data: { kuotaTerpakai: { decrement: 1 } } });
  const manual = await api(`/api/admin/jalur/${regular.id}/proses-ulang-antrian`, admin.cookie, { method: "POST", body: "{}" });
  if (manual.response.status !== 200 || manual.body.data?.processed !== 1) throw new Error("Proses ulang manual gagal.");
  const thirdAfterManual = await prisma.calonMurid.findUniqueOrThrow({ where: { id: third.id } });
  if (thirdAfterManual.statusKeseluruhan !== StatusKeseluruhan.DITERIMA) throw new Error("Peserta terakhir tidak diproses manual.");

  const [raceFirst, raceSecond] = await Promise.all([
    createSelectionChild({ userId: wali.profile.id, name: `Race Pertama ${marker}`, jalurId: raceSource.id, kategoriId: category.id, createdAt: "2026-02-01T00:00:00.000Z", status: StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK, waitingTargetId: raceTarget.id }),
    createSelectionChild({ userId: wali.profile.id, name: `Race Kedua ${marker}`, jalurId: raceSource.id, kategoriId: category.id, createdAt: "2026-02-02T00:00:00.000Z", status: StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK, waitingTargetId: raceTarget.id }),
  ]);
  await prisma.jalur.update({ where: { id: raceSource.id }, data: { kuotaTerpakai: 2 } });
  const raceResponses = await Promise.all([
    api(`/api/admin/jalur/${raceTarget.id}/proses-ulang-antrian`, admin.cookie, { method: "POST", body: "{}" }),
    api(`/api/admin/jalur/${raceTarget.id}/proses-ulang-antrian`, admin.cookie, { method: "POST", body: "{}" }),
  ]);
  if (raceResponses.some((item) => item.response.status !== 200)) throw new Error("Race reprocess menghasilkan error.");
  const raceChildren = await prisma.calonMurid.findMany({ where: { id: { in: [raceFirst.id, raceSecond.id] } }, orderBy: { createdAt: "asc" } });
  const raceRoute = await prisma.jalur.findUniqueOrThrow({ where: { id: raceTarget.id } });
  if (raceRoute.kuotaTerpakai !== 1 || raceChildren.filter((item) => item.statusKeseluruhan === StatusKeseluruhan.DITERIMA).length !== 1 || raceChildren[0]?.statusKeseluruhan !== StatusKeseluruhan.DITERIMA) throw new Error("Race condition membobol kuota atau urutan FIFO.");

  const sibling = await prisma.calonMurid.create({ data: { userId: wali.profile.id, namaAnak: `Saudara ${marker}` } });
  childIds.push(sibling.id);
  const deleteChild = await createSelectionChild({ userId: wali.profile.id, name: `Hapus Aman ${marker}`, jalurId: deleteRoute.id, kategoriId: category.id, createdAt: "2026-03-01T00:00:00.000Z" });
  await prisma.jalur.update({ where: { id: deleteRoute.id }, data: { kuotaTerpakai: 1 } });
  const categoryUsage = await prisma.calonMurid.count({ where: { kategoriId: category.id } });
  await prisma.kategoriPendaftar.update({ where: { id: category.id }, data: { kuotaTerpakai: categoryUsage } });
  const siblingCountBeforeDelete = await prisma.calonMurid.count({
    where: { userId: wali.profile.id, id: { not: deleteChild.id } },
  });
  const retainedPayment = await prisma.pembayaran.create({
    data: {
      calonMuridId: deleteChild.id,
      calonMuridReference: deleteChild.id,
      jenis: JenisPembayaran.PENDAFTARAN,
      metodePembayaran: MetodePembayaran.MIDTRANS,
      nominal: 450_000,
      status: StatusPembayaran.VERIFIED,
      midtransOrderId: `PHASE8-DELETE-${marker}`,
      midtransTransactionId: `phase8-delete-${marker}`,
      midtransSnapToken: `phase8-delete-token-${marker}`,
      verifiedAt: new Date(),
    },
  });
  paymentIds.push(retainedPayment.id);
  const unconfirmed = await decision(deleteChild.id);
  if (unconfirmed.response.status !== 409 || unconfirmed.body.error?.code !== "AUTO_DELETE_CONFIRMATION_REQUIRED" || !await prisma.calonMurid.findUnique({ where: { id: deleteChild.id } })) throw new Error("Auto-delete berjalan tanpa konfirmasi sah.");
  const deleted = await decision(deleteChild.id, { deletionConfirmation: `HAPUS ${deleteChild.namaAnak}` });
  if (deleted.response.status !== 200 || deleted.body.data?.deleted !== true) throw new Error(`Auto-delete terkonfirmasi gagal: ${deleted.response.status}`);
  const [deletedChild, preservedSibling, preservedUser, preservedPayment, deleteAudit] = await Promise.all([
    prisma.calonMurid.findUnique({ where: { id: deleteChild.id } }),
    prisma.calonMurid.findUnique({ where: { id: sibling.id } }),
    prisma.user.findUnique({ where: { id: wali.profile.id } }),
    prisma.pembayaran.findUniqueOrThrow({ where: { id: retainedPayment.id } }),
    prisma.auditLog.findFirst({ where: { action: "AUTO_DELETE_CALON_MURID", entityId: deleteChild.id } }),
  ]);
  if (deletedChild || !preservedSibling || !preservedUser || preservedPayment.calonMuridId !== null || preservedPayment.calonMuridReference !== deleteChild.id || !deleteAudit) throw new Error("Retention auto-delete tidak aman.");
  const deleteDetail = deleteAudit.detail as {
    snapshot?: { id?: string; payments?: unknown[] };
    retention?: { paymentsRetained?: number; userAccountPreserved?: boolean; siblingCountPreserved?: number };
  };
  if (deleteDetail.snapshot?.id !== deleteChild.id || deleteDetail.snapshot.payments?.length !== 1 || deleteDetail.retention?.paymentsRetained !== 1 || deleteDetail.retention.userAccountPreserved !== true || deleteDetail.retention.siblingCountPreserved !== siblingCountBeforeDelete) throw new Error("Snapshot audit auto-delete tidak lengkap.");

  const audits = await prisma.auditLog.count({ where: { actorId: admin.profile.id, action: { in: ["AUTO_TRANSFER_FALLBACK", "QUEUE_FALLBACK", "REPROCESS_FALLBACK_QUEUE", "AUTO_DELETE_CALON_MURID"] } } });
  if (audits < 8) throw new Error("Audit Phase 8 tidak lengkap.");
  console.log("Phase 8 fallback, FIFO, reprocess & auto-delete integration: OK");
} finally {
  await retry(() => prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: profileIds } }, { entityId: { in: childIds } }, { entityId: { in: routeIds } }] } }));
  if (paymentIds.length) await retry(() => prisma.pembayaran.deleteMany({ where: { id: { in: paymentIds } } }));
  if (childIds.length) await retry(() => prisma.calonMurid.deleteMany({ where: { id: { in: childIds } } }));
  if (routeIds.length) await retry(() => prisma.jalur.deleteMany({ where: { id: { in: routeIds } } }));
  if (categoryIds.length) await retry(() => prisma.kategoriPendaftar.deleteMany({ where: { id: { in: categoryIds } } }));
  if (profileIds.length) await retry(() => prisma.user.deleteMany({ where: { id: { in: profileIds } } }));
  for (const id of authIds) await adminClient.auth.admin.deleteUser(id);
  await prisma.$disconnect();
}
