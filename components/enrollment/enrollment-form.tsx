"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { FormType, TipeInput } from "@/generated/prisma/enums";
import { ageRequirementText, fieldValueError, validateFieldValues } from "@/lib/enrollment/rules";

type EnrollmentField = {
  id: string;
  label: string;
  tipeInput: TipeInput;
  wajib: boolean;
  validasi: string | null;
  minAgeYears: number | null;
  ageReferenceMonth: number | null;
  ageReferenceYear: number | null;
  autoFilled: boolean;
  lockedFromRegistration: boolean;
  value: string;
};

type LegacyResponse = { id: string; label: string; value: string };

type ApiResponse = {
  data?: { submitted: boolean };
  error?: {
    message?: string;
    fields?: Record<string, string[]>;
  };
};

function inputType(type: TipeInput) {
  if (type === TipeInput.TEXTAREA) return null;
  return {
    [TipeInput.TEXT]: "text",
    [TipeInput.DATE]: "date",
    [TipeInput.NUMBER]: "number",
    [TipeInput.EMAIL]: "email",
    [TipeInput.TEL]: "tel",
  }[type];
}

export function EnrollmentForm({
  childId,
  formType,
  fields,
  submitted,
  legacyResponses = [],
}: {
  childId: string;
  formType: FormType;
  fields: EnrollmentField[];
  submitted: boolean;
  legacyResponses?: LegacyResponse[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((field) => [field.id, field.value])),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(submitted);

  function checkFieldOnBlur(field: EnrollmentField, value: string) {
    const error = fieldValueError(field, value, false);
    setFieldErrors((current) => {
      const next = { ...current };
      if (error) next[field.id] = [error];
      else delete next[field.id];
      return next;
    });
    if (!error) setMessage(null);
  }

  async function save(intent: "draft" | "submit", nextPath?: string) {
    if (intent === "submit" || nextPath) {
      if (!formRef.current?.reportValidity()) return;
    }
    const localErrors = validateFieldValues(
      fields,
      new Map(fields.map((field) => [field.id, values[field.id] ?? ""])),
      intent === "submit" || Boolean(nextPath),
    );
    if (Object.keys(localErrors).length) {
      setFieldErrors(localErrors);
      setMessage(Object.values(localErrors)[0]?.[0] ?? "Periksa kembali data yang diisi.");
      setMessageIsError(true);
      return;
    }
    setBusy(true);
    setMessage(null);
    setMessageIsError(false);
    setFieldErrors({});
    try {
      const response = await fetch(`/api/calon-murid/${childId}/enrollment`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          formType,
          intent,
          responses: fields.map((field) => ({
            fieldId: field.id,
            value: values[field.id] ?? "",
          })),
        }),
      });
      const body = (await response.json()) as ApiResponse;
      if (!response.ok || !body.data) {
        setFieldErrors(body.error?.fields ?? {});
        const firstFieldError = Object.values(body.error?.fields ?? {}).flat()[0];
        throw new Error(firstFieldError ?? body.error?.message ?? "Enrollment belum dapat disimpan.");
      }
      if (body.data.submitted) {
        setCompleted(true);
        setMessage("Enrollment berhasil disubmit. Tahap berikutnya adalah asesmen.");
        router.refresh();
        return;
      }
      setMessage(nextPath ? "Data tersimpan. Membuka form Observasi…" : "Draft berhasil disimpan.");
      if (nextPath) router.push(nextPath);
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Enrollment belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  const errorsOutsideCurrentForm = Object.keys(fieldErrors).some(
    (fieldId) => !fields.some((field) => field.id === fieldId),
  );

  return (
    <form ref={formRef} className="grid gap-5" onSubmit={(event) => event.preventDefault()}>
      {!submitted && legacyResponses.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">Jawaban lama tetap tersimpan</p>
        <p className="mt-1">Form sekarang memisahkan tempat dan tanggal lahir. Mohon isi kedua field baru berdasarkan jawaban lama berikut:</p>
        {legacyResponses.map((response) => <p key={response.id} className="mt-2 whitespace-pre-wrap"><span className="font-semibold">{response.label}:</span> {response.value || "—"}</p>)}
      </div> : null}
      {fields.map((field, index) => (
        <label key={field.id} className="block text-sm font-semibold text-slate-800">
          <span>{formType === FormType.OBSERVASI ? `${index + 1}. ` : ""}{field.label}</span>
          {field.wajib ? <span className="ml-1 text-red-700" aria-label="wajib">*</span> : null}
          {field.tipeInput === TipeInput.TEXTAREA ? (
            <textarea
              value={values[field.id] ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
              onBlur={(event) => checkFieldOnBlur(field, event.target.value)}
              required={field.wajib}
              disabled={completed}
              maxLength={10_000}
              rows={5}
              aria-invalid={Boolean(fieldErrors[field.id])}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-950 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10 disabled:bg-slate-100"
            />
          ) : (
            <input
              type={inputType(field.tipeInput) ?? "text"}
              value={values[field.id] ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
              onBlur={(event) => checkFieldOnBlur(field, event.target.value)}
              required={field.wajib}
              disabled={completed}
              readOnly={field.lockedFromRegistration}
              maxLength={field.tipeInput === TipeInput.EMAIL ? 255 : field.tipeInput === TipeInput.TEL ? 30 : 1_000}
              inputMode={field.validasi === "format_wa_indonesia" ? "tel" : undefined}
              placeholder={field.validasi === "format_wa_indonesia" ? "081234567890 atau +6281234567890" : undefined}
              aria-invalid={Boolean(fieldErrors[field.id])}
              className={`mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal text-slate-950 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10 disabled:bg-slate-100 ${field.autoFilled ? "bg-emerald-50" : "bg-white"}`}
            />
          )}
          {!completed && field.tipeInput === TipeInput.DATE && ageRequirementText(field) ? (
            <span className="mt-1 block text-xs font-normal text-slate-600">Syarat: {ageRequirementText(field)}. Penilaian berdasarkan bulan dan tahun lahir.</span>
          ) : null}
          {field.lockedFromRegistration && !completed ? (
            <span className="mt-1 block text-xs text-emerald-700">Terisi dari pendaftaran awal. Hubungi admin jika perlu koreksi.</span>
          ) : field.autoFilled && !completed ? (
            <span className="mt-1 block text-xs text-emerald-700">Terisi otomatis dan tetap dapat dikoreksi.</span>
          ) : null}
          {fieldErrors[field.id] ? (
            <span className="mt-1 block text-xs text-red-700">{fieldErrors[field.id][0]}</span>
          ) : null}
        </label>
      ))}

      {errorsOutsideCurrentForm ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Data Pribadi belum valid. <Link href={`/anak/${childId}/enrollment/data-pribadi`} className="font-bold underline">Periksa Data Pribadi</Link> untuk memperbaikinya.
        </p>
      ) : null}
      {message ? (
        <p aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm ${messageIsError ? "border-red-200 bg-red-50 text-red-800" : completed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
          {message}
        </p>
      ) : null}

      {completed ? (
        <Link href="/dashboard" className="inline-flex w-fit rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800">Kembali ke dashboard</Link>
      ) : (
        <div className="flex flex-wrap gap-3 border-t border-emerald-950/10 pt-5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save("draft")}
            className="rounded-xl border border-emerald-900/20 bg-white px-5 py-3 text-sm font-bold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60"
          >
            {busy ? "Menyimpan…" : "Simpan draft"}
          </button>
          {formType === FormType.DATA_PRIBADI ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void save("draft", `/anak/${childId}/enrollment/observasi`)}
              className="rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              Simpan & lanjut ke Observasi →
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void save("submit")}
              className="rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              Submit enrollment
            </button>
          )}
        </div>
      )}
    </form>
  );
}
