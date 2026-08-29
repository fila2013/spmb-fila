import { randomBytes, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../generated/prisma/client";
import { KategoriTipe, UserRole } from "../generated/prisma/enums";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

if (!supabaseUrl || !publishableKey || !secretKey || !databaseUrl) {
  throw new Error("Environment integration test belum lengkap.");
}

const authUrl = supabaseUrl;
const publicKey = publishableKey;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const adminClient = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const publicClient = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const marker = randomUUID().slice(0, 8);
const email = `phase3-${marker}@example.invalid`;
const password = randomBytes(24).toString("base64url");
let authUserId: string | undefined;
let profileId: string | undefined;
let jalurId: string | undefined;
let kategoriId: string | undefined;
let biayaId: string | undefined;

async function sessionCookie(accessToken: string, refreshToken: string) {
  const cookies = new Map<string, string>();
  const ssrClient = createServerClient(authUrl, publicKey, {
    cookies: {
      getAll: () => [],
      setAll: (values) => {
        values.forEach(({ name, value }) => cookies.set(name, value));
      },
    },
  });
  const { error } = await ssrClient.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  const verificationClient = createServerClient(authUrl, publicKey, {
    cookies: {
      getAll: () =>
        [...cookies].map(([name, value]) => ({ name, value })),
      setAll: () => undefined,
    },
  });
  const { data: claims, error: claimsError } =
    await verificationClient.auth.getClaims();
  if (claimsError || !claims?.claims.sub) {
    throw claimsError ?? new Error("Cookie SSR tidak menghasilkan claims.");
  }
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(path: string, cookie: string, init?: RequestInit) {
  const response = await fetch(`${appUrl}${path}`, {
    ...init,
    headers: {
      cookie,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`API ${path} gagal (${response.status}): ${JSON.stringify(body)}`);
  }
  return body.data;
}

try {
  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (createError || !created.user) throw createError ?? new Error("Auth user gagal");
  authUserId = created.user.id;

  const profile = await prisma.user.findUniqueOrThrow({
    where: { supabaseAuthUserId: authUserId },
  });
  profileId = profile.id;

  const { data: login, error: loginError } =
    await publicClient.auth.signInWithPassword({ email, password });
  if (loginError || !login.session) throw loginError ?? new Error("Login gagal");
  const cookie = await sessionCookie(
    login.session.access_token,
    login.session.refresh_token,
  );
  const forbiddenResponse = await fetch(`${appUrl}/api/admin/jalur`, {
    headers: { cookie },
  });
  if (forbiddenResponse.status !== 403) {
    throw new Error(
      `Akun wali seharusnya ditolak, status aktual ${forbiddenResponse.status}.`,
    );
  }
  await prisma.user.update({
    where: { id: profileId },
    data: { role: UserRole.ADMIN },
  });

  const jalur = await request("/api/admin/jalur", cookie, {
    method: "POST",
    body: JSON.stringify({
      nama: `Uji Jalur ${marker}`,
      statusAktif: true,
      periodeMulai: null,
      periodeSelesai: null,
      kuotaMaks: 5,
      fallbackJalurId: null,
      hapusDataJikaGagal: false,
    }),
  });
  jalurId = jalur.id;

  const kategori = await request("/api/admin/kategori", cookie, {
    method: "POST",
    body: JSON.stringify({
      nama: `Uji Kategori ${marker}`,
      tipe: KategoriTipe.EKSTERNAL,
      statusAktif: true,
      periodeMulai: null,
      periodeSelesai: null,
      kuotaMaks: 10,
    }),
  });
  kategoriId = kategori.id;

  const biaya = await request("/api/admin/biaya-pendaftaran", cookie, {
    method: "POST",
    body: JSON.stringify({
      jalurId,
      kategoriId,
      nominal: 500_000,
      statusAktif: true,
    }),
  });
  biayaId = biaya.id;

  await request(`/api/admin/jalur/${jalurId}`, cookie, {
    method: "PATCH",
    body: JSON.stringify({
      nama: `Uji Jalur ${marker}`,
      statusAktif: true,
      periodeMulai: null,
      periodeSelesai: null,
      kuotaMaks: 6,
      fallbackJalurId: null,
      hapusDataJikaGagal: false,
    }),
  });
  await request(`/api/admin/kategori/${kategoriId}`, cookie, {
    method: "PATCH",
    body: JSON.stringify({
      nama: `Uji Kategori ${marker}`,
      tipe: KategoriTipe.EKSTERNAL,
      statusAktif: true,
      periodeMulai: null,
      periodeSelesai: null,
      kuotaMaks: 12,
    }),
  });
  await request(`/api/admin/biaya-pendaftaran/${biayaId}`, cookie, {
    method: "PATCH",
    body: JSON.stringify({ nominal: 550_000, statusAktif: true }),
  });

  const matrix = await request("/api/admin/biaya-pendaftaran", cookie);
  if (!matrix.some((item: { biaya?: { id: string } }) => item.biaya?.id === biayaId)) {
    throw new Error("Kombinasi biaya tidak ditemukan pada matrix.");
  }
  if (!jalurId || !kategoriId || !biayaId) {
    throw new Error("ID master data hasil smoke test tidak lengkap.");
  }
  const auditCount = await prisma.auditLog.count({
    where: { entityId: { in: [jalurId, kategoriId, biayaId] } },
  });
  if (auditCount !== 6) {
    throw new Error(`Audit log Phase 3 tidak lengkap: ${auditCount}/6.`);
  }

  console.log("Phase 3 integration: OK");
} finally {
  const entityIds = [jalurId, kategoriId, biayaId].filter(
    (id): id is string => Boolean(id),
  );
  if (biayaId) await prisma.biayaPendaftaran.deleteMany({ where: { id: biayaId } });
  if (jalurId) await prisma.jalur.deleteMany({ where: { id: jalurId } });
  if (kategoriId) {
    await prisma.kategoriPendaftar.deleteMany({ where: { id: kategoriId } });
  }
  if (entityIds.length) {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
  }
  if (profileId) await prisma.user.deleteMany({ where: { id: profileId } });
  if (authUserId) await adminClient.auth.admin.deleteUser(authUserId);
  await publicClient.auth.signOut();
  await prisma.$disconnect();
}
