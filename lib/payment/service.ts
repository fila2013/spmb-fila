import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import {
  JenisPembayaran,
  MetodePembayaran,
  ModePembayaranPendaftaran,
  StatusKeseluruhan,
  StatusPembayaran,
} from "@/generated/prisma/enums";
import { assertOwnership } from "@/lib/auth/authorization";
import { getOwnedCalonMurid } from "@/lib/calon-murid/service";
import { getAppEnvironment } from "@/lib/env/client";
import { getMidtransEnvironment } from "@/lib/env/server";
import { PaymentError } from "@/lib/payment/errors";
import { createMidtransSnapTransaction } from "@/lib/payment/midtrans";
import { paymentReturnUrl } from "@/lib/payment/navigation";
import {
  validateRegistrationProof,
  grossAmountToInteger,
  mapMidtransStatus,
  midtransUrls,
  resolvePaymentTransition,
  sanitizedNotification,
  verifyMidtransSignature,
} from "@/lib/payment/rules";
import type { MidtransNotification } from "@/lib/payment/schemas";
import { REGISTRATION_PAYMENT_SETTING_ID } from "@/lib/payment-settings/service";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type Transaction = Prisma.TransactionClient;

function paymentProofBucket() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_PEMBAYARAN;
  if (!bucket) {
    throw new PaymentError(
      "STORAGE_NOT_CONFIGURED",
      "Penyimpanan bukti pembayaran belum dikonfigurasi.",
      503,
    );
  }
  return bucket;
}

async function lockRegistrationPaymentMode(transaction: Transaction) {
  await transaction.$queryRaw`
    SELECT id FROM "pengaturan_pembayaran"
    WHERE id = ${REGISTRATION_PAYMENT_SETTING_ID}
    FOR SHARE
  `;
  const setting = await transaction.pengaturanPembayaran.findUnique({
    where: { id: REGISTRATION_PAYMENT_SETTING_ID },
    select: { mode: true },
  });
  return setting?.mode ?? ModePembayaranPendaftaran.MIDTRANS;
}

function proofKind(path: string | null) {
  if (!path) return null;
  return path.toLowerCase().endsWith(".pdf") ? ("pdf" as const) : ("image" as const);
}

async function signedPaymentProofUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await createAdminClient().storage
    .from(paymentProofBucket())
    .createSignedUrl(path, 10 * 60);
  if (error || !data.signedUrl) {
    throw new PaymentError(
      "SIGNED_URL_FAILED",
      "Bukti pembayaran belum dapat dibuka.",
      502,
    );
  }
  return data.signedUrl;
}

