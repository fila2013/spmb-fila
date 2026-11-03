import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, expect as browserExpect } from "@playwright/test";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const origin = "http://whatsapp-admin.test";
const participantId = "10000000-0000-4000-8000-000000000001";
const participantName = "Naya & Rafi Uji";
const recipientName = "Sari Uji";
const recipientPhone = "6281222222222";
const category = "Eksternal/Umum";
const status = "Menunggu pengumuman";
const expectedDraft = [
  "Halo Sari Uji, peserta Naya & Rafi Uji.",
  "Jalur: Reguler • Kategori: Eksternal/Umum.",
  "Status: Menunggu pengumuman.",
].join("\n");
const draftData = {
  ok: true,
  participantName,
  contacts: [
    { role: "ayah", name: "Budi Uji", number: "6281111111111" },
    { role: "bunda", name: recipientName, number: recipientPhone },
  ],
  templates: [
    { id: "template-1", judul: "Pengingat uji", kategori: "PENGINGAT_PEMBAYARAN", isiPesan: "Pengingat untuk {nama_peserta}" },
    {
      id: "template-2",
      judul: "Informasi uji",
      kategori: "INFORMASI_UMUM",
      isiPesan: "Halo {nama_wali}, peserta {nama_peserta}.\nJalur: {jalur} • Kategori: {kategori}.\nStatus: {status}.",
    },
  ],
  values: { nama_peserta: participantName, jalur: "Reguler", kategori: category, status },
};

let browser: Browser;
let bundle: string;
let css = "";

beforeAll(async () => {
  const entry = [
    "import {createRoot} from 'react-dom/client';",
    "import {AdminShell} from './components/admin/admin-shell';",
    "import {ParticipantQuickEditTable} from './components/admin/participant-quick-edit';",
    "import {WhatsappTemplateForm} from './components/admin/whatsapp-template-form';",
    "const item = " + JSON.stringify({
      id: participantId,
      namaAnak: participantName,
      email: "wali@example.test",
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-01T10:00:00.000Z",
      jalurKategori: "Reguler / " + category,
      statusKeseluruhan: "MENUNGGU_PENGUMUMAN",
      assessmentStatus: "BELUM",
      assessmentNote: "",
      announcementStatus: null,
      releaseDate: "",
      announcementLocked: false,
      finalRouteChoiceEnabled: false,
    }) + ";",
    "const activePath = location.pathname;",
    "createRoot(document.getElementById('root')).render(<AdminShell activePath={activePath} title='Admin Uji' description='Data sintetis' email='admin@example.test'>",
    "{activePath === '/admin/peserta' ? <ParticipantQuickEditTable initialParticipants={[item]} filteredStatus={null} /> : <WhatsappTemplateForm />}",
    "</AdminShell>);",
  ].join("\n");
  const modules: Record<string, string> = {
    "@/app/admin/konten/kirim-wa/actions": [
      "export async function saveWhatsappTemplateAction(_previous, form) {",
      "  const response = await fetch('/fixture/template', {method: 'POST', body: JSON.stringify(Object.fromEntries(form))});",
      "  return response.json();",
      "}",
    ].join("\n"),
    "@/app/admin/peserta/whatsapp-actions": [
      "export async function loadParticipantWhatsappDrafts(id) {",
      "  const response = await fetch('/fixture/participant/' + encodeURIComponent(id));",
      "  return response.json();",
      "}",
    ].join("\n"),
    "@/components/admin/admin-logout-form": "export function AdminLogoutForm() { return null; }",
    "@/components/admin/stage-forms": "export function AnnouncementResultForm() { return null; } export function AssessmentResultForm() { return null; }",
    "next/link": "export default function Link({href, children, ...props}) { return <a href={href} {...props}>{children}</a>; }",
    "next/navigation": "export function useRouter() { return {refresh() {}}; }",
  };
  const result = await build({
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: entry },
    plugins: [{
      name: "mock-browser-boundaries",
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, ({ path }) => Object.hasOwn(modules, path) ? { path, namespace: "test" } : undefined);
        builder.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({ loader: "tsx", resolveDir: process.cwd(), contents: modules[path] }));
      },
    }],
  });
  bundle = result.outputFiles[0].text;
  const chunks = join(process.cwd(), ".next/static/chunks");
  if (existsSync(chunks)) {
    css = readdirSync(chunks, { recursive: true })
      .filter((path): path is string => typeof path === "string" && path.endsWith(".css"))
      .map((path) => readFileSync(join(chunks, path), "utf8"))
      .join("\n");
  }
  browser = await chromium.launch(existsSync(chromium.executablePath())
    ? { headless: true }
    : { channel: "chrome", headless: true });
});

afterAll(async () => { await browser?.close(); });

async function testPage(fixture: typeof draftData = draftData) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const openedUrls: string[] = [];
  const fetchedParticipants: string[] = [];
  const savedTemplates: unknown[] = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "https://wa.me") {
      openedUrls.push(url.href);
      return route.fulfill({ contentType: "text/html", body: "<h1>Draf WhatsApp sintetis</h1>" });
    }
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith("/fixture/participant/")) {
      fetchedParticipants.push(url.pathname.slice("/fixture/participant/".length));
      return route.fulfill({ json: fixture });
    }
    if (url.pathname === "/fixture/template" && route.request().method() === "POST") {
      const data = route.request().postDataJSON();
      savedTemplates.push(data);
      return route.fulfill({ json: {
        status: "success",
        message: "Template WhatsApp berhasil disimpan.",
        template: { ...data, id: "synthetic-template", statusAktif: data.statusAktif === "on" },
      } });
    }
    if (url.pathname === "/bundle.js") return route.fulfill({ contentType: "text/javascript", body: bundle });
    return route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><style>" + css + "</style><div id='root'></div><script src='/bundle.js'></script>",
    });
  });
  return { context, page: await context.newPage(), openedUrls, fetchedParticipants, savedTemplates };
}

