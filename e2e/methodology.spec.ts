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

test("renders the measured benchmark and preserves the exhibits", async ({ page }) => {
  const errors = trackRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/methodology.html");

  await expect(page.locator("#benchmarkBody > tr")).toHaveCount(29);
  await expect(page.locator("#benchmarkSummary")).toContainText("27/29");
  await expect(page.locator("#benchmarkFlaggedList")).toContainText("FRCL-2026-4223");
  await expect(page.locator("#benchmarkFlaggedList")).toContainText("FRCL-2026-5207");
  await expect(page.locator("#exhibits")).toBeVisible();
  expect(errors).toEqual([]);
});
