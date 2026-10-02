import "server-only";

import type { FormField, Prisma } from "@/generated/prisma/client";
import {
  FormType,
  JenisPembayaran,
  StatusKeseluruhan,
  StatusPembayaran,
  TipeInput,
} from "@/generated/prisma/enums";
import { assertOwnership } from "@/lib/auth/authorization";
import {
  EnrollmentError,
  EnrollmentValidationError,
} from "@/lib/enrollment/errors";
import { visibleEnrollmentFields } from "@/lib/enrollment/field-visibility";
import {
  normalizeEnrollmentValue,
  validateFieldValues,
} from "@/lib/enrollment/rules";
import type {
  EnrollmentMutationInput,
  FormFieldInput,
  RegistrationAgeRuleInput,
  UpdateFormFieldInput,
} from "@/lib/enrollment/schemas";
import { prisma } from "@/lib/prisma";

type Transaction = Prisma.TransactionClient;

function asalTk(child: {
  subKategoriEnum: string | null;
  subKategoriText: string | null;
}) {
  if (child.subKategoriText) return child.subKategoriText;
  if (child.subKategoriEnum === "TKIT_FI_1") return "TKIT Fitrah Insani 1";
  if (child.subKategoriEnum === "TKIT_FI_2") return "TKIT Fitrah Insani 2";
  return "";
}

function autoFillValue(
  source: string | null,
  context: { email: string; asalTk: string; tempatLahir: string; tanggalLahir: string },
) {
  if (source === "akun_email") return context.email;
  if (source === "kategori_asal_tk") return context.asalTk;
  if (source === "tempat_lahir") return context.tempatLahir;
  if (source === "tanggal_lahir") return context.tanggalLahir;
  return "";
}

async function assertVerifiedPayment(
  transaction: Transaction,
  childId: string,
) {
  const verified = await transaction.pembayaran.findFirst({
    where: {
      calonMuridReference: childId,
      jenis: JenisPembayaran.PENDAFTARAN,
      status: StatusPembayaran.VERIFIED,
    },
    select: { id: true },
  });
  if (!verified) {
    throw new EnrollmentError(
      "PAYMENT_REQUIRED",
      "Pembayaran pendaftaran harus terverifikasi sebelum enrollment.",
      403,
    );
  }
}

async function getEnrollmentChild(childId: string, userId: string) {
  const child = await prisma.calonMurid.findUnique({
    where: { id: childId },
    include: { user: { select: { email: true } } },
  });
  if (!child) {
    throw new EnrollmentError(
      "NOT_FOUND",
      "Data calon murid tidak ditemukan.",
      404,
    );
  }
  assertOwnership({ userId, role: "WALI_MURID" }, child.userId);
  await assertVerifiedPayment(prisma, child.id);
  return child;
}

export function listFormFields(formType?: FormType, includeArchived = false) {
  return prisma.formField.findMany({
    where: {
      ...(formType ? { formType } : {}),
      ...(!includeArchived ? { archivedAt: null } : {}),
    },
    orderBy: [{ formType: "asc" }, { urutan: "asc" }, { createdAt: "asc" }],
  });
}

export async function getEnrollmentFormData(
  childId: string,
  userId: string,
  formType: FormType,
) {
  const child = await getEnrollmentChild(childId, userId);
  const submitted = child.statusKeseluruhan !== StatusKeseluruhan.ENROLLMENT;
  const fields = await prisma.formField.findMany({
    where: { formType },
    include: {
      responses: {
        where: { calonMuridId: child.id },
        select: { value: true },
        take: 1,
      },
    },
    orderBy: [{ urutan: "asc" }, { createdAt: "asc" }],
  });
  const context = {
    email: child.user.email,
    asalTk: asalTk(child),
    tempatLahir: child.tempatLahir ?? "",
    tanggalLahir: child.tanggalLahir?.toISOString().slice(0, 10) ?? "",
  };
  const visibleFields = visibleEnrollmentFields(
    fields,
    submitted,
    new Set(fields.filter((field) => field.responses.length > 0).map((field) => field.id)),
  );
  return {
    child: {
      id: child.id,
      namaAnak: child.namaAnak,
      statusKeseluruhan: child.statusKeseluruhan,
    },
    submitted,
    legacyResponses: submitted ? [] : fields
      .filter((field) => field.archivedAt && field.label === "Tempat, tanggal lahir" && field.responses.length > 0)
      .map((field) => ({ id: field.id, label: field.label, value: field.responses[0]?.value ?? "" })),
    fields: visibleFields.map(({ responses, ...field }) => ({
      ...field,
      value:
        responses.length > 0
          ? responses[0]?.value ?? ""
          : autoFillValue(field.autoFillSource, context),
      autoFilled: responses.length === 0 && Boolean(autoFillValue(field.autoFillSource, context)),
      lockedFromRegistration: (field.autoFillSource === "tempat_lahir" && Boolean(child.tempatLahir)) ||
        (field.autoFillSource === "tanggal_lahir" && Boolean(child.tanggalLahir)),
    })),
  };
}

