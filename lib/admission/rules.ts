import { StatusKeseluruhan } from "@/generated/prisma/enums";
import { AdmissionError } from "@/lib/admission/errors";

export const MAX_DU_PROOF_BYTES = 5 * 1024 * 1024;

export const admissionFeeVisibleStatuses: StatusKeseluruhan[] = [
  StatusKeseluruhan.DITERIMA,
  StatusKeseluruhan.MENUNGGU_DU,
  StatusKeseluruhan.MENUNGGU_JOIN_WA,
  StatusKeseluruhan.SELESAI,
];

export const admissionFeeUploadStatuses: StatusKeseluruhan[] = [
  StatusKeseluruhan.DITERIMA,
  StatusKeseluruhan.MENUNGGU_DU,
];

export const joinWaVisibleStatuses: StatusKeseluruhan[] = [
  StatusKeseluruhan.MENUNGGU_JOIN_WA,
  StatusKeseluruhan.SELESAI,
];

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function assertDuProofSize(file: { size: number }) {
  if (file.size === 0) {
    throw new AdmissionError("EMPTY_FILE", "Pilih bukti pembayaran DU.", 422);
  }
  if (file.size > MAX_DU_PROOF_BYTES) {
    throw new AdmissionError("FILE_TOO_LARGE", "Bukti pembayaran maksimal 5 MB.", 422);
  }
}

export function validateDuProof(
  file: { size: number; type: string },
  bytes: Uint8Array,
) {
  assertDuProofSize(file);

  const jpeg = file.type === "image/jpeg" && startsWith(bytes, [0xff, 0xd8, 0xff]);
  const png = file.type === "image/png" && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pdf = file.type === "application/pdf" && startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (!jpeg && !png && !pdf) {
    throw new AdmissionError(
      "INVALID_FILE",
      "Bukti pembayaran harus berupa JPG, PNG, atau PDF yang valid.",
      422,
    );
  }
  return jpeg ? "jpg" : png ? "png" : "pdf";
}
