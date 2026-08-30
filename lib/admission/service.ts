import "server-only";

import type { KontenTahap, Prisma } from "@/generated/prisma/client";
import {
  JenisPembayaran,
  MetodePembayaran,
  StatusKeseluruhan,
  StatusPembayaran,
  StatusUndanganWa,
  TahapKonten,
} from "@/generated/prisma/enums";
import { AdmissionError } from "@/lib/admission/errors";
import {
  admissionFeeUploadStatuses,
  admissionFeeVisibleStatuses,
  assertDuProofSize,
  joinWaVisibleStatuses,
  validateDuProof,
} from "@/lib/admission/rules";
import type {
  AdmissionVerificationInput,
  WhatsappInvitationInput,
} from "@/lib/admission/schemas";
import { assertOwnership } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

function bucketName() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_PEMBAYARAN;
  if (!bucket) {
    throw new AdmissionError(
      "STORAGE_NOT_CONFIGURED",
      "Penyimpanan bukti pembayaran belum dikonfigurasi.",
      503,
    );
  }
  return bucket;
}

function matchingContentWhere(
  tahap: TahapKonten,
  child: { jalurId: string | null; kategoriId: string | null },
) {
  return {
    tahap,
    statusAktif: true,
    AND: [
      { OR: [{ jalurId: null }, { jalurId: child.jalurId ?? "00000000-0000-0000-0000-000000000000" }] },
      { OR: [{ kategoriId: null }, { kategoriId: child.kategoriId ?? "00000000-0000-0000-0000-000000000000" }] },
    ],
  } satisfies Prisma.KontenTahapWhereInput;
}

function publicContent(content: KontenTahap) {
  return {
    id: content.id,
    judul: content.judul,
    tanggal: content.tanggal?.toISOString().slice(0, 10) ?? null,
    isiTeks: content.isiTeks,
    gambarUrl: content.gambarUrl,
    urutanLayout: content.urutanLayout,
  };
}

async function ownedChild(childId: string, userId: string) {
  const child = await prisma.calonMurid.findUnique({
    where: { id: childId },
    include: {
      jalur: { select: { id: true, nama: true } },
      kategori: { select: { id: true, nama: true } },
      statusGrupWa: true,
    },
  });
  if (!child) throw new AdmissionError("NOT_FOUND", "Data calon murid tidak ditemukan.", 404);
  assertOwnership({ userId, role: "WALI_MURID" }, child.userId);
  return child;
}

async function preferredDuPayment(childId: string) {
  const active = await prisma.pembayaran.findFirst({
    where: {
      calonMuridReference: childId,
      jenis: JenisPembayaran.DU,
      status: { in: [StatusPembayaran.VERIFIED, StatusPembayaran.PENDING] },
    },
    orderBy: { createdAt: "desc" },
  });
  return active ?? prisma.pembayaran.findFirst({
    where: { calonMuridReference: childId, jenis: JenisPembayaran.DU },
    orderBy: { createdAt: "desc" },
  });
}

async function signedProofUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await createAdminClient().storage
    .from(bucketName())
    .createSignedUrl(path, 10 * 60);
  if (error || !data.signedUrl) {
    throw new AdmissionError("SIGNED_URL_FAILED", "Bukti pembayaran belum dapat dibuka.", 502);
  }
  return data.signedUrl;
}

