import { describe, expect, it } from "vitest";

import { FormType } from "@/generated/prisma/enums";
import {
  createEnrollmentPdf,
  enrollmentPdfFilename,
  type EnrollmentPdfParticipant,
} from "@/lib/enrollment/pdf";

function participant(observationValue: string): EnrollmentPdfParticipant {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    childName: "Afiza Shakilla Azzahra",
    guardianEmail: "wali@example.com",
    routeName: "Reguler",
    categoryName: "Eksternal/Umum",
    responses: [
      ...Array.from({ length: 9 }, (_, index) => ({
        id: `personal-${index}`,
        label: `Data pribadi ${index + 1}`,
        value: `Jawaban pribadi ${index + 1}`,
        formType: FormType.DATA_PRIBADI,
        order: index,
      })),
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `observation-${index}`,
        label: `Pertanyaan observasi ${index + 1}`,
        value: observationValue,
        formType: FormType.OBSERVASI,
        order: index,
      })),
    ],
  };
}

describe("enrollment PDF", () => {
  it("membuat A4 dua halaman untuk jawaban ringkas", async () => {
    const result = await createEnrollmentPdf(
      participant("Jawaban observasi yang ringkas dan jelas."),
    );

    expect(new TextDecoder().decode(result.body.slice(0, 5))).toBe("%PDF-");
    expect(result.filename).toBe(
      "data-enrollment-afiza-shakilla-azzahra.pdf",
    );
    expect(result.pageCount).toBe(2);
    expect(result.body.byteLength).toBeGreaterThan(5_000);
  });

  it("menambah halaman observasi tanpa memindahkan Data Pribadi", async () => {
    const result = await createEnrollmentPdf(
      participant("Jawaban panjang orang tua. ".repeat(260)),
    );

    expect(result.pageCount).toBeGreaterThan(2);
  });

  it("mempertahankan Data Pribadi panjang hanya pada halaman pertama", async () => {
    const input = participant("Jawaban observasi yang ringkas dan jelas.");
    input.responses = input.responses.map((response) =>
      response.formType === FormType.DATA_PRIBADI
        ? { ...response, value: "Jawaban pribadi sangat panjang. ".repeat(180) }
        : response,
    );

    const result = await createEnrollmentPdf(input);

    expect(result.pageCount).toBe(2);
  });

  it("menghasilkan nama file ASCII yang aman", () => {
    expect(enrollmentPdfFilename("  Aisyah / Kelas A  ")).toBe(
      "data-enrollment-aisyah-kelas-a.pdf",
    );
  });
});
