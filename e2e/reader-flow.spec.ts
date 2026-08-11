import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

function trackRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}

test.describe("reader flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("loads without console or page errors", async ({ page }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto("/");

    await expect(page).toHaveTitle(/Foreclosure Navigator/);
    await expect(page.locator("#urgency")).toContainText("Nothing to compute yet");
    expect(errors).toEqual([]);
  });

  test("finds, saves, restores, and removes a county-index case", async ({ page }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto("/");
    await page.getByLabel("File number from your notice").fill("FRCL-2026-5486");
    await page.getByRole("button", { name: "Find my case" }).click();

    await expect(page.locator("#lookupResult")).toContainText("filed 2026-07-30");
    await expect(page.locator("#urgency .num")).toHaveText(/^-?\d+ days$/);

    await page.getByRole("button", { name: "Save on this device" }).click();
    await expect(page.locator("#savedCase")).toContainText("Saved case: FRCL-2026-5486");
    expect(await page.evaluate(() => localStorage.getItem("fn-saved-case"))).toContain("FRCL-2026-5486");

    await page.reload();
    await expect(page.locator("#savedCase")).toContainText("Saved case: FRCL-2026-5486");
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.locator("#savedCase")).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("fn-saved-case"))).toBeNull();
    expect(errors).toEqual([]);
  });

  test("reports a county-index miss honestly", async ({ page }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto("/");
    await page.getByLabel("File number from your notice").fill("FRCL-2026-9999");
    await page.getByRole("button", { name: "Find my case" }).click();

    await expect(page.locator("#lookupResult")).toContainText("not in this index of 686 filings");
    expect(errors).toEqual([]);
  });

  test("walks the sample through the checked replay and call kit", async ({ page }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto("/");
    await page.getByRole("button", { name: /Upload a notice/ }).click();

    await expect(page.locator("#chain > li")).toHaveCount(4);
    await expect(page.locator("#aiOffer")).toBeVisible();
    await page.getByRole("button", { name: /Next: replay the AI read/ }).click();

    await expect(page.locator("#extractResult .extract-meta")).toContainText("Recorded claude-haiku-4-5 run");
    await expect(page.locator("#extractResult .extract-checks .chip.window")).toHaveCount(19);
    await expect(page.locator("#extractResult .extract-checks .chip.deadline")).toHaveCount(0);

    await page.getByRole("button", { name: "Next: see who to call" }).click();
    const firstKit = page.locator("#actionCards details.action").first();
    await expect(firstKit).toHaveJSProperty("open", true);
    const legalAidPhone = firstKit.locator('a[href^="tel:"]', { hasText: "713-652-0077" });
    await expect(legalAidPhone).toBeVisible();

    await page.getByRole("button", { name: "Enter dates manually" }).click();
    await expect(page.locator("#manualEntry")).toHaveJSProperty("open", true);
    expect(errors).toEqual([]);
  });
});
