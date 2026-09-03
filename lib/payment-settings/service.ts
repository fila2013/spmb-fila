import "server-only";

import { ModePembayaranPendaftaran } from "@/generated/prisma/enums";
import { MasterDataError } from "@/lib/master-data/errors";
import type {
  CreateBankAccountInput,
  PaymentModeInput,
  UpdateBankAccountInput,
} from "@/lib/payment-settings/schemas";
import { prisma } from "@/lib/prisma";

export const REGISTRATION_PAYMENT_SETTING_ID = "pendaftaran";

function maskedAccountNumber(value: string) {
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function rethrowConflict(error: unknown): never {
  if ((error as { code?: string }).code === "P2002") {
    throw new MasterDataError(
      "CONFLICT",
      "Rekening bank dengan nomor tersebut sudah tersedia.",
      409,
    );
  }
  throw error;
}

export async function getRegistrationPaymentMode() {
  const setting = await prisma.pengaturanPembayaran.findUnique({
    where: { id: REGISTRATION_PAYMENT_SETTING_ID },
    select: { mode: true },
  });
  return setting?.mode ?? ModePembayaranPendaftaran.MIDTRANS;
}

export function listBankAccounts() {
  return prisma.rekeningBank.findMany({
    orderBy: [{ createdAt: "asc" }, { namaBank: "asc" }],
  });
}

export async function getPaymentSettingsData() {
  const [mode, bankAccounts] = await Promise.all([
    getRegistrationPaymentMode(),
    listBankAccounts(),
  ]);
  return { mode, bankAccounts };
}

export async function updatePaymentMode(
  input: PaymentModeInput,
  actorId: string,
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT id FROM "pengaturan_pembayaran"
      WHERE id = ${REGISTRATION_PAYMENT_SETTING_ID}
      FOR UPDATE
    `;
    if (input.mode === ModePembayaranPendaftaran.MANUAL) {
      const accountCount = await transaction.rekeningBank.count();
      if (accountCount === 0) {
        throw new MasterDataError(
          "CONFLICT",
          "Tambahkan minimal satu rekening bank sebelum mengaktifkan mode manual.",
          409,
        );
      }
    }
    const previous = await transaction.pengaturanPembayaran.findUnique({
      where: { id: REGISTRATION_PAYMENT_SETTING_ID },
    });
    const setting = await transaction.pengaturanPembayaran.upsert({
      where: { id: REGISTRATION_PAYMENT_SETTING_ID },
      update: { mode: input.mode, updatedById: actorId },
      create: {
        id: REGISTRATION_PAYMENT_SETTING_ID,
        mode: input.mode,
        updatedById: actorId,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "UPDATE_REGISTRATION_PAYMENT_MODE",
        entity: "pengaturan_pembayaran",
        entityId: null,
        detail: {
          settingId: REGISTRATION_PAYMENT_SETTING_ID,
          before: previous?.mode ?? ModePembayaranPendaftaran.MIDTRANS,
          after: setting.mode,
        },
      },
    });
    return setting;
  });
}

export async function createBankAccount(
  input: CreateBankAccountInput,
  actorId: string,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const account = await transaction.rekeningBank.create({ data: input });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "CREATE_BANK_ACCOUNT",
          entity: "rekening_bank",
          entityId: account.id,
          detail: {
            namaBank: account.namaBank,
            nomorRekening: maskedAccountNumber(account.nomorRekening),
            atasNama: account.atasNama,
          },
        },
      });
      return account;
    });
  } catch (error) {
    rethrowConflict(error);
  }
}

export async function updateBankAccount(
  input: UpdateBankAccountInput,
  actorId: string,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM "rekening_bank" WHERE id = ${input.id}::uuid FOR UPDATE
      `;
      const previous = await transaction.rekeningBank.findUnique({
        where: { id: input.id },
      });
      if (!previous) {
        throw new MasterDataError("NOT_FOUND", "Rekening bank tidak ditemukan.", 404);
      }
      const account = await transaction.rekeningBank.update({
        where: { id: input.id },
        data: {
          namaBank: input.namaBank,
          nomorRekening: input.nomorRekening,
          atasNama: input.atasNama,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "UPDATE_BANK_ACCOUNT",
          entity: "rekening_bank",
          entityId: account.id,
          detail: {
            before: {
              namaBank: previous.namaBank,
              nomorRekening: maskedAccountNumber(previous.nomorRekening),
              atasNama: previous.atasNama,
            },
            after: {
              namaBank: account.namaBank,
              nomorRekening: maskedAccountNumber(account.nomorRekening),
              atasNama: account.atasNama,
            },
          },
        },
      });
      return account;
    });
  } catch (error) {
    if (error instanceof MasterDataError) throw error;
    rethrowConflict(error);
  }
}

export async function deleteBankAccount(id: string, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT id FROM "pengaturan_pembayaran"
      WHERE id = ${REGISTRATION_PAYMENT_SETTING_ID}
      FOR UPDATE
    `;
    await transaction.$queryRaw`
      SELECT id FROM "rekening_bank" WHERE id = ${id}::uuid FOR UPDATE
    `;
    const setting = await transaction.pengaturanPembayaran.findUnique({
      where: { id: REGISTRATION_PAYMENT_SETTING_ID },
    });
    const account = await transaction.rekeningBank.findUnique({ where: { id } });
    const accountCount = await transaction.rekeningBank.count();
    if (!account) {
      throw new MasterDataError("NOT_FOUND", "Rekening bank tidak ditemukan.", 404);
    }
    if (
      setting?.mode === ModePembayaranPendaftaran.MANUAL &&
      accountCount <= 1
    ) {
      throw new MasterDataError(
        "CONFLICT",
        "Rekening terakhir tidak dapat dihapus saat mode manual aktif.",
        409,
      );
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "DELETE_BANK_ACCOUNT",
        entity: "rekening_bank",
        entityId: account.id,
        detail: {
          snapshot: {
            namaBank: account.namaBank,
            nomorRekening: maskedAccountNumber(account.nomorRekening),
            atasNama: account.atasNama,
          },
        },
      },
    });
    await transaction.rekeningBank.delete({ where: { id } });
    return account;
  });
}
