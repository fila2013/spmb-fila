import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { UserRole } from "../generated/prisma/enums";

const email = process.argv[2]?.trim().toLowerCase();
const databaseUrl = process.env.DATABASE_URL;

if (!email || !email.includes("@")) {
  throw new Error("Gunakan: npm run auth:set-admin -- admin@example.com");
}

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum dikonfigurasi.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

try {
  await prisma.$transaction(async (transaction) => {
    const profile = await transaction.user.findUnique({ where: { email } });
    if (!profile) {
      throw new Error("Profile belum ada. Konfirmasi/login akun Auth lebih dahulu.");
    }

    await transaction.user.update({
      where: { id: profile.id },
      data: { role: UserRole.ADMIN },
    });
    await transaction.auditLog.create({
      data: {
        action: "BOOTSTRAP_ADMIN",
        entity: "users",
        entityId: profile.id,
        detail: { previousRole: profile.role, newRole: UserRole.ADMIN },
      },
    });
  });

  console.log("Role admin berhasil diberikan dan dicatat di audit log.");
} finally {
  await prisma.$disconnect();
}

