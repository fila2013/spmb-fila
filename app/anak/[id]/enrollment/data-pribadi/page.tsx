import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EnrollmentForm } from "@/components/enrollment/enrollment-form";
import { EnrollmentShell } from "@/components/enrollment/enrollment-shell";
import { FormType } from "@/generated/prisma/enums";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireWaliPage } from "@/lib/auth/navigation";
import { calonMuridIdSchema } from "@/lib/calon-murid/schemas";
import { EnrollmentError } from "@/lib/enrollment/errors";
import { getEnrollmentFormData } from "@/lib/enrollment/service";

export const metadata: Metadata = { title: "Enrollment Data Pribadi" };

export default async function DataPribadiPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireWaliPage();
  const idResult = calonMuridIdSchema.safeParse((await params).id);
  if (!idResult.success) notFound();
  let data;
  try {
    data = await getEnrollmentFormData(idResult.data, user.userId, FormType.DATA_PRIBADI);
  } catch (error) {
    if (error instanceof EnrollmentError && error.code === "PAYMENT_REQUIRED") {
      redirect(`/anak/${idResult.data}/pembayaran-pendaftaran`);
    }
    if (error instanceof AuthorizationError || error instanceof EnrollmentError) notFound();
    throw error;
  }
  return (
    <EnrollmentShell childId={data.child.id} childName={data.child.namaAnak} active="data-pribadi">
      <div className="mb-6"><h2 className="text-2xl font-bold text-emerald-950">Data pribadi anak & orang tua</h2><p className="mt-2 text-sm leading-6 text-slate-600">Field bertanda * wajib lengkap sebelum submit final. Draft dapat disimpan bertahap.</p></div>
      <EnrollmentForm childId={data.child.id} formType={FormType.DATA_PRIBADI} fields={data.fields} submitted={data.submitted} />
    </EnrollmentShell>
  );
}
