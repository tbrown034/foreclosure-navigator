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

  test("opens the upload door with the disclosure beside the action", async ({ page }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Upload the notice" }).click();

    const panel = page.locator("#uploadPanel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("transmitted as-is to Anthropic");
    await expect(panel).toContainText("never trusted on its own");
    await expect(panel.locator("#noticeFile")).toBeVisible();
    // Both fictional samples are downloadable from the panel.
    await expect(panel.locator('a[href="/samples/sample-notice-a.pdf"]')).toBeVisible();
    await expect(panel.locator('a[href="/samples/sample-notice-b.pdf"]')).toBeVisible();
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
    // The demo strip offers the two fictional cases (live-AI; not run here).
    await expect(page.locator(".demo-strip")).toContainText("Demo");
    await expect(page.getByRole("button", { name: /Fictional case A/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Fictional case B/ })).toBeVisible();

    // Drive the chain through the API-free typed lookup instead.
    await page.getByLabel("File number from your notice").fill("FRCL-2026-2290");
    await page.getByRole("button", { name: "Find my case" }).click();

    await expect(page.locator("#chain > li")).toHaveCount(4);

    // The deterministic what-you-can-do panel renders with the chain.
    const stage = page.locator("#stagePanel");
    await expect(stage.locator(".stage-headline")).toContainText("printed sale date");
    await expect(stage.locator(".stage-row")).toHaveCount(6);
    await expect(stage).toContainText(/Marker passed|Apply by/);
    // The rail is a scrollspy: the demo click lands at the chain section.
    await expect(page.locator(".step-item.is-current")).toContainText("2");

    // The black button opens the legal-aid script INSIDE the row.
    await stage.getByRole("button", { name: "Get the call script for Free legal help" }).click();
    const firstRow = stage.locator(".stage-row").first();
    await expect(firstRow.locator("#docOut")).toContainText("CALL SCRIPT — free legal aid intake");
    await expect(firstRow.locator("#docOut")).toContainText("713-652-0077");
    await expect(firstRow.getByRole("button", { name: "Download this draft" })).toBeVisible();

    // "Tell me more" expands the kit INSIDE the row — verified numbers in
    // place, no second list (the standalone cards are hidden).
    await stage.getByRole("button", { name: "Tell me more about Free legal help" }).click();
    await expect(firstRow.locator('a[href^="tel:"]', { hasText: "713-652-0077" })).toBeVisible();
    await expect(page.locator("#actionCards")).toBeHidden();

    // The AI summary is offered, labeled, and optional (not called here).
    await expect(stage.locator(".ai-summary")).toContainText("AI summary — optional live model call");
    await expect(stage.locator(".ai-summary")).toContainText("code check rejects");

    // The dock moves: the loss-mitigation row's Email button pulls it there.
    await stage.getByRole("button", { name: "Draft the email for Loss mitigation — apply in writing" }).click();
    const lmRow = stage.locator(".stage-row", { hasText: "Loss mitigation" });
    await expect(lmRow.locator("#docOut")).toContainText("Loss Mitigation Department");
    await expect(lmRow.locator("#docOut")).toContainText("ATTACHMENT DRAFT: hardship narrative");

    await page.getByRole("button", { name: "Enter dates manually" }).click();
    await expect(page.locator("#manualEntry")).toHaveJSProperty("open", true);
    expect(errors).toEqual([]);
  });
});
