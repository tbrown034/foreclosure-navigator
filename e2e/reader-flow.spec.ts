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
    await page.getByRole("button", { name: /See a demo case/ }).click();

    await expect(page.locator("#chain > li")).toHaveCount(4);

    // The deterministic what-you-can-do panel renders with the chain.
    const stage = page.locator("#stagePanel");
    await expect(stage.locator(".stage-headline")).toContainText("printed sale date");
    await expect(stage.locator(".stage-row")).toHaveCount(6);
    await expect(stage).toContainText(/Marker passed|Apply by/);
    await expect(page.locator(".step-item.is-current")).toContainText("3");

    // A panel call button loads the legal-aid script in draft-and-call.
    await stage.getByRole("button", { name: "Call — get the script" }).first().click();
    await expect(page.locator("#docOut")).toContainText("CALL SCRIPT — free legal aid intake");
    await expect(page.locator("#docOut")).toContainText("713-652-0077");
    await expect(page.locator("#deskNote")).toBeVisible();
    await expect(page.locator(".step-item.is-current")).toContainText("4");

    // "Tell me more" opens the matching kit with the verified numbers.
    await stage.getByRole("button", { name: "Tell me more" }).first().click();
    const legalKit = page.locator('details.action[data-kit="legal-help"]');
    await expect(legalKit).toHaveJSProperty("open", true);
    await expect(legalKit.locator('a[href^="tel:"]', { hasText: "713-652-0077" })).toBeVisible();

    await expect(page.locator("#aiOffer")).toBeVisible();
    await page.getByRole("button", { name: /Next: replay the AI read/ }).click();

    await expect(page.locator("#extractResult .extract-meta")).toContainText("Recorded claude-haiku-4-5 run");
    await expect(page.locator("#extractResult .extract-checks .chip.window")).toHaveCount(19);
    await expect(page.locator("#extractResult .extract-checks .chip.deadline")).toHaveCount(0);

    // The desk's service buttons work standalone: pick one, draft below.
    await page.getByRole("button", { name: "Email: loss-mitigation request" }).click();
    await expect(page.locator("#docOut")).toContainText("Loss Mitigation Department");
    await expect(page.locator("#docOut")).toContainText("ATTACHMENT DRAFT: hardship narrative");

    await page.getByRole("button", { name: "Enter dates manually" }).click();
    await expect(page.locator("#manualEntry")).toHaveJSProperty("open", true);
    expect(errors).toEqual([]);
  });
});
