import { expect, test, type Page } from "@playwright/test";

import { createE2EFixture, type E2EFixture } from "./support/staging-fixture";

let fixture: E2EFixture;

async function login(page: Page, path: "/login" | "/admin/login", email: string, password: string) {
  await page.goto(path);
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

test.describe("SPMB Fila critical browser journeys", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    fixture = await createE2EFixture();
  });

  test.afterAll(async () => {
    await fixture?.cleanup();
  });

  test("halaman publik mengarahkan wali ke registrasi", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Proses pendaftaran sekolah");
    await page.getByRole("link", { name: "Buat akun wali murid" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Buat akun baru");
  });

  test("session anonim ditolak oleh halaman dan API terlindungi", async ({ page, request }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Masuk ke akun");
    const response = await request.get("/api/admin/laporan/export?format=csv");
    expect(response.status()).toBe(401);
  });

  test("wali melihat dua anak terisolasi dan tidak dapat masuk area admin", async ({ page }) => {
    await login(page, "/login", fixture.waliEmail, fixture.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Anak Saya");
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(page.getByText(fixture.firstChildName, { exact: true })).toBeVisible();
    await expect(page.getByText(fixture.finishedChildName, { exact: true })).toBeVisible();

    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/login\?auth=forbidden$/);
    await expect(page.getByText("Session tidak memiliki akses administrator.")).toBeVisible();
  });

  test("admin dapat memfilter laporan peserta melalui UI", async ({ page }) => {
    await login(page, "/admin/login", fixture.adminEmail, fixture.password);
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await page.getByRole("link", { name: "Laporan", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Laporan peserta");
    await page.getByLabel("Cari peserta").fill(fixture.finishedChildName);
    await page.getByRole("button", { name: "Terapkan filter" }).click();
    await expect(page).toHaveURL(/\/admin\/laporan\?q=/);
    await expect(page.getByText("1 peserta sesuai filter")).toBeVisible();
    await expect(page.getByText(fixture.finishedChildName, { exact: true })).toBeVisible();
    await expect(page.getByText(fixture.firstChildName, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Unduh Excel" })).toHaveAttribute("href", /format=xlsx/);
  });
});
