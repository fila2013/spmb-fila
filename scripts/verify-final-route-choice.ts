import { randomBytes, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { PrismaClient } from "../generated/prisma/client";
import {
  KategoriTipe,
  PilihanJalurFinal,
  StatusAssessment,
  StatusKeseluruhan,
  StatusPengumuman,
  UserRole,
} from "../generated/prisma/enums";

config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const appUrl = process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
if (!supabaseUrl || !publishableKey || !secretKey || !databaseUrl) {
  throw new Error("Environment integration test pilihan jalur final belum lengkap.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const adminClient = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
const marker = randomUUID().slice(0, 8);
const password = randomBytes(24).toString("base64url");
const authIds: string[] = [];
const profileIds: string[] = [];
const childIds: string[] = [];
const routeIds: string[] = [];
const categoryIds: string[] = [];

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
  const email = `final-route-${label}-${marker}@example.invalid`;
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

async function createWaitingChoiceChild(input: {
  userId: string;
  name: string;
  routeId: string;
  categoryId: string;
  createdAt: string;
}) {
  const child = await prisma.calonMurid.create({
    data: {
      userId: input.userId,
      namaAnak: input.name,
      jalurId: input.routeId,
      kategoriId: input.categoryId,
      statusKeseluruhan: StatusKeseluruhan.MENUNGGU_PILIHAN_JALUR,
      createdAt: new Date(input.createdAt),
      hasilAssessment: { create: { status: StatusAssessment.HADIR } },
      pengumuman: { create: { statusAkhir: StatusPengumuman.DITERIMA, tanggalRilis: new Date("2020-01-01T00:00:00.000Z") } },
    },
  });
  childIds.push(child.id);
  return child;
}

async function cleanupStaleFixtures() {
  const [profiles, routes, children, categories] = await Promise.all([
    prisma.user.findMany({ where: { email: { startsWith: "final-route-", endsWith: "@example.invalid" } }, select: { id: true, supabaseAuthUserId: true } }),
    prisma.jalur.findMany({ where: { nama: { startsWith: "Final Route " } }, select: { id: true } }),
    prisma.calonMurid.findMany({ where: { namaAnak: { startsWith: "Final Route " } }, select: { id: true } }),
    prisma.kategoriPendaftar.findMany({ where: { nama: { startsWith: "Final Route " } }, select: { id: true } }),
  ]);
  const staleProfileIds = profiles.map((item) => item.id);
  const staleRouteIds = routes.map((item) => item.id);
  const staleChildIds = children.map((item) => item.id);
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: staleProfileIds } }, { entityId: { in: [...staleChildIds, ...staleRouteIds] } }] } });
  await prisma.calonMurid.deleteMany({ where: { OR: [{ id: { in: staleChildIds } }, { userId: { in: staleProfileIds } }] } });
  await prisma.jalur.deleteMany({ where: { id: { in: staleRouteIds } } });
  await prisma.kategoriPendaftar.deleteMany({ where: { id: { in: categories.map((item) => item.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: staleProfileIds } } });
  for (const profile of profiles) await adminClient.auth.admin.deleteUser(profile.supabaseAuthUserId);
}

await retry(cleanupStaleFixtures);

