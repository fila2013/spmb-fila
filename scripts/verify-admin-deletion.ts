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
  StatusKeseluruhan,
  StatusPembayaran,
  UserRole,
} from "../generated/prisma/enums";

config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const appUrl =
  process.argv[2] ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

if (!supabaseUrl || !publishableKey || !secretKey || !databaseUrl) {
  throw new Error("Environment integration test admin deletion belum lengkap.");
}

const authUrl = supabaseUrl;
const publicKey = publishableKey;
const adminKey = secretKey;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const auth = createClient(authUrl, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const marker = randomUUID().slice(0, 8);
const password = randomBytes(24).toString("base64url");
const authIds: string[] = [];
const profileIds: string[] = [];
const entityIds: string[] = [];
let routeId: string | null = null;
let categoryId: string | null = null;
let paymentId: string | null = null;

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
  const client = createServerClient(authUrl, publicKey, {
    cookies: {
      getAll: () =>
        [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (values: Array<{ name: string; value: string }>) =>
        values.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) throw error ?? new Error("Login uji gagal.");
  return [...cookies]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function createAccount(label: string, role: UserRole) {
  const email = `admin-delete-${label}-${marker}@example.invalid`;
  const { data, error } = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Akun uji gagal dibuat.");
  authIds.push(data.user.id);
  const profile = await prisma.user.findUniqueOrThrow({
    where: { supabaseAuthUserId: data.user.id },
  });
  profileIds.push(profile.id);
  if (profile.role !== role) {
    await prisma.user.update({ where: { id: profile.id }, data: { role } });
  }
  return {
    authId: data.user.id,
    profileId: profile.id,
    email,
    cookie: await loginCookie(email),
  };
}

type ApiBody = {
  data?: Record<string, unknown>;
  error?: { code?: string; message?: string };
};

async function remove(
  path: string,
  cookie: string,
  confirmation: string,
) {
  const response = await fetch(`${appUrl}${path}`, {
    method: "DELETE",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ confirmation }),
  });
  const body = (await response.json().catch(() => ({}))) as ApiBody;
  return { response, body };
}

try {
  const [admin, guardian] = await Promise.all([
    createAccount("admin", UserRole.ADMIN),
    createAccount("wali", UserRole.WALI_MURID),
  ]);
  const route = await prisma.jalur.create({
    data: {
      nama: `Admin Delete Jalur ${marker}`,
      kuotaMaks: 5,
      kuotaTerpakai: 1,
    },
  });
  routeId = route.id;
  const category = await prisma.kategoriPendaftar.create({
    data: {
      nama: `Admin Delete Kategori ${marker}`,
      tipe: KategoriTipe.EKSTERNAL,
      kuotaMaks: 5,
      kuotaTerpakai: 1,
    },
  });
  categoryId = category.id;
  const child = await prisma.calonMurid.create({
    data: {
      userId: guardian.profileId,
      namaAnak: `Peserta Hapus ${marker}`,
      jalurId: route.id,
      kategoriId: category.id,
      statusKeseluruhan: StatusKeseluruhan.SELESAI,
    },
  });
  entityIds.push(child.id, guardian.profileId);
  const payment = await prisma.pembayaran.create({
    data: {
      calonMuridId: child.id,
      calonMuridReference: child.id,
      jenis: JenisPembayaran.PENDAFTARAN,
      metodePembayaran: MetodePembayaran.MIDTRANS,
      nominal: 500_000,
      status: StatusPembayaran.VERIFIED,
      midtransOrderId: `ADMIN-DELETE-${marker}`,
      midtransSnapToken: `admin-delete-token-${marker}`,
      verifiedAt: new Date(),
    },
  });
  paymentId = payment.id;

  const roleGuard = await remove(
    `/api/admin/peserta/${child.id}`,
    guardian.cookie,
    `HAPUS ${child.namaAnak}`,
  );
  if (roleGuard.response.status !== 403) {
    throw new Error(
      `Penghapusan peserta tidak dilindungi role admin (${roleGuard.response.status}: ${roleGuard.body.error?.code ?? "unknown"}).`,
    );
  }

  const guardianBlocked = await remove(
    `/api/admin/wali-murid/${guardian.profileId}`,
    admin.cookie,
    `HAPUS ${guardian.email}`,
  );
  if (
    guardianBlocked.response.status !== 409 ||
    guardianBlocked.body.error?.code !== "GUARDIAN_HAS_CHILDREN"
  ) {
    throw new Error("Wali dengan peserta masih dapat dihapus.");
  }

  const wrongConfirmation = await remove(
    `/api/admin/peserta/${child.id}`,
    admin.cookie,
    "HAPUS SALAH",
  );
  if (
    wrongConfirmation.response.status !== 409 ||
    wrongConfirmation.body.error?.code !== "DELETE_CONFIRMATION_REQUIRED"
  ) {
    throw new Error("Konfirmasi peserta yang salah tidak ditolak.");
  }

  const participantDeleted = await remove(
    `/api/admin/peserta/${child.id}`,
    admin.cookie,
    `HAPUS ${child.namaAnak}`,
  );
  if (participantDeleted.response.status !== 200) {
    throw new Error(
      `Penghapusan peserta gagal: ${participantDeleted.response.status}`,
    );
  }

  const [deletedChild, retainedPayment, updatedRoute, updatedCategory, childAudit] =
    await Promise.all([
      prisma.calonMurid.findUnique({ where: { id: child.id } }),
      prisma.pembayaran.findUniqueOrThrow({ where: { id: payment.id } }),
      prisma.jalur.findUniqueOrThrow({ where: { id: route.id } }),
      prisma.kategoriPendaftar.findUniqueOrThrow({ where: { id: category.id } }),
      prisma.auditLog.findFirst({
        where: {
          action: "MANUAL_DELETE_CALON_MURID",
          entityId: child.id,
        },
      }),
    ]);
  if (
    deletedChild ||
    retainedPayment.calonMuridId !== null ||
    retainedPayment.calonMuridReference !== child.id ||
    updatedRoute.kuotaTerpakai !== 0 ||
    updatedCategory.kuotaTerpakai !== 0 ||
    !childAudit
  ) {
    throw new Error("Retention, kuota, atau audit penghapusan peserta tidak aman.");
  }

  const guardianDeleted = await remove(
    `/api/admin/wali-murid/${guardian.profileId}`,
    admin.cookie,
    `HAPUS ${guardian.email}`,
  );
  if (guardianDeleted.response.status !== 200) {
    throw new Error(
      `Penghapusan wali gagal: ${guardianDeleted.response.status}`,
    );
  }

  const [deletedProfile, completedAudit, deletedAuth] = await Promise.all([
    prisma.user.findUnique({ where: { id: guardian.profileId } }),
    prisma.auditLog.findFirst({
      where: {
        action: "DELETE_WALI_MURID_COMPLETED",
        entityId: guardian.profileId,
      },
    }),
    auth.auth.admin.getUserById(guardian.authId),
  ]);
  if (
    deletedProfile ||
    !completedAudit ||
    (deletedAuth.data.user && !deletedAuth.error)
  ) {
    throw new Error("Profil, Auth, atau audit penghapusan wali tidak lengkap.");
  }

  const recreated = await auth.auth.admin.createUser({
    email: guardian.email,
    password,
    email_confirm: true,
  });
  if (recreated.error || !recreated.data.user) {
    throw recreated.error ?? new Error("Email wali yang dihapus tidak dapat dipakai ulang.");
  }
  authIds.push(recreated.data.user.id);
  if (recreated.data.user.id === guardian.authId) {
    throw new Error("Pembuatan ulang tidak menghasilkan identitas Auth baru.");
  }

  const recreatedProfile = await prisma.user.findUniqueOrThrow({
    where: { supabaseAuthUserId: recreated.data.user.id },
  });
  profileIds.push(recreatedProfile.id);
  if (
    recreatedProfile.email !== guardian.email ||
    recreatedProfile.role !== UserRole.WALI_MURID
  ) {
    throw new Error("Profil wali hasil pendaftaran ulang tidak sinkron.");
  }

  const manuallyDeleted = await auth.auth.admin.deleteUser(
    recreated.data.user.id,
    false,
  );
  if (manuallyDeleted.error) throw manuallyDeleted.error;

  const profileAfterManualAuthDelete = await prisma.user.findUnique({
    where: { id: recreatedProfile.id },
  });
  if (profileAfterManualAuthDelete) {
    throw new Error("Penghapusan manual Auth masih meninggalkan profil wali yatim.");
  }

  console.log("Admin deletion, Auth sync, and email reuse integration: OK");
} finally {
  await retry(() =>
    prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: profileIds } },
          { entityId: { in: entityIds } },
        ],
      },
    }),
  );
  if (paymentId) {
    const id = paymentId;
    await retry(() => prisma.pembayaran.deleteMany({ where: { id } }));
  }
  await retry(() =>
    prisma.calonMurid.deleteMany({ where: { userId: { in: profileIds } } }),
  );
  if (routeId) {
    const id = routeId;
    await retry(() => prisma.jalur.deleteMany({ where: { id } }));
  }
  if (categoryId) {
    const id = categoryId;
    await retry(() =>
      prisma.kategoriPendaftar.deleteMany({ where: { id } }),
    );
  }
  await retry(() =>
    prisma.user.deleteMany({ where: { id: { in: profileIds } } }),
  );
  for (const id of authIds) await auth.auth.admin.deleteUser(id);
  await prisma.$disconnect();
}
