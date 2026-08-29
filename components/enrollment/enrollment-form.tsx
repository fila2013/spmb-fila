"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { FormType, TipeInput } from "@/generated/prisma/enums";

type EnrollmentField = {
  id: string;
  label: string;
  tipeInput: TipeInput;
  wajib: boolean;
  validasi: string | null;
  autoFilled: boolean;
  value: string;
};

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
}: {
  childId: string;
  formType: FormType;
  fields: EnrollmentField[];
  submitted: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((field) => [field.id, field.value])),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(submitted);

  async function save(intent: "draft" | "submit", nextPath?: string) {
    if (intent === "submit" || nextPath) {
      if (!formRef.current?.reportValidity()) return;
    }
    setBusy(true);
    setMessage(null);
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
        throw new Error(body.error?.message ?? "Enrollment belum dapat disimpan.");
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
      {fields.map((field, index) => (
        <label key={field.id} className="block text-sm font-semibold text-slate-800">
          <span>{formType === FormType.OBSERVASI ? `${index + 1}. ` : ""}{field.label}</span>
          {field.wajib ? <span className="ml-1 text-red-700" aria-label="wajib">*</span> : null}
          {field.tipeInput === TipeInput.TEXTAREA ? (
            <textarea
              value={values[field.id] ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
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
              required={field.wajib}
              disabled={completed}
              maxLength={field.tipeInput === TipeInput.EMAIL ? 255 : field.tipeInput === TipeInput.TEL ? 30 : 1_000}
              inputMode={field.validasi === "format_wa_indonesia" ? "tel" : undefined}
              placeholder={field.validasi === "format_wa_indonesia" ? "081234567890 atau +6281234567890" : undefined}
              aria-invalid={Boolean(fieldErrors[field.id])}
              className={`mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal text-slate-950 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10 disabled:bg-slate-100 ${field.autoFilled ? "bg-emerald-50" : "bg-white"}`}
            />
          )}
          {field.autoFilled && !completed ? (
            <span className="mt-1 block text-xs text-emerald-700">Terisi otomatis dan tetap dapat dikoreksi.</span>
          ) : null}
          {fieldErrors[field.id] ? (
            <span className="mt-1 block text-xs text-red-700">{fieldErrors[field.id][0]}</span>
          ) : null}
        </label>
      ))}

      {errorsOutsideCurrentForm ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Masih ada field wajib pada Data Pribadi yang belum valid. Silakan periksa kembali bagian tersebut.
        </p>
      ) : null}
      {message ? (
        <p aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm ${completed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
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
