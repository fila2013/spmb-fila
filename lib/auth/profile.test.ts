import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRole } from "@/generated/prisma/enums";

const db = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  executeRaw: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: db.findUnique,
      findUniqueOrThrow: db.findUniqueOrThrow,
    },
    $executeRaw: db.executeRaw,
    $transaction: db.transaction,
  },
}));

import { ensureUserProfile } from "@/lib/auth/profile";

const verifiedAt = new Date("2026-09-26T08:00:00.000Z");
const identity = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "wali@example.com",
  emailVerifiedAt: verifiedAt.toISOString(),
};
const profile = {
  id: "00000000-0000-4000-8000-000000000002",
  supabaseAuthUserId: identity.id,
  email: identity.email,
  role: UserRole.WALI_MURID,
  statusAktif: true,
  emailVerifiedAt: verifiedAt,
  createdAt: verifiedAt,
  updatedAt: verifiedAt,
};

describe("sinkronisasi profil saat login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("membaca profil terverifikasi yang sudah sesuai tanpa membuka transaksi", async () => {
    db.findUnique.mockResolvedValue(profile);

    expect(await ensureUserProfile(identity)).toBe(profile);
    expect(db.executeRaw).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("mempertahankan profil yang telah dinonaktifkan admin", async () => {
    const inactiveProfile = { ...profile, statusAktif: false };
    db.findUnique.mockResolvedValue(inactiveProfile);

    expect(await ensureUserProfile(identity)).toBe(inactiveProfile);
    expect(db.executeRaw).not.toHaveBeenCalled();
  });

  it("tidak mengaktifkan profil yang emailnya belum terverifikasi", async () => {
    const pendingProfile = {
      ...profile,
      statusAktif: false,
      emailVerifiedAt: null,
    };
    db.findUnique.mockResolvedValue(pendingProfile);

    expect(
      await ensureUserProfile({ ...identity, emailVerifiedAt: null }),
    ).toBe(pendingProfile);
    expect(db.executeRaw).not.toHaveBeenCalled();
  });

  it("menyinkronkan transisi email terkonfirmasi lewat upsert atomik", async () => {
    db.findUnique.mockResolvedValue({
      ...profile,
      statusAktif: false,
      emailVerifiedAt: null,
    });
    db.executeRaw.mockResolvedValue(1);
    db.findUniqueOrThrow.mockResolvedValue(profile);

    expect(await ensureUserProfile(identity)).toBe(profile);
    expect(db.executeRaw).toHaveBeenCalledOnce();
    expect(db.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { supabaseAuthUserId: identity.id },
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
