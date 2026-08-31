import { randomBytes, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { PrismaClient } from "../../generated/prisma/client";
import {
  KategoriTipe,
  StatusKeseluruhan,
  UserRole,
} from "../../generated/prisma/enums";

config({ path: ".env.local", quiet: true });

export type E2EFixture = {
  adminEmail: string;
  waliEmail: string;
  password: string;
  firstChildName: string;
  finishedChildName: string;
  cleanup: () => Promise<void>;
};

export async function createE2EFixture(): Promise<E2EFixture> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!supabaseUrl || !secretKey || !databaseUrl) {
    throw new Error("Environment staging E2E belum lengkap.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const auth = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const marker = randomUUID().slice(0, 8);
  const password = randomBytes(24).toString("base64url");
  const adminEmail = `phase11-admin-${marker}@example.invalid`;
  const waliEmail = `phase11-wali-${marker}@example.invalid`;
  const authIds: string[] = [];
  const profileIds: string[] = [];
  const childIds: string[] = [];
  let routeId: string | null = null;
  let categoryId: string | null = null;

  async function cleanup() {
    try {
      if (childIds.length) {
        await prisma.auditLog.deleteMany({ where: { entityId: { in: childIds } } });
        await prisma.calonMurid.deleteMany({ where: { id: { in: childIds } } });
      }
      if (routeId) await prisma.jalur.deleteMany({ where: { id: routeId } });
      if (categoryId) await prisma.kategoriPendaftar.deleteMany({ where: { id: categoryId } });
      if (profileIds.length) await prisma.user.deleteMany({ where: { id: { in: profileIds } } });
      for (const id of authIds) await auth.auth.admin.deleteUser(id);
    } finally {
      await prisma.$disconnect();
    }
  }

  async function createAccount(email: string, role: UserRole) {
    const { data, error } = await auth.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("Akun E2E gagal dibuat.");
    authIds.push(data.user.id);
    const profile = await prisma.user.findUniqueOrThrow({
      where: { supabaseAuthUserId: data.user.id },
    });
    profileIds.push(profile.id);
    if (profile.role !== role) {
      return prisma.user.update({ where: { id: profile.id }, data: { role } });
    }
    return profile;
  }

  try {
    const admin = await createAccount(adminEmail, UserRole.ADMIN);
    const wali = await createAccount(waliEmail, UserRole.WALI_MURID);
    const route = await prisma.jalur.create({
      data: { nama: `E2E Reguler ${marker}`, statusAktif: true, kuotaMaks: 10, kuotaTerpakai: 2 },
    });
    routeId = route.id;
    const category = await prisma.kategoriPendaftar.create({
      data: { nama: `E2E Eksternal ${marker}`, tipe: KategoriTipe.EKSTERNAL, statusAktif: true, kuotaMaks: 10, kuotaTerpakai: 2 },
    });
    categoryId = category.id;
    const firstChildName = `Anak Awal ${marker}`;
    const finishedChildName = `Anak Selesai ${marker}`;
    const children = await Promise.all([
      prisma.calonMurid.create({
        data: { userId: wali.id, namaAnak: firstChildName, jalurId: route.id, kategoriId: category.id, statusKeseluruhan: StatusKeseluruhan.PILIH_JALUR },
      }),
      prisma.calonMurid.create({
        data: { userId: wali.id, namaAnak: finishedChildName, jalurId: route.id, kategoriId: category.id, statusKeseluruhan: StatusKeseluruhan.SELESAI },
      }),
    ]);
    childIds.push(...children.map(({ id }) => id));

    // Memastikan akun admin tetap terhubung selama fixture aktif.
    if (admin.role !== UserRole.ADMIN) throw new Error("Role admin E2E tidak tersimpan.");
    return { adminEmail, waliEmail, password, firstChildName, finishedChildName, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
