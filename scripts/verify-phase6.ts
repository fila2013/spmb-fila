import { randomBytes, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { PrismaClient } from "../generated/prisma/client";
import {
  FormType,
  JenisPembayaran,
  KategoriTipe,
  MetodePembayaran,
  StatusKeseluruhan,
  StatusPembayaran,
  TipeInput,
} from "../generated/prisma/enums";

config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const appUrl =
  process.argv[2] ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

if (!supabaseUrl || !publishableKey || !secretKey || !databaseUrl) {
  throw new Error("Environment integration test Phase 6 belum lengkap.");
}

const authUrl = supabaseUrl;
const publicKey = publishableKey;
const adminKey = secretKey;
const connectionString = databaseUrl;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const adminClient = createClient(authUrl, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const marker = randomUUID().slice(0, 8);
const password = randomBytes(24).toString("base64url");
const authUserIds: string[] = [];
const profileIds: string[] = [];
const childIds: string[] = [];
const paymentIds: string[] = [];
const routeIds: string[] = [];
const categoryIds: string[] = [];
let routeId = "";
let categoryId = "";

type FieldPayload = {
  id: string;
  label: string;
  tipeInput: TipeInput;
  validasi: string | null;
  autoFillSource: string | null;
  value: string;
};

type ApiBody = {
  data?: {
    submitted?: boolean;
    fields?: FieldPayload[];
  };
  error?: { code?: string; message?: string; fields?: Record<string, string[]> };
};

async function loginCookie(email: string) {
  const cookies = new Map<string, string>();
  const client = createServerClient(authUrl, publicKey, {
    cookies: {
      getAll: () =>
        [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (values) =>
        values.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    throw error ?? new Error("Login akun uji gagal.");
  }
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function createWali(label: string) {
  const email = `phase6-${label}-${marker}@example.invalid`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Gagal membuat akun uji.");
  authUserIds.push(data.user.id);
  const profile = await prisma.user.findUniqueOrThrow({
    where: { supabaseAuthUserId: data.user.id },
  });
  profileIds.push(profile.id);
  const cookie = await loginCookie(email);
  return { profile, cookie, email };
}

async function api(path: string, cookie: string, init?: RequestInit) {
  const response = await fetch(`${appUrl}${path}`, {
    ...init,
    headers: {
      cookie,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  let body: ApiBody = {};
  try {
    body = (await response.json()) as ApiBody;
  } catch {
    // Error status below provides enough context.
  }
  return { response, body };
}

async function createChild(userId: string, label: string, verified: boolean) {
  const child = await prisma.calonMurid.create({
    data: {
      userId,
      namaAnak: `Anak Phase 6 ${label}`,
      jalurId: routeId,
      kategoriId: categoryId,
      subKategoriText: "TK Integration Phase 6",
      statusKeseluruhan: StatusKeseluruhan.ENROLLMENT,
    },
  });
  childIds.push(child.id);
  if (verified) {
    const payment = await prisma.pembayaran.create({
      data: {
        calonMuridId: child.id,
        calonMuridReference: child.id,
        jenis: JenisPembayaran.PENDAFTARAN,
        metodePembayaran: MetodePembayaran.MIDTRANS,
        nominal: 500_000,
        status: StatusPembayaran.VERIFIED,
        verifiedAt: new Date(),
        midtransOrderId: `PHASE6-${marker}-${label}`,
        midtransSnapToken: `phase6-token-${marker}-${label}`,
      },
    });
    paymentIds.push(payment.id);
  }
  return child;
}

function valueFor(field: FieldPayload, email: string) {
  if (field.value) return field.value;
  if (field.tipeInput === TipeInput.EMAIL) return email;
  if (field.tipeInput === TipeInput.TEL) return "081234567890";
  if (field.tipeInput === TipeInput.DATE) return "2021-01-01";
  if (field.tipeInput === TipeInput.NUMBER) return "1";
  if (field.tipeInput === TipeInput.TEXTAREA) return "Jawaban observasi integration test.";
  return "Jawaban integration test";
}

try {
  const [waliA, waliB] = await Promise.all([
    createWali("a"),
    createWali("b"),
  ]);
  const route = await prisma.jalur.create({
    data: { nama: `Phase 6 Jalur ${marker}` },
  });
  const category = await prisma.kategoriPendaftar.create({
    data: {
      nama: `Phase 6 Kategori ${marker}`,
      tipe: KategoriTipe.EKSTERNAL,
    },
  });
  routeId = route.id;
  categoryId = category.id;
  routeIds.push(route.id);
  categoryIds.push(category.id);
  const verifiedChild = await createChild(waliA.profile.id, "verified", true);
  const unpaidChild = await createChild(waliA.profile.id, "unpaid", false);
  const otherChild = await createChild(waliB.profile.id, "other", true);

  const unpaid = await api(
    `/api/enrollment/fields?form_type=${FormType.DATA_PRIBADI}&calon_murid_id=${unpaidChild.id}`,
    waliA.cookie,
  );
  if (unpaid.response.status !== 403) {
    throw new Error(`Enrollment tanpa pembayaran tidak ditolak: ${unpaid.response.status}`);
  }

  const ownership = await api(
    `/api/enrollment/fields?form_type=${FormType.DATA_PRIBADI}&calon_murid_id=${otherChild.id}`,
    waliA.cookie,
  );
  if (ownership.response.status !== 403) {
    throw new Error(`Ownership enrollment tidak aman: ${ownership.response.status}`);
  }

  const personal = await api(
    `/api/enrollment/fields?form_type=${FormType.DATA_PRIBADI}&calon_murid_id=${verifiedChild.id}`,
    waliA.cookie,
  );
  if (personal.response.status !== 200 || !personal.body.data?.fields?.length) {
    throw new Error("Field Data Pribadi tidak dapat dimuat.");
  }
  const personalFields = personal.body.data.fields;
  const emailField = personalFields.find(
    (field) => field.autoFillSource === "akun_email",
  );
  if (!emailField || emailField.value !== waliA.email) {
    throw new Error("Auto-fill email akun tidak sesuai.");
  }
  const waField = personalFields.find(
    (field) => field.validasi === "format_wa_indonesia",
  );
  if (!waField) throw new Error("Field validasi WA tidak tersedia.");
  const invalidWa = await api(
    `/api/calon-murid/${verifiedChild.id}/enrollment`,
    waliA.cookie,
    {
      method: "PUT",
      body: JSON.stringify({
        formType: FormType.DATA_PRIBADI,
        intent: "draft",
        responses: [{ fieldId: waField.id, value: "12345" }],
      }),
    },
  );
  if (invalidWa.response.status !== 422) {
    throw new Error(`Nomor WA tidak valid tidak ditolak: ${invalidWa.response.status}`);
  }

  const observation = await api(
    `/api/enrollment/fields?form_type=${FormType.OBSERVASI}&calon_murid_id=${verifiedChild.id}`,
    waliA.cookie,
  );
  if (observation.response.status !== 200 || !observation.body.data?.fields?.length) {
    throw new Error("Field Observasi tidak dapat dimuat.");
  }
  const observationFields = observation.body.data.fields;
  const prematureSubmit = await api(
    `/api/calon-murid/${verifiedChild.id}/enrollment`,
    waliA.cookie,
    {
      method: "PUT",
      body: JSON.stringify({
        formType: FormType.OBSERVASI,
        intent: "submit",
        responses: observationFields.map((field) => ({
          fieldId: field.id,
          value: valueFor(field, waliA.email),
        })),
      }),
    },
  );
  if (prematureSubmit.response.status !== 422) {
    throw new Error(`Submit tanpa Data Pribadi tidak ditolak: ${prematureSubmit.response.status}`);
  }

  const personalDraft = await api(
    `/api/calon-murid/${verifiedChild.id}/enrollment`,
    waliA.cookie,
    {
      method: "PUT",
      body: JSON.stringify({
        formType: FormType.DATA_PRIBADI,
        intent: "draft",
        responses: personalFields.map((field) => ({
          fieldId: field.id,
          value: valueFor(field, waliA.email),
        })),
      }),
    },
  );
  if (personalDraft.response.status !== 200 || personalDraft.body.data?.submitted) {
    throw new Error("Draft Data Pribadi gagal atau dianggap final.");
  }

  const finalSubmit = await api(
    `/api/calon-murid/${verifiedChild.id}/enrollment`,
    waliA.cookie,
    {
      method: "PUT",
      body: JSON.stringify({
        formType: FormType.OBSERVASI,
        intent: "submit",
        responses: observationFields.map((field) => ({
          fieldId: field.id,
          value: valueFor(field, waliA.email),
        })),
      }),
    },
  );
  if (finalSubmit.response.status !== 200 || !finalSubmit.body.data?.submitted) {
    throw new Error("Submit final enrollment gagal.");
  }
  const submittedChild = await prisma.calonMurid.findUniqueOrThrow({
    where: { id: verifiedChild.id },
  });
  if (submittedChild.statusKeseluruhan !== StatusKeseluruhan.MENUNGGU_ASESMEN) {
    throw new Error("Submit final tidak memajukan status ke Menunggu Asesmen.");
  }

  const locked = await api(
    `/api/calon-murid/${verifiedChild.id}/enrollment`,
    waliA.cookie,
    {
      method: "PUT",
      body: JSON.stringify({
        formType: FormType.DATA_PRIBADI,
        intent: "draft",
        responses: [],
      }),
    },
  );
  if (locked.response.status !== 409) {
    throw new Error(`Enrollment final masih dapat diubah: ${locked.response.status}`);
  }

  const overview = await api(
    `/api/calon-murid/${verifiedChild.id}/enrollment`,
    waliA.cookie,
  );
  if (overview.response.status !== 200 || !overview.body.data?.submitted) {
    throw new Error("Enrollment final tidak dapat dibaca sebagai submitted.");
  }

  console.log("Phase 6 enrollment integration: OK");
} finally {
  if (profileIds.length || childIds.length) {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: profileIds } },
          { entityId: { in: childIds } },
        ],
      },
    });
  }
  if (paymentIds.length) {
    await prisma.pembayaran.deleteMany({ where: { id: { in: paymentIds } } });
  }
  if (childIds.length) {
    await prisma.calonMurid.deleteMany({ where: { id: { in: childIds } } });
  }
  if (categoryIds.length) {
    await prisma.kategoriPendaftar.deleteMany({
      where: { id: { in: categoryIds } },
    });
  }
  if (routeIds.length) {
    await prisma.jalur.deleteMany({ where: { id: { in: routeIds } } });
  }
  if (profileIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: profileIds } } });
  }
  for (const id of authUserIds) {
    await adminClient.auth.admin.deleteUser(id);
  }
  await prisma.$disconnect();
}