describe("browser Admin Kirim WhatsApp (tanpa database dan tanpa WhatsApp nyata)", () => {
  it("menempatkan menu template persis setelah menu Join WhatsApp dan menandainya aktif", async () => {
    const { context, page } = await testPage();
    try {
      await page.goto(origin + "/admin/konten/kirim-wa");
      const navigation = page.getByRole("navigation", { name: "Navigasi admin" });
      const link = navigation.getByRole("link", { name: "Konten Kirim WhatsApp", exact: true });
      await browserExpect(link).toBeVisible();
      await browserExpect(link).toHaveAttribute("aria-current", "page");
      await browserExpect(link).toHaveAttribute("href", "/admin/konten/kirim-wa");
      const labels = await navigation.getByRole("link").allTextContents();
      expect(labels[labels.indexOf("Konten Join WhatsApp") + 1]).toBe("Konten Kirim WhatsApp");
    } finally {
      await context.close();
    }
  });

  it("mengambil data saat aksi ditekan, mempersonalisasi draf, dan membukanya di tab baru", async () => {
    const { context, page, openedUrls, fetchedParticipants } = await testPage();
    try {
      await page.goto(origin + "/admin/peserta");
      const row = page.getByRole("row").filter({ hasText: participantName });
      await browserExpect(row.getByRole("link", { name: "Kelola", exact: true })).toBeVisible();
      expect(fetchedParticipants).toEqual([]);
      await row.getByRole("button", { name: "Kirim WhatsApp untuk " + participantName, exact: true }).click();
      const dialog = page.getByRole("dialog");
      await browserExpect(dialog).toBeVisible();
      const receiver = dialog.getByRole("combobox", { name: /^Penerima/ });
      await browserExpect(receiver.locator("option", { hasText: recipientName })).toHaveAttribute("value", "bunda");
      await receiver.selectOption("bunda");
      const template = dialog.getByRole("combobox", { name: /^Template pesan/ });
      await template.selectOption({ value: "template-2" });
      for (const line of expectedDraft.split("\n")) {
        await browserExpect(dialog.getByText(line, { exact: false })).toBeVisible();
      }
      expect(fetchedParticipants).toEqual([participantId]);
      expect(openedUrls).toEqual([]);
      const link = dialog.getByRole("link", { name: "Buka WhatsApp", exact: true });
      await browserExpect(link).toHaveAttribute("target", "_blank");
      await browserExpect(link).toHaveAttribute("rel", /noopener/);
      const popup = page.waitForEvent("popup");
      await link.click();
      const newTab = await popup;
      await browserExpect(newTab.getByRole("heading", { name: "Draf WhatsApp sintetis" })).toBeVisible();
      expect(openedUrls).toHaveLength(1);
      const url = new URL(openedUrls[0]);
      expect(url.origin).toBe("https://wa.me");
      expect(url.pathname).toBe("/" + recipientPhone);
      expect(url.searchParams.get("text")).toBe(expectedDraft);
      expect(page.url()).toBe(origin + "/admin/peserta");
    } finally {
      await context.close();
    }
  });

  it("menyisipkan variabel pada seleksi teks dan mengirim kategori serta isi template", async () => {
    const { context, page, savedTemplates } = await testPage();
    try {
      await page.goto(origin + "/admin/konten/kirim-wa");
      await page.getByLabel("Judul template", { exact: true }).fill("Pengingat uji");
      await page.getByRole("combobox", { name: /^Kategori template/ }).selectOption("PENGINGAT_PEMBAYARAN");
      const message = page.getByLabel("Isi template pesan", { exact: true });
      await message.fill("Halo [wali], cek status.");
      await message.evaluate((element) => {
        if (element instanceof HTMLTextAreaElement) element.setSelectionRange(5, 11);
      });
      await page.getByRole("button", { name: "{nama_wali}", exact: true }).click();
      await browserExpect(message).toHaveValue("Halo {nama_wali}, cek status.");
      await page.getByRole("button", { name: "Simpan template", exact: true }).click();
      await browserExpect(page.getByRole("status")).toHaveText("Template WhatsApp berhasil disimpan.");
      expect(savedTemplates).toEqual([{
        judul: "Pengingat uji",
        kategori: "PENGINGAT_PEMBAYARAN",
        isiPesan: "Halo {nama_wali}, cek status.",
        statusAktif: "on",
      }]);
    } finally {
      await context.close();
    }
  });

  it("menjelaskan ketika data kontak dan template belum tersedia, tanpa menawarkan tautan kirim", async () => {
    const { context, page, openedUrls } = await testPage({ ...draftData, contacts: [], templates: [] });
    try {
      await page.goto(origin + "/admin/peserta");
      await page.getByRole("button", { name: "Kirim WhatsApp untuk " + participantName, exact: true }).click();
      const dialog = page.getByRole("dialog");
      await browserExpect(dialog.getByText("Belum ada nomor WhatsApp wali yang valid", { exact: false })).toBeVisible();
      await browserExpect(dialog.getByText("Belum ada template aktif", { exact: false })).toBeVisible();
      await browserExpect(dialog.getByRole("link", { name: "Kelola template WhatsApp", exact: true })).toHaveAttribute("href", "/admin/konten/kirim-wa");
      await browserExpect(dialog.getByRole("link", { name: "Buka WhatsApp", exact: true })).toHaveCount(0);
      expect(openedUrls).toEqual([]);
      await page.keyboard.press("Escape");
      await browserExpect(dialog).not.toBeVisible();
    } finally {
      await context.close();
    }
  });
});