export async function getEnrollmentOverview(childId: string, userId: string) {
  const child = await getEnrollmentChild(childId, userId);
  const submitted = child.statusKeseluruhan !== StatusKeseluruhan.ENROLLMENT;
  const [fields, responses] = await Promise.all([
    listFormFields(undefined, submitted),
    prisma.formResponse.findMany({ where: { calonMuridId: child.id } }),
  ]);
  return {
    child: {
      id: child.id,
      namaAnak: child.namaAnak,
      statusKeseluruhan: child.statusKeseluruhan,
    },
    submitted,
    fields: visibleEnrollmentFields(fields, submitted, new Set(responses.map((response) => response.fieldId))),
    responses,
  };
}

export async function saveEnrollment(
  childId: string,
  userId: string,
  input: EnrollmentMutationInput,
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT id FROM "calon_murid" WHERE id = ${childId}::uuid FOR UPDATE
    `;
    const child = await transaction.calonMurid.findUnique({
      where: { id: childId },
    });
    if (!child) {
      throw new EnrollmentError(
        "NOT_FOUND",
        "Data calon murid tidak ditemukan.",
        404,
      );
    }
    assertOwnership({ userId, role: "WALI_MURID" }, child.userId);
    await assertVerifiedPayment(transaction, child.id);
    if (child.statusKeseluruhan !== StatusKeseluruhan.ENROLLMENT) {
      throw new EnrollmentError(
        "ALREADY_SUBMITTED",
        "Enrollment sudah disubmit dan tidak dapat diubah kembali.",
        409,
      );
    }

    const fields = await transaction.formField.findMany({
      where: { archivedAt: null },
      orderBy: [{ formType: "asc" }, { urutan: "asc" }],
    });
    const formFields = fields.filter(
      (field) => field.formType === input.formType,
    );
    if (!formFields.length) {
      throw new EnrollmentError(
        "FORM_NOT_CONFIGURED",
        "Form enrollment belum dikonfigurasi admin.",
        422,
      );
    }
    const fieldsById = new Map(formFields.map((field) => [field.id, field]));
    for (const response of input.responses) {
      if (!fieldsById.has(response.fieldId)) {
        throw new EnrollmentError(
          "UNKNOWN_FIELD",
          "Terdapat field yang bukan bagian dari formulir ini.",
          422,
        );
      }
    }

    const incoming = new Map(
      input.responses.map((response) => {
        const field = fieldsById.get(response.fieldId) as FormField;
        return [
          response.fieldId,
          normalizeEnrollmentValue(response.value, field.tipeInput),
        ];
      }),
    );
    const lockedErrors: Record<string, string[]> = {};
    for (const field of formFields) {
      const expected = field.autoFillSource === "tempat_lahir" ? child.tempatLahir
        : field.autoFillSource === "tanggal_lahir" ? child.tanggalLahir?.toISOString().slice(0, 10)
        : null;
      if (expected && incoming.has(field.id) && incoming.get(field.id) !== expected) {
        lockedErrors[field.id] = ["Data lahir dari pendaftaran awal tidak dapat diubah di formulir ini. Hubungi admin jika perlu koreksi."];
      }
    }
    if (Object.keys(lockedErrors).length) throw new EnrollmentValidationError(lockedErrors);
    const draftErrors = validateFieldValues(formFields, incoming, false);
    if (Object.keys(draftErrors).length) {
      throw new EnrollmentValidationError(draftErrors);
    }

    let finalValues: Map<string, string> | null = null;
    if (input.intent === "submit") {
      if (!fields.some((field) => field.formType === FormType.DATA_PRIBADI) ||
          !fields.some((field) => field.formType === FormType.OBSERVASI)) {
        throw new EnrollmentError(
          "FORM_NOT_CONFIGURED",
          "Form Data Pribadi dan Observasi wajib dikonfigurasi sebelum submit.",
          422,
        );
      }
      const existing = await transaction.formResponse.findMany({
        where: { calonMuridId: child.id },
      });
      finalValues = new Map(
        existing.map((response) => [response.fieldId, response.value ?? ""]),
      );
      for (const [fieldId, value] of incoming) finalValues.set(fieldId, value);
      const finalErrors = validateFieldValues(fields, finalValues, true);
      if (Object.keys(finalErrors).length) {
        throw new EnrollmentValidationError(finalErrors);
      }
    }

    for (const [fieldId, value] of incoming) {
      await transaction.formResponse.upsert({
        where: {
          calonMuridId_fieldId: { calonMuridId: child.id, fieldId },
        },
        update: { value: value || null },
        create: {
          calonMuridId: child.id,
          fieldId,
          value: value || null,
        },
      });
    }

    const submitted = input.intent === "submit";
    if (submitted) {
      await transaction.calonMurid.update({
        where: { id: child.id },
        data: { statusKeseluruhan: StatusKeseluruhan.MENUNGGU_ASESMEN },
      });
    }
    await transaction.auditLog.create({
      data: {
        actorId: userId,
        action: submitted ? "SUBMIT_ENROLLMENT" : "SAVE_ENROLLMENT_DRAFT",
        entity: "calon_murid",
        entityId: child.id,
        detail: {
          formType: input.formType,
          fieldIds: [...incoming.keys()],
          responseCount: incoming.size,
          nextStatus: submitted
            ? StatusKeseluruhan.MENUNGGU_ASESMEN
            : StatusKeseluruhan.ENROLLMENT,
        },
      },
    });
    return { submitted, statusKeseluruhan: submitted ? StatusKeseluruhan.MENUNGGU_ASESMEN : StatusKeseluruhan.ENROLLMENT };
  });
}

function fieldSnapshot(field: FormField) {
  return {
    formType: field.formType,
    label: field.label,
    tipeInput: field.tipeInput,
    wajib: field.wajib,
    urutan: field.urutan,
    validasi: field.validasi,
    autoFillSource: field.autoFillSource,
    minAgeYears: field.minAgeYears,
    ageReferenceMonth: field.ageReferenceMonth,
    ageReferenceYear: field.ageReferenceYear,
    archivedAt: field.archivedAt?.toISOString() ?? null,
  };
}

export async function createFormField(input: FormFieldInput, actorId: string) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const field = await transaction.formField.create({ data: input });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "CREATE_FORM_FIELD",
          entity: "form_field",
          entityId: field.id,
          detail: { after: fieldSnapshot(field) },
        },
      });
      return field;
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new EnrollmentError(
        "CONFLICT",
        "Label field tersebut sudah digunakan pada form yang sama.",
        409,
      );
    }
    throw error;
  }
}

export async function updateFormField(
  input: UpdateFormFieldInput,
  actorId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.formField.findUnique({
      where: { id: input.id },
    });
    if (!previous) {
      throw new EnrollmentError("NOT_FOUND", "Field tidak ditemukan.", 404);
    }
    if (previous.archivedAt) {
      throw new EnrollmentError("FIELD_ARCHIVED", "Field arsip tidak dapat diubah.", 409);
    }
    const responseCount = await transaction.formResponse.count({
      where: { fieldId: previous.id },
    });
    if (
      responseCount > 0 &&
      (input.formType !== previous.formType ||
        input.tipeInput !== previous.tipeInput)
    ) {
      throw new EnrollmentError(
        "FIELD_IN_USE",
        "Jenis form dan tipe input tidak dapat diubah karena field sudah memiliki jawaban.",
        409,
      );
    }
    const { id, ...data } = input;
    const field = await transaction.formField.update({ where: { id }, data });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "UPDATE_FORM_FIELD",
        entity: "form_field",
        entityId: field.id,
        detail: {
          before: fieldSnapshot(previous),
          after: fieldSnapshot(field),
        },
      },
    });
    return field;
  });
}

export async function updateRegistrationAgeRule(
  input: RegistrationAgeRuleInput,
  actorId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.formField.findUnique({
      where: { id: input.fieldId },
    });
    if (
      !previous || previous.archivedAt ||
      previous.formType !== FormType.DATA_PRIBADI ||
      previous.tipeInput !== TipeInput.DATE ||
      previous.autoFillSource !== "tanggal_lahir"
    ) {
      throw new EnrollmentError(
        "NOT_FOUND",
        "Field Tanggal lahir pendaftaran tidak ditemukan. Periksa konfigurasi Form Builder.",
        404,
      );
    }
    const field = await transaction.formField.update({
      where: { id: previous.id },
      data: {
        minAgeYears: input.minAgeYears,
        ageReferenceMonth: input.ageReferenceMonth,
        ageReferenceYear: input.ageReferenceYear,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "UPDATE_REGISTRATION_AGE_RULE",
        entity: "form_field",
        entityId: field.id,
        detail: { before: fieldSnapshot(previous), after: fieldSnapshot(field) },
      },
    });
    return field;
  });
}

export async function deleteFormField(id: string, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    const field = await transaction.formField.findUnique({ where: { id } });
    if (!field) {
      throw new EnrollmentError("NOT_FOUND", "Field tidak ditemukan.", 404);
    }
    if (field.archivedAt) {
      throw new EnrollmentError("FIELD_ARCHIVED", "Field arsip tidak dapat dihapus.", 409);
    }
    const responseCount = await transaction.formResponse.count({
      where: { fieldId: field.id },
    });
    if (responseCount > 0) {
      throw new EnrollmentError(
        "FIELD_IN_USE",
        "Field tidak dapat dihapus karena sudah memiliki jawaban peserta.",
        409,
      );
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "DELETE_FORM_FIELD",
        entity: "form_field",
        entityId: field.id,
        detail: { before: fieldSnapshot(field) },
      },
    });
    await transaction.formField.delete({ where: { id: field.id } });
  });
}