export async function getAdmissionFeePageData(childId: string, userId: string) {
  const child = await ownedChild(childId, userId);
  if (!admissionFeeVisibleStatuses.includes(child.statusKeseluruhan)) {
    throw new AdmissionError("STAGE_FORBIDDEN", "Tahap daftar ulang hanya tersedia untuk calon murid yang diterima.", 403);
  }
  const [payment, content] = await Promise.all([
    preferredDuPayment(child.id),
    prisma.kontenTahap.findMany({
      where: matchingContentWhere(TahapKonten.ADMISSION_FEE, child),
      orderBy: [{ urutanLayout: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  return {
    child: { id: child.id, namaAnak: child.namaAnak, jalur: child.jalur?.nama ?? null, kategori: child.kategori?.nama ?? null },
    mayUpload: admissionFeeUploadStatuses.includes(child.statusKeseluruhan) && payment?.status !== StatusPembayaran.PENDING && payment?.status !== StatusPembayaran.VERIFIED,
    payment: payment ? {
      id: payment.id,
      status: payment.status,
      nominal: payment.nominal,
      catatanAdmin: payment.catatanAdmin,
      createdAt: payment.createdAt,
      verifiedAt: payment.verifiedAt,
      proofUrl: await signedProofUrl(payment.fileBuktiUrl),
    } : null,
    content: content.map(publicContent),
  };
}

export async function uploadAdmissionFeeProof(
  childId: string,
  userId: string,
  file: File,
) {
  assertDuProofSize(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = validateDuProof(file, bytes);
  const child = await ownedChild(childId, userId);
  if (!admissionFeeUploadStatuses.includes(child.statusKeseluruhan)) {
    throw new AdmissionError("INVALID_STAGE", "Bukti DU tidak dapat diunggah pada tahap ini.", 409);
  }

  const path = `du/${child.userId}/${child.id}/${crypto.randomUUID()}.${extension}`;
  const storage = createAdminClient().storage.from(bucketName());
  const { error: uploadError } = await storage.upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    throw new AdmissionError("UPLOAD_FAILED", "Bukti pembayaran belum dapat diunggah.", 502);
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "calon_murid" WHERE id = ${childId}::uuid FOR UPDATE`;
      const lockedChild = await transaction.calonMurid.findUnique({ where: { id: childId } });
      if (!lockedChild) throw new AdmissionError("NOT_FOUND", "Data calon murid tidak ditemukan.", 404);
      assertOwnership({ userId, role: "WALI_MURID" }, lockedChild.userId);
      if (!admissionFeeUploadStatuses.includes(lockedChild.statusKeseluruhan)) {
        throw new AdmissionError("INVALID_STAGE", "Bukti DU tidak dapat diunggah pada tahap ini.", 409);
      }
      const active = await transaction.pembayaran.findFirst({
        where: {
          calonMuridReference: childId,
          jenis: JenisPembayaran.DU,
          status: { in: [StatusPembayaran.PENDING, StatusPembayaran.VERIFIED] },
        },
      });
      if (active) {
        throw new AdmissionError(
          active.status === StatusPembayaran.VERIFIED ? "PAYMENT_VERIFIED" : "PAYMENT_PENDING",
          active.status === StatusPembayaran.VERIFIED ? "Pembayaran DU sudah terverifikasi." : "Bukti DU sedang menunggu verifikasi admin.",
          409,
        );
      }
      const payment = await transaction.pembayaran.create({
        data: {
          calonMuridId: childId,
          calonMuridReference: childId,
          jenis: JenisPembayaran.DU,
          metodePembayaran: MetodePembayaran.MANUAL_TRANSFER,
          nominal: null,
          fileBuktiUrl: path,
          status: StatusPembayaran.PENDING,
        },
      });
      await transaction.calonMurid.update({
        where: { id: childId },
        data: { statusKeseluruhan: StatusKeseluruhan.MENUNGGU_DU },
      });
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: "UPLOAD_DU_PROOF",
          entity: "pembayaran",
          entityId: payment.id,
          detail: {
            calonMuridReference: childId,
            storagePath: path,
            contentType: file.type,
            size: file.size,
            status: payment.status,
          },
        },
      });
      return payment;
    }, { maxWait: 10_000, timeout: 30_000 });
  } catch (error) {
    await storage.remove([path]);
    throw error;
  }
}

export async function getAdminAdmissionData(childId: string) {
  const child = await prisma.calonMurid.findUnique({
    where: { id: childId },
    include: { statusGrupWa: true },
  });
  if (!child) throw new AdmissionError("NOT_FOUND", "Peserta tidak ditemukan.", 404);
  const payment = await preferredDuPayment(childId);
  return {
    payment: payment ? { ...payment, proofUrl: await signedProofUrl(payment.fileBuktiUrl) } : null,
    whatsappStatus: child.statusGrupWa?.status ?? null,
  };
}

export async function verifyAdmissionPayment(
  paymentId: string,
  input: AdmissionVerificationInput,
  actorId: string,
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "pembayaran" WHERE id = ${paymentId}::uuid FOR UPDATE`;
    const previous = await transaction.pembayaran.findUnique({
      where: { id: paymentId },
      include: { calonMurid: true },
    });
    if (!previous || previous.jenis !== JenisPembayaran.DU || previous.metodePembayaran !== MetodePembayaran.MANUAL_TRANSFER || !previous.calonMurid) {
      throw new AdmissionError("NOT_FOUND", "Pembayaran DU aktif tidak ditemukan.", 404);
    }
    if (previous.status !== StatusPembayaran.PENDING) {
      throw new AdmissionError("PAYMENT_FINAL", "Pembayaran DU ini sudah memiliki keputusan final.", 409);
    }
    if (input.status === StatusPembayaran.VERIFIED && !input.nominal) {
      throw new AdmissionError("NOMINAL_REQUIRED", "Nominal aktual wajib dicatat saat verifikasi.", 422);
    }

    const payment = await transaction.pembayaran.update({
      where: { id: previous.id },
      data: {
        status: input.status,
        nominal: input.nominal,
        catatanAdmin: input.catatanAdmin,
        verifiedById: actorId,
        verifiedAt: input.status === StatusPembayaran.VERIFIED ? new Date() : null,
      },
    });
    let nextStatus: StatusKeseluruhan = StatusKeseluruhan.MENUNGGU_DU;
    if (input.status === StatusPembayaran.VERIFIED) {
      const advanced = await transaction.calonMurid.updateMany({
        where: {
          id: previous.calonMurid.id,
          statusKeseluruhan: { in: [StatusKeseluruhan.DITERIMA, StatusKeseluruhan.MENUNGGU_DU] },
        },
        data: { statusKeseluruhan: StatusKeseluruhan.MENUNGGU_JOIN_WA },
      });
      if (advanced.count !== 1) {
        throw new AdmissionError("INVALID_STAGE", "Status calon murid tidak konsisten dengan pembayaran DU.", 409);
      }
      nextStatus = StatusKeseluruhan.MENUNGGU_JOIN_WA;
      await transaction.statusGrupWa.upsert({
        where: { calonMuridId: previous.calonMurid.id },
        update: { status: StatusUndanganWa.MENUNGGU, updatedById: actorId },
        create: { calonMuridId: previous.calonMurid.id, status: StatusUndanganWa.MENUNGGU, updatedById: actorId },
      });
    } else {
      await transaction.calonMurid.update({
        where: { id: previous.calonMurid.id },
        data: { statusKeseluruhan: StatusKeseluruhan.MENUNGGU_DU },
      });
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "VERIFY_DU_PAYMENT",
        entity: "pembayaran",
        entityId: payment.id,
        detail: {
          calonMuridReference: previous.calonMuridReference,
          before: { status: previous.status, nominal: previous.nominal },
          after: { status: payment.status, nominal: payment.nominal },
          catatanAdmin: payment.catatanAdmin,
          nextStatus,
        },
      },
    });
    return { payment, nextStatus };
  }, { maxWait: 10_000, timeout: 30_000 });
}

export async function getJoinWaPageData(childId: string, userId: string) {
  const child = await ownedChild(childId, userId);
  if (!joinWaVisibleStatuses.includes(child.statusKeseluruhan)) {
    throw new AdmissionError("STAGE_FORBIDDEN", "Tahap grup WhatsApp hanya tersedia setelah DU terverifikasi.", 403);
  }
  const [payment, content] = await Promise.all([
    prisma.pembayaran.findFirst({
      where: { calonMuridReference: childId, jenis: JenisPembayaran.DU, status: StatusPembayaran.VERIFIED },
    }),
    prisma.kontenTahap.findMany({
      where: matchingContentWhere(TahapKonten.JOIN_WA, child),
      orderBy: [{ urutanLayout: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  if (!payment) throw new AdmissionError("PAYMENT_REQUIRED", "Pembayaran DU belum terverifikasi.", 403);
  return {
    child: { id: child.id, namaAnak: child.namaAnak, jalur: child.jalur?.nama ?? null, kategori: child.kategori?.nama ?? null },
    status: child.statusGrupWa?.status ?? StatusUndanganWa.MENUNGGU,
    content: content.map(publicContent),
  };
}

export async function updateWhatsappInvitation(
  childId: string,
  input: WhatsappInvitationInput,
  actorId: string,
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "calon_murid" WHERE id = ${childId}::uuid FOR UPDATE`;
    const child = await transaction.calonMurid.findUnique({
      where: { id: childId },
      include: { statusGrupWa: true },
    });
    if (!child) throw new AdmissionError("NOT_FOUND", "Peserta tidak ditemukan.", 404);
    if (!joinWaVisibleStatuses.includes(child.statusKeseluruhan)) {
      throw new AdmissionError("INVALID_STAGE", "Peserta belum berada pada tahap grup WhatsApp.", 409);
    }
    const verified = await transaction.pembayaran.findFirst({
      where: { calonMuridReference: childId, jenis: JenisPembayaran.DU, status: StatusPembayaran.VERIFIED },
      select: { id: true },
    });
    if (!verified) throw new AdmissionError("PAYMENT_REQUIRED", "Pembayaran DU belum terverifikasi.", 409);
    const status = await transaction.statusGrupWa.upsert({
      where: { calonMuridId: childId },
      update: { status: input.status, updatedById: actorId },
      create: { calonMuridId: childId, status: input.status, updatedById: actorId },
    });
    const nextStatus = input.status === StatusUndanganWa.SUDAH_DIUNDANG
      ? StatusKeseluruhan.SELESAI
      : StatusKeseluruhan.MENUNGGU_JOIN_WA;
    await transaction.calonMurid.update({
      where: { id: childId },
      data: { statusKeseluruhan: nextStatus },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "UPDATE_WHATSAPP_INVITATION",
        entity: "status_grup_wa",
        entityId: childId,
        detail: {
          before: child.statusGrupWa?.status ?? null,
          after: status.status,
          nextStatus,
          automaticInvite: false,
        },
      },
    });
    return { status, nextStatus };
  }, { maxWait: 10_000, timeout: 30_000 });
}
