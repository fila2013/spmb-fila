import { randomBytes, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { PrismaClient } from "../generated/prisma/client";
import {
  KategoriTipe,
  MetodePembayaran,
  ModePembayaranPendaftaran,
  StatusKeseluruhan,
  StatusPembayaran,
  UserRole,
} from "../generated/prisma/enums";

config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const adminKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const bucket = process.env.SUPABASE_STORAGE_BUCKET_PEMBAYARAN;
const appUrl = process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
if (!supabaseUrl || !publishableKey || !adminKey || !databaseUrl || !bucket) {
  throw new Error("Environment integration pembayaran dinamis belum lengkap.");
}

const authUrl = supabaseUrl;
const publicKey = publishableKey;
const secretKey = adminKey;
const databaseConnection = databaseUrl;
const paymentBucket = bucket;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseConnection }) });
const adminClient = createClient(authUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
const marker = randomUUID().slice(0, 8);
const password = randomBytes(24).toString("base64url");
const authIds: string[] = [];
const profileIds: string[] = [];
const childIds: string[] = [];
let routeId: string | undefined;
let categoryId: string | undefined;
let feeId: string | undefined;
let bankId: string | undefined;
let proofPath: string | undefined;

async function loginCookie(email: string) {
  const cookies = new Map<string, string>();
  const client = createServerClient(authUrl, publicKey, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (values: Array<{ name: string; value: string }>) =>
        values.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error("Login akun uji gagal.");
  const verificationClient = createServerClient(authUrl, publicKey, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: () => undefined,
    },
  });
  const { data: claims, error: claimsError } = await verificationClient.auth.getClaims();
  if (claimsError || !claims?.claims.sub) {
    throw claimsError ?? new Error("Cookie SSR uji tidak menghasilkan claims.");
  }
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function createAccount(label: string, role: UserRole) {
  const email = `dynamic-${label}-${marker}@example.invalid`;
  const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Gagal membuat akun uji.");
  authIds.push(data.user.id);
  const profile = await prisma.user.findUniqueOrThrow({ where: { supabaseAuthUserId: data.user.id } });
  await prisma.user.update({ where: { id: profile.id }, data: { role } });
  profileIds.push(profile.id);
  return { profile, cookie: await loginCookie(email) };
}

async function api(path: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(`${appUrl}${path}`, { ...init, headers });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() as Record<string, unknown> : null;
  return { response, body };
}

function validPng(size = 8) {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], "bukti.png", { type: "image/png" });
}

const initialSetting = await prisma.pengaturanPembayaran.findUniqueOrThrow({ where: { id: "pendaftaran" } });
const initialAccountCount = await prisma.rekeningBank.count();