try {
  const [admin, wali, otherWali] = await Promise.all([
    createAccount("admin", UserRole.ADMIN),
    createAccount("wali", UserRole.WALI_MURID),
    createAccount("other", UserRole.WALI_MURID),
  ]);
  const [categoryA, categoryB] = await Promise.all([
    prisma.kategoriPendaftar.create({ data: { nama: `Final Route Alumni ${marker}`, tipe: KategoriTipe.ALUMNI_TKFI, kuotaMaks: 20 } }),
    prisma.kategoriPendaftar.create({ data: { nama: `Final Route Eksternal ${marker}`, tipe: KategoriTipe.EKSTERNAL, kuotaMaks: 20 } }),
  ]);
  categoryIds.push(categoryA.id, categoryB.id);
  const [regular, tcp, raceRegular, raceTcp] = await Promise.all([
    prisma.jalur.create({ data: { nama: `Final Route Reguler ${marker}`, kuotaMaks: 1, periodeSelesai: new Date("2020-01-01T00:00:00.000Z") } }),
    prisma.jalur.create({ data: { nama: `Final Route TCP ${marker}`, kuotaMaks: 10 } }),
    prisma.jalur.create({ data: { nama: `Final Route Race Reguler ${marker}`, kuotaMaks: 1 } }),
    prisma.jalur.create({ data: { nama: `Final Route Race TCP ${marker}`, kuotaMaks: 10 } }),
  ]);
  routeIds.push(regular.id, tcp.id, raceRegular.id, raceTcp.id);
  await Promise.all([
    prisma.jalur.update({ where: { id: tcp.id }, data: { fallbackJalurId: regular.id, pilihanJalurFinalAktif: true } }),
    prisma.jalur.update({ where: { id: raceTcp.id }, data: { fallbackJalurId: raceRegular.id, pilihanJalurFinalAktif: true } }),
  ]);

  const releaseChild = await prisma.calonMurid.create({
    data: {
      userId: wali.profile.id,
      namaAnak: `Final Route Release ${marker}`,
      jalurId: tcp.id,
      kategoriId: categoryA.id,
      statusKeseluruhan: StatusKeseluruhan.MENUNGGU_PENGUMUMAN,
      hasilAssessment: { create: { status: StatusAssessment.HADIR } },
    },
  });
  childIds.push(releaseChild.id);
  const released = await api(`/api/admin/peserta/${releaseChild.id}/pengumuman`, admin.cookie, {
    method: "PATCH",
    body: JSON.stringify({ statusAkhir: StatusPengumuman.DITERIMA, tanggalRilis: "2020-01-01" }),
  });
  const releaseAfter = await prisma.calonMurid.findUniqueOrThrow({ where: { id: releaseChild.id } });
  if (released.response.status !== 200 || releaseAfter.statusKeseluruhan !== StatusKeseluruhan.MENUNGGU_PILIHAN_JALUR) {
    throw new Error("Pengumuman diterima tidak membuka tahap pilihan kelas final.");
  }

  const stayChild = releaseChild;
  const availableChild = await createWaitingChoiceChild({ userId: wali.profile.id, name: `Final Route Available ${marker}`, routeId: tcp.id, categoryId: categoryB.id, createdAt: "2026-01-02T00:00:00.000Z" });
  const queuedChild = await createWaitingChoiceChild({ userId: wali.profile.id, name: `Final Route Queue ${marker}`, routeId: tcp.id, categoryId: categoryA.id, createdAt: "2026-01-03T00:00:00.000Z" });
  await prisma.jalur.update({ where: { id: tcp.id }, data: { kuotaTerpakai: 3 } });

  const choice = (id: string, cookie: string, pilihan: PilihanJalurFinal, confirmation = "SETUJU") => api(`/api/calon-murid/${id}/pilihan-jalur-final`, cookie, {
    method: "PATCH",
    body: JSON.stringify({ pilihan, confirmation }),
  });
  const ownership = await choice(stayChild.id, otherWali.cookie, PilihanJalurFinal.TETAP_JALUR_ASAL);
  if (ownership.response.status !== 403) throw new Error("Ownership pilihan kelas final tidak terlindungi.");
  const noConfirmation = await choice(stayChild.id, wali.cookie, PilihanJalurFinal.TETAP_JALUR_ASAL, "");
  if (noConfirmation.response.status !== 422) throw new Error("Pilihan final diterima tanpa konfirmasi eksplisit.");

  const stayed = await choice(stayChild.id, wali.cookie, PilihanJalurFinal.TETAP_JALUR_ASAL);
  const stayedAgain = await choice(stayChild.id, wali.cookie, PilihanJalurFinal.TETAP_JALUR_ASAL);
  const changed = await choice(stayChild.id, wali.cookie, PilihanJalurFinal.JALUR_FALLBACK);
  const stayAfter = await prisma.calonMurid.findUniqueOrThrow({ where: { id: stayChild.id } });
  const tcpAfterStay = await prisma.jalur.findUniqueOrThrow({ where: { id: tcp.id } });
  if (stayed.response.status !== 200 || stayedAgain.response.status !== 200 || changed.response.status !== 409 || stayAfter.jalurId !== tcp.id || stayAfter.statusKeseluruhan !== StatusKeseluruhan.DITERIMA || tcpAfterStay.kuotaTerpakai !== 3) {
    throw new Error("Pilihan tetap TCP tidak final, idempotent, atau menjaga kuota.");
  }

  const moved = await choice(availableChild.id, wali.cookie, PilihanJalurFinal.JALUR_FALLBACK);
  const moveAfter = await prisma.calonMurid.findUniqueOrThrow({ where: { id: availableChild.id } });
  const [tcpAfterMove, regularAfterMove] = await Promise.all([
    prisma.jalur.findUniqueOrThrow({ where: { id: tcp.id } }),
    prisma.jalur.findUniqueOrThrow({ where: { id: regular.id } }),
  ]);
  if (moved.response.status !== 200 || moveAfter.jalurId !== regular.id || moveAfter.jalurAsalId !== tcp.id || moveAfter.statusKeseluruhan !== StatusKeseluruhan.DITERIMA || tcpAfterMove.kuotaTerpakai !== 2 || regularAfterMove.kuotaTerpakai !== 1) {
    throw new Error("Pilihan Reguler dengan kuota tidak memindahkan alokasi secara atomik.");
  }

  const queued = await choice(queuedChild.id, wali.cookie, PilihanJalurFinal.JALUR_FALLBACK);
  const queueAfter = await prisma.calonMurid.findUniqueOrThrow({ where: { id: queuedChild.id } });
  const tcpAfterQueue = await prisma.jalur.findUniqueOrThrow({ where: { id: tcp.id } });
  if (queued.response.status !== 200 || queued.body.data?.queued !== true || queueAfter.jalurId !== null || queueAfter.menungguFallbackJalurId !== regular.id || queueAfter.statusKeseluruhan !== StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK || tcpAfterQueue.kuotaTerpakai !== 1) {
    throw new Error("Jalur Reguler penuh tidak melepas TCP atau masuk antrean dengan benar.");
  }
  const quotaIncrease = await api(`/api/admin/jalur/${regular.id}`, admin.cookie, {
    method: "PATCH",
    body: JSON.stringify({ nama: regular.nama, statusAktif: true, periodeMulai: null, periodeSelesai: "2020-01-01", kuotaMaks: 2, fallbackJalurId: null, hapusDataJikaGagal: false, pilihanJalurFinalAktif: false }),
  });
  const queueReprocessed = await prisma.calonMurid.findUniqueOrThrow({ where: { id: queuedChild.id } });
  if (quotaIncrease.response.status !== 200 || queueReprocessed.jalurId !== regular.id || queueReprocessed.statusKeseluruhan !== StatusKeseluruhan.DITERIMA) {
    throw new Error("Penambahan kuota tidak memproses pilihan Reguler dalam FIFO.");
  }

  const [raceFirst, raceSecond] = await Promise.all([
    createWaitingChoiceChild({ userId: wali.profile.id, name: `Final Route Race A ${marker}`, routeId: raceTcp.id, categoryId: categoryA.id, createdAt: "2026-02-01T00:00:00.000Z" }),
    createWaitingChoiceChild({ userId: wali.profile.id, name: `Final Route Race B ${marker}`, routeId: raceTcp.id, categoryId: categoryB.id, createdAt: "2026-02-02T00:00:00.000Z" }),
  ]);
  await prisma.jalur.update({ where: { id: raceTcp.id }, data: { kuotaTerpakai: 2 } });
  const raceResponses = await Promise.all([
    choice(raceFirst.id, wali.cookie, PilihanJalurFinal.JALUR_FALLBACK),
    choice(raceSecond.id, wali.cookie, PilihanJalurFinal.JALUR_FALLBACK),
  ]);
  const [raceChildren, raceSourceAfter, raceTargetAfter] = await Promise.all([
    prisma.calonMurid.findMany({ where: { id: { in: [raceFirst.id, raceSecond.id] } } }),
    prisma.jalur.findUniqueOrThrow({ where: { id: raceTcp.id } }),
    prisma.jalur.findUniqueOrThrow({ where: { id: raceRegular.id } }),
  ]);
  if (raceResponses.some((item) => item.response.status !== 200) || raceSourceAfter.kuotaTerpakai !== 0 || raceTargetAfter.kuotaTerpakai !== 1 || raceChildren.filter((item) => item.statusKeseluruhan === StatusKeseluruhan.DITERIMA).length !== 1 || raceChildren.filter((item) => item.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK).length !== 1) {
    throw new Error("Race pilihan Reguler membobol kuota atau tidak melepaskan seluruh kuota TCP.");
  }

  const audits = await prisma.auditLog.count({ where: { actorId: wali.profile.id, action: { in: ["SELECT_FINAL_ROUTE", "QUEUE_FINAL_ROUTE_CHOICE"] } } });
  if (audits < 5) throw new Error("Audit pilihan jalur final tidak lengkap.");
  console.log("Pilihan kelas final TCP, ownership, FIFO, idempotency & race: OK");
} finally {
  await retry(() => prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: profileIds } }, { entityId: { in: [...childIds, ...routeIds] } }] } }));
  if (childIds.length) await retry(() => prisma.calonMurid.deleteMany({ where: { id: { in: childIds } } }));
  if (routeIds.length) await retry(() => prisma.jalur.deleteMany({ where: { id: { in: routeIds } } }));
  if (categoryIds.length) await retry(() => prisma.kategoriPendaftar.deleteMany({ where: { id: { in: categoryIds } } }));
  if (profileIds.length) await retry(() => prisma.user.deleteMany({ where: { id: { in: profileIds } } }));
  for (const id of authIds) await adminClient.auth.admin.deleteUser(id);
  await prisma.$disconnect();
}