function createOrderId(childId: string) {
  return `SPMB-${childId.replaceAll("-", "").slice(0, 12)}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

async function lockOwnedChild(
  transaction: Transaction,
  childId: string,
  userId: string,
) {
  await transaction.$queryRaw`
    SELECT id FROM "calon_murid" WHERE id = ${childId}::uuid FOR UPDATE
  `;
  const child = await transaction.calonMurid.findUnique({
    where: { id: childId },
    include: { jalur: true, kategori: true },
  });
  if (!child) {
    throw new PaymentError(
      "NOT_FOUND",
      "Data calon murid tidak ditemukan.",
      404,
    );
  }
  assertOwnership({ userId, role: "WALI_MURID" }, child.userId);
  return child;
}

async function preferredRegistrationPayment(childId: string) {
  const verified = await prisma.pembayaran.findFirst({
    where: {
      calonMuridReference: childId,
      jenis: JenisPembayaran.PENDAFTARAN,
      status: StatusPembayaran.VERIFIED,
    },
    orderBy: { createdAt: "desc" },
  });
  return (
    verified ??
    prisma.pembayaran.findFirst({
      where: {
        calonMuridReference: childId,
        jenis: JenisPembayaran.PENDAFTARAN,
      },
      orderBy: { createdAt: "desc" },
    })
  );
}

export async function createRegistrationSnapPayment(
  childId: string,
  user: { userId: string; email: string },
) {
  return prisma.$transaction(
    async (transaction) => {
      const child = await lockOwnedChild(transaction, childId, user.userId);
      const mode = await lockRegistrationPaymentMode(transaction);
      if (mode !== ModePembayaranPendaftaran.MIDTRANS) {
        throw new PaymentError(
          "PAYMENT_MODE_DISABLED",
          "Pembayaran Midtrans sedang tidak aktif. Gunakan transfer manual.",
          409,
        );
      }
      const verified = await transaction.pembayaran.findFirst({
        where: {
          calonMuridReference: child.id,
          jenis: JenisPembayaran.PENDAFTARAN,
          status: StatusPembayaran.VERIFIED,
        },
      });
      if (verified) {
        throw new PaymentError(
          "INVALID_STAGE",
          "Pembayaran pendaftaran sudah terverifikasi.",
          409,
        );
      }
      if (
        child.statusKeseluruhan !==
        StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR
      ) {
        throw new PaymentError(
          "INVALID_STAGE",
          "Calon murid belum berada pada tahap pembayaran pendaftaran.",
          409,
        );
      }
      if (!child.jalurId || !child.kategoriId || !child.jalur || !child.kategori) {
        throw new PaymentError(
          "INVALID_STAGE",
          "Pilihan jalur dan kategori belum lengkap.",
          409,
        );
      }

      const pending = await transaction.pembayaran.findFirst({
        where: {
          calonMuridReference: child.id,
          jenis: JenisPembayaran.PENDAFTARAN,
          status: StatusPembayaran.PENDING,
          midtransSnapToken: { not: null },
        },
        orderBy: { createdAt: "desc" },
      });
      if (pending?.midtransSnapToken && pending.midtransOrderId) {
        return {
          payment: pending,
          snapToken: pending.midtransSnapToken,
          reused: true,
        };
      }

      const fee = await transaction.biayaPendaftaran.findFirst({
        where: {
          jalurId: child.jalurId,
          kategoriId: child.kategoriId,
          statusAktif: true,
        },
      });
      if (!fee) {
        throw new PaymentError(
          "FEE_NOT_CONFIGURED",
          "Biaya pendaftaran belum diatur oleh admin.",
          422,
        );
      }

      const orderId = createOrderId(child.id);
      const appEnvironment = getAppEnvironment();
      const snap = await createMidtransSnapTransaction({
        orderId,
        grossAmount: fee.nominal,
        childId: child.id,
        childName: child.namaAnak,
        email: user.email,
        routeName: child.jalur.nama,
        categoryName: child.kategori.nama,
        finishUrl: new URL(
          paymentReturnUrl(child.id, "success"),
          appEnvironment.NEXT_PUBLIC_APP_URL,
        ).toString(),
      });
      const payment = await transaction.pembayaran.create({
        data: {
          calonMuridId: child.id,
          calonMuridReference: child.id,
          jenis: JenisPembayaran.PENDAFTARAN,
          metodePembayaran: MetodePembayaran.MIDTRANS,
          nominal: fee.nominal,
          status: StatusPembayaran.PENDING,
          midtransOrderId: orderId,
          midtransSnapToken: snap.token,
        },
      });
      const midtransEnvironment = getMidtransEnvironment();
      await transaction.auditLog.create({
        data: {
          actorId: user.userId,
          action: "CREATE_MIDTRANS_TRANSACTION",
          entity: "pembayaran",
          entityId: payment.id,
          detail: {
            calonMuridReference: child.id,
            orderId,
            nominal: fee.nominal,
            environment: midtransUrls(
              midtransEnvironment.MIDTRANS_IS_PRODUCTION,
            ).environment,
          },
        },
      });
      return { payment, snapToken: snap.token, reused: false };
    },
    { maxWait: 10_000, timeout: 25_000 },
  );
}

export async function getRegistrationPaymentStatus(
  childId: string,
  userId: string,
) {
  await getOwnedCalonMurid(childId, userId);
  return preferredRegistrationPayment(childId);
}

export async function getRegistrationPaymentPageData(
  childId: string,
  userId: string,
) {
  const child = await getOwnedCalonMurid(childId, userId);
  if (!child.jalurId || !child.kategoriId || !child.jalur || !child.kategori) {
    throw new PaymentError(
      "INVALID_STAGE",
      "Pilihan jalur dan kategori belum lengkap.",
      409,
    );
  }
  if (child.statusKeseluruhan === StatusKeseluruhan.PILIH_JALUR) {
    throw new PaymentError(
      "INVALID_STAGE",
      "Calon murid belum berada pada tahap pembayaran pendaftaran.",
      409,
    );
  }
  const [payment, setting, bankAccounts] = await Promise.all([
    preferredRegistrationPayment(child.id),
    prisma.pengaturanPembayaran.findUnique({
      where: { id: REGISTRATION_PAYMENT_SETTING_ID },
      select: { mode: true },
    }),
    prisma.rekeningBank.findMany({
      orderBy: [{ createdAt: "asc" }, { namaBank: "asc" }],
      select: { id: true, namaBank: true, nomorRekening: true, atasNama: true },
    }),
  ]);
  const mode = setting?.mode ?? ModePembayaranPendaftaran.MIDTRANS;
  if (mode === ModePembayaranPendaftaran.MANUAL && bankAccounts.length === 0) {
    throw new PaymentError(
      "PAYMENT_UNAVAILABLE",
      "Rekening tujuan belum diatur oleh admin.",
      503,
    );
  }
  if (payment) {
    if (payment.nominal === null) {
      throw new PaymentError(
        "INVALID_STAGE",
        "Nominal pembayaran pendaftaran tidak valid.",
        409,
      );
    }
    return { child, payment, nominal: payment.nominal, mode, bankAccounts };
  }

  const fee = await prisma.biayaPendaftaran.findFirst({
    where: {
      jalurId: child.jalurId,
      kategoriId: child.kategoriId,
      statusAktif: true,
    },
  });
  if (!fee) {
    throw new PaymentError(
      "FEE_NOT_CONFIGURED",
      "Biaya pendaftaran belum diatur oleh admin.",
      422,
    );
  }
  return { child, payment: null, nominal: fee.nominal, mode, bankAccounts };
}

export async function uploadManualRegistrationProof(
  childId: string,
  userId: string,
  file: File,
) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = validateRegistrationProof(file, bytes);
  const child = await getOwnedCalonMurid(childId, userId);
  if (
    child.statusKeseluruhan !==
    StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR
  ) {
    throw new PaymentError(
      "INVALID_STAGE",
      "Bukti transfer tidak dapat diunggah pada tahap ini.",
      409,
    );
  }

  const path = `pendaftaran/${userId}/${childId}/${randomUUID()}.${extension}`;
  const storage = createAdminClient().storage.from(paymentProofBucket());
  const { error: uploadError } = await storage.upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    throw new PaymentError(
      "UPLOAD_FAILED",
      "Bukti transfer belum dapat diunggah.",
      502,
    );
  }

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const lockedChild = await lockOwnedChild(transaction, childId, userId);
        const mode = await lockRegistrationPaymentMode(transaction);
        if (mode !== ModePembayaranPendaftaran.MANUAL) {
          throw new PaymentError(
            "PAYMENT_MODE_DISABLED",
            "Transfer manual sedang tidak aktif. Gunakan pembayaran Midtrans.",
            409,
          );
        }
        if (
          lockedChild.statusKeseluruhan !==
          StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR
        ) {
          throw new PaymentError(
            "INVALID_STAGE",
            "Bukti transfer tidak dapat diunggah pada tahap ini.",
            409,
          );
        }
        if (!lockedChild.jalurId || !lockedChild.kategoriId) {
          throw new PaymentError(
            "INVALID_STAGE",
            "Pilihan jalur dan kategori belum lengkap.",
            409,
          );
        }
        const verified = await transaction.pembayaran.findFirst({
          where: {
            calonMuridReference: childId,
            jenis: JenisPembayaran.PENDAFTARAN,
            status: StatusPembayaran.VERIFIED,
          },
        });
        if (verified) {
          throw new PaymentError(
            "INVALID_STAGE",
            "Pembayaran pendaftaran sudah terverifikasi.",
            409,
          );
        }
        const fee = await transaction.biayaPendaftaran.findFirst({
          where: {
            jalurId: lockedChild.jalurId,
            kategoriId: lockedChild.kategoriId,
            statusAktif: true,
          },
        });
        if (!fee) {
          throw new PaymentError(
            "FEE_NOT_CONFIGURED",
            "Biaya pendaftaran belum diatur oleh admin.",
            422,
          );
        }
        const verifiedAt = new Date();
        const payment = await transaction.pembayaran.create({
          data: {
            calonMuridId: childId,
            calonMuridReference: childId,
            jenis: JenisPembayaran.PENDAFTARAN,
            metodePembayaran: MetodePembayaran.MANUAL_TRANSFER,
            nominal: fee.nominal,
            fileBuktiUrl: path,
            status: StatusPembayaran.VERIFIED,
            verifiedAt,
          },
        });
        const advanced = await transaction.calonMurid.updateMany({
          where: {
            id: childId,
            statusKeseluruhan:
              StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR,
          },
          data: { statusKeseluruhan: StatusKeseluruhan.ENROLLMENT },
        });
        if (advanced.count !== 1) {
          throw new PaymentError(
            "INVALID_STAGE",
            "Status calon murid berubah saat pembayaran diproses.",
            409,
          );
        }
        await transaction.auditLog.create({
          data: {
            actorId: userId,
            action: "UPLOAD_MANUAL_REGISTRATION_PROOF",
            entity: "pembayaran",
            entityId: payment.id,
            detail: {
              calonMuridReference: childId,
              nominal: payment.nominal,
              storagePath: path,
              contentType: file.type,
              size: file.size,
              paymentStatus: payment.status,
              nextStatus: StatusKeseluruhan.ENROLLMENT,
            },
          },
        });
        return payment;
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  } catch (error) {
    await storage.remove([path]);
    throw error;
  }
}

export async function getAdminRegistrationPaymentData(childId: string) {
  const child = await prisma.calonMurid.findUnique({
    where: { id: childId },
    select: { id: true },
  });
  if (!child) {
    throw new PaymentError("NOT_FOUND", "Peserta tidak ditemukan.", 404);
  }
  const payment = await preferredRegistrationPayment(childId);
  return payment
    ? {
        ...payment,
        proofUrl: await signedPaymentProofUrl(payment.fileBuktiUrl),
        proofKind: proofKind(payment.fileBuktiUrl),
      }
    : null;
}

export async function downloadPaymentProof(paymentId: string) {
  const payment = await prisma.pembayaran.findUnique({
    where: { id: paymentId },
    select: { id: true, fileBuktiUrl: true },
  });
  if (!payment?.fileBuktiUrl) {
    throw new PaymentError(
      "NOT_FOUND",
      "Bukti pembayaran tidak ditemukan.",
      404,
    );
  }
  const { data, error } = await createAdminClient().storage
    .from(paymentProofBucket())
    .download(payment.fileBuktiUrl);
  if (error || !data) {
    throw new PaymentError(
      "SIGNED_URL_FAILED",
      "Bukti pembayaran belum dapat diunduh.",
      502,
    );
  }
  const extension = payment.fileBuktiUrl.split(".").pop()?.toLowerCase();
  const filename = `bukti-pembayaran-${payment.id}.${extension ?? "bin"}`;
  return { blob: data, filename };
}

export async function requireVerifiedRegistrationPayment(
  childId: string,
  userId: string,
) {
  await getOwnedCalonMurid(childId, userId);
  const payment = await prisma.pembayaran.findFirst({
    where: {
      calonMuridReference: childId,
      jenis: JenisPembayaran.PENDAFTARAN,
      status: StatusPembayaran.VERIFIED,
    },
    orderBy: { verifiedAt: "desc" },
  });
  if (!payment) {
    throw new PaymentError(
      "PAYMENT_REQUIRED",
      "Pembayaran pendaftaran harus terverifikasi sebelum enrollment.",
      403,
    );
  }
  return payment;
}

export async function processMidtransNotification(
  notification: MidtransNotification,
) {
  const environment = getMidtransEnvironment();
  if (!verifyMidtransSignature(notification, environment.MIDTRANS_SERVER_KEY)) {
    throw new PaymentError(
      "INVALID_SIGNATURE",
      "Signature notifikasi tidak valid.",
      403,
    );
  }
  if (
    notification.merchant_id &&
    notification.merchant_id !== environment.MIDTRANS_MERCHANT_ID
  ) {
    throw new PaymentError(
      "MERCHANT_MISMATCH",
      "Merchant notifikasi tidak sesuai.",
      403,
    );
  }

  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT id FROM "pembayaran"
      WHERE "midtrans_order_id" = ${notification.order_id}
      FOR UPDATE
    `;
    const previous = await transaction.pembayaran.findUnique({
      where: { midtransOrderId: notification.order_id },
    });
    if (!previous) {
      throw new PaymentError(
        "NOT_FOUND",
        "Order pembayaran tidak ditemukan.",
        404,
      );
    }
    const amount = grossAmountToInteger(notification.gross_amount);
    if (amount !== previous.nominal) {
      throw new PaymentError(
        "AMOUNT_MISMATCH",
        "Nominal notifikasi tidak sesuai dengan transaksi.",
        422,
      );
    }

    const incomingStatus = mapMidtransStatus(notification);
    const nextStatus = resolvePaymentTransition(
      previous.status,
      incomingStatus,
    );
    const duplicate =
      previous.midtransRawPayload !== null &&
      previous.status === nextStatus &&
      previous.midtransTransactionId ===
        (notification.transaction_id ?? previous.midtransTransactionId) &&
      previous.midtransPaymentType ===
        (notification.payment_type ?? previous.midtransPaymentType);
    if (duplicate) {
      let enrollmentAdvanced = false;
      if (
        nextStatus === StatusPembayaran.VERIFIED &&
        previous.calonMuridId
      ) {
        const updated = await transaction.calonMurid.updateMany({
          where: {
            id: previous.calonMuridId,
            statusKeseluruhan:
              StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR,
          },
          data: { statusKeseluruhan: StatusKeseluruhan.ENROLLMENT },
        });
        enrollmentAdvanced = updated.count === 1;
      }
      if (enrollmentAdvanced) {
        await transaction.auditLog.create({
          data: {
            actorId: null,
            action: "REPAIR_MIDTRANS_ENROLLMENT_TRANSITION",
            entity: "pembayaran",
            entityId: previous.id,
            detail: {
              orderId: notification.order_id,
              paymentStatus: previous.status,
              enrollmentAdvanced,
            },
          },
        });
      }
      return {
        payment: previous,
        duplicate: true,
        ignored: !incomingStatus,
        enrollmentAdvanced,
      };
    }

    const payment = await transaction.pembayaran.update({
      where: { id: previous.id },
      data: {
        status: nextStatus,
        midtransTransactionId:
          notification.transaction_id ?? previous.midtransTransactionId,
        midtransPaymentType:
          notification.payment_type ?? previous.midtransPaymentType,
        midtransRawPayload: sanitizedNotification(notification),
        verifiedAt:
          nextStatus === StatusPembayaran.VERIFIED
            ? previous.verifiedAt ?? new Date()
            : null,
        verifiedById: null,
        catatanAdmin:
          nextStatus === StatusPembayaran.REJECTED
            ? `Midtrans otomatis: ${notification.transaction_status}`
            : previous.catatanAdmin,
      },
    });

    let enrollmentAdvanced = false;
    if (
      nextStatus === StatusPembayaran.VERIFIED &&
      payment.calonMuridId
    ) {
      const updated = await transaction.calonMurid.updateMany({
        where: {
          id: payment.calonMuridId,
          statusKeseluruhan:
            StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR,
        },
        data: { statusKeseluruhan: StatusKeseluruhan.ENROLLMENT },
      });
      enrollmentAdvanced = updated.count === 1;
    }

    await transaction.auditLog.create({
      data: {
        actorId: null,
        action: "PROCESS_MIDTRANS_WEBHOOK",
        entity: "pembayaran",
        entityId: payment.id,
        detail: {
          orderId: notification.order_id,
          transactionStatus: notification.transaction_status,
          before: previous.status,
          after: payment.status,
          enrollmentAdvanced,
          ignored: !incomingStatus,
        },
      },
    });
    return { payment, duplicate: false, ignored: !incomingStatus };
  });
}