try {
  const [admin, wali, other] = await Promise.all([
    createAccount("admin", UserRole.ADMIN),
    createAccount("owner", UserRole.WALI_MURID),
    createAccount("other", UserRole.WALI_MURID),
  ]);
  const unauthorized = await api("/api/admin/settings/payment", {}, wali.cookie);
  if (unauthorized.response.status !== 403) throw new Error("Settings admin dapat diakses wali.");

  const bank = await api("/api/admin/settings/bank-accounts", {
    method: "POST",
    body: JSON.stringify({ namaBank: `Bank ${marker}`, nomorRekening: "7123456789", atasNama: "SDIT Fitrah Insani" }),
  }, admin.cookie);
  if (bank.response.status !== 201) throw new Error(`Tambah rekening gagal: ${bank.response.status}`);
  bankId = (bank.body?.data as { id?: string })?.id;
  if (!bankId) throw new Error("ID rekening tidak dikembalikan.");

  const manualMode = await api("/api/admin/settings/payment", {
    method: "PATCH",
    body: JSON.stringify({ mode: ModePembayaranPendaftaran.MANUAL }),
  }, admin.cookie);
  if (!manualMode.response.ok) throw new Error("Mode manual gagal diaktifkan.");

  const route = await prisma.jalur.create({ data: { nama: `Dinamis ${marker}`, kuotaMaks: 3 } });
  routeId = route.id;
  const category = await prisma.kategoriPendaftar.create({ data: { nama: `Dinamis ${marker}`, tipe: KategoriTipe.EKSTERNAL, kuotaMaks: 3 } });
  categoryId = category.id;
  const fee = await prisma.biayaPendaftaran.create({ data: { jalurId: route.id, kategoriId: category.id, nominal: 25_000 } });
  feeId = fee.id;
  const child = await prisma.calonMurid.create({ data: {
    userId: wali.profile.id,
    namaAnak: `Anak Dinamis ${marker}`,
    jalurId: route.id,
    kategoriId: category.id,
    subKategoriText: "TK Uji",
    statusKeseluruhan: StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR,
  } });
  childIds.push(child.id);

  const midtransDisabled = await api(`/api/calon-murid/${child.id}/pembayaran/midtrans/create`, { method: "POST" }, wali.cookie);
  if (midtransDisabled.response.status !== 409) throw new Error("Midtrans tidak digate saat mode manual.");

  const fake = new FormData();
  fake.set("bukti", new File([new Uint8Array([1, 2, 3])], "palsu.png", { type: "image/png" }));
  const fakeResult = await api(`/api/calon-murid/${child.id}/pembayaran/manual`, { method: "POST", body: fake }, wali.cookie);
  if (fakeResult.response.status !== 422) throw new Error("Signature file palsu tidak ditolak.");

  const tooLarge = new FormData();
  tooLarge.set("bukti", validPng(500 * 1024 + 1));
  const largeResult = await api(`/api/calon-murid/${child.id}/pembayaran/manual`, { method: "POST", body: tooLarge }, wali.cookie);
  if (largeResult.response.status !== 413) throw new Error("Bukti lebih dari 500 KB tidak ditolak.");

  const otherProof = new FormData();
  otherProof.set("bukti", validPng());
  const ownership = await api(`/api/calon-murid/${child.id}/pembayaran/manual`, { method: "POST", body: otherProof }, other.cookie);
  if (ownership.response.status !== 403) throw new Error("Ownership upload manual gagal.");

  const proof = new FormData();
  proof.set("bukti", validPng());
  const uploaded = await api(`/api/calon-murid/${child.id}/pembayaran/manual`, { method: "POST", body: proof }, wali.cookie);
  if (uploaded.response.status !== 201) throw new Error(`Upload manual gagal: ${uploaded.response.status}`);
  const [payment, enrolled] = await Promise.all([
    prisma.pembayaran.findFirstOrThrow({ where: { calonMuridReference: child.id, jenis: "PENDAFTARAN" } }),
    prisma.calonMurid.findUniqueOrThrow({ where: { id: child.id } }),
  ]);
  proofPath = payment.fileBuktiUrl ?? undefined;
  if (payment.status !== StatusPembayaran.VERIFIED || payment.metodePembayaran !== MetodePembayaran.MANUAL_TRANSFER || payment.nominal !== fee.nominal || !payment.verifiedAt || enrolled.statusKeseluruhan !== StatusKeseluruhan.ENROLLMENT) {
    throw new Error("Transisi atomik manual ke VERIFIED/ENROLLMENT tidak sesuai.");
  }
  const downloaded = await api(`/api/admin/pembayaran/${payment.id}/bukti`, {}, admin.cookie);
  if (!downloaded.response.ok || !downloaded.response.headers.get("content-disposition")?.includes("attachment")) {
    throw new Error("Admin tidak dapat mengunduh bukti manual.");
  }

  if (initialAccountCount === 0) {
    const protectedDelete = await api(`/api/admin/settings/bank-accounts/${bankId}`, { method: "DELETE" }, admin.cookie);
    if (protectedDelete.response.status !== 409) throw new Error("Rekening terakhir dapat dihapus saat mode manual.");
  }

  console.log("Dynamic registration payment integration: OK");
} finally {
  await prisma.pengaturanPembayaran.update({
    where: { id: "pendaftaran" },
    data: { mode: initialSetting.mode, updatedById: initialSetting.updatedById },
  });
  if (proofPath) await adminClient.storage.from(paymentBucket).remove([proofPath]);
  const payments = childIds.length ? await prisma.pembayaran.findMany({ where: { calonMuridReference: { in: childIds } }, select: { id: true } }) : [];
  if (profileIds.length) await prisma.auditLog.deleteMany({ where: { actorId: { in: profileIds } } });
  if (payments.length) await prisma.auditLog.deleteMany({ where: { entityId: { in: payments.map(({ id }) => id) } } });
  if (payments.length) await prisma.pembayaran.deleteMany({ where: { id: { in: payments.map(({ id }) => id) } } });
  if (childIds.length) await prisma.calonMurid.deleteMany({ where: { id: { in: childIds } } });
  if (feeId) await prisma.biayaPendaftaran.deleteMany({ where: { id: feeId } });
  if (routeId) await prisma.jalur.deleteMany({ where: { id: routeId } });
  if (categoryId) await prisma.kategoriPendaftar.deleteMany({ where: { id: categoryId } });
  if (bankId) await prisma.rekeningBank.deleteMany({ where: { id: bankId } });
  if (profileIds.length) await prisma.user.deleteMany({ where: { id: { in: profileIds } } });
  for (const id of authIds) await adminClient.auth.admin.deleteUser(id);
  await prisma.$disconnect();
}
