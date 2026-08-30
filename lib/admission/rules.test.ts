import { describe, expect, it } from "vitest";

import { StatusKeseluruhan } from "@/generated/prisma/enums";
import { AdmissionError } from "@/lib/admission/errors";
import {
  admissionFeeUploadStatuses,
  admissionFeeVisibleStatuses,
  joinWaVisibleStatuses,
  validateDuProof,
} from "@/lib/admission/rules";

describe("Phase 9 admission rules", () => {
  it("menerapkan gate DU dan Join WA", () => {
    expect(admissionFeeVisibleStatuses).toContain(StatusKeseluruhan.DITERIMA);
    expect(admissionFeeVisibleStatuses).toContain(StatusKeseluruhan.SELESAI);
    expect(admissionFeeUploadStatuses).toContain(StatusKeseluruhan.MENUNGGU_DU);
    expect(admissionFeeUploadStatuses).not.toContain(StatusKeseluruhan.MENUNGGU_JOIN_WA);
    expect(joinWaVisibleStatuses).toEqual([
      StatusKeseluruhan.MENUNGGU_JOIN_WA,
      StatusKeseluruhan.SELESAI,
    ]);
  });

  it("menerima signature JPG, PNG, dan PDF yang sesuai MIME", () => {
    expect(validateDuProof({ size: 3, type: "image/jpeg" }, new Uint8Array([0xff, 0xd8, 0xff]))).toBe("jpg");
    expect(validateDuProof({ size: 8, type: "image/png" }, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(validateDuProof({ size: 5, type: "application/pdf" }, new TextEncoder().encode("%PDF-"))).toBe("pdf");
  });

  it("menolak file kosong, terlalu besar, atau signature palsu", () => {
    expect(() => validateDuProof({ size: 0, type: "image/png" }, new Uint8Array())).toThrowError(AdmissionError);
    expect(() => validateDuProof({ size: 5 * 1024 * 1024 + 1, type: "image/png" }, new Uint8Array())).toThrowError(/5 MB/);
    expect(() => validateDuProof({ size: 4, type: "image/png" }, new TextEncoder().encode("fake"))).toThrowError(/valid/);
  });
});
