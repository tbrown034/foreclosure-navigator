/**
 * Entry point. The page is static HTML (index.html) with one behavior
 * module per section mounted onto it. Section order matters only in that
 * the deadline chain publishes the sale clock the kits and desk read on
 * their first render.
 */

import "./styles.css";
import { initActionKits } from "./sections/action-kits";
import { initDeadlineChain } from "./sections/deadline-chain";
import { initDocumentDesk } from "./sections/document-desk";
import { initPolishDemo } from "./sections/polish-demo";
import { initSampleScenarios } from "./sections/sample-scenarios";
import { initCaseLookup } from "./sections/case-lookup";
import { initStageSummary } from "./sections/stage-summary";
import { initTourSteps } from "./sections/tour-steps";
import { initUploadDemo } from "./sections/upload-demo";

initDeadlineChain();
initActionKits();
initDocumentDesk();
initPolishDemo();
initSampleScenarios();
initUploadDemo();
initStageSummary();
initTourSteps();
initCaseLookup();

// Beat four is never gated on the AI: the calls are always one click away.
document.getElementById("toCallsBtn")?.addEventListener("click", () => {
  const firstKit = document.querySelector<HTMLDetailsElement>("#actionCards details");
  if (firstKit) firstKit.open = true;
  document.getElementById("actH")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
  document.dispatchEvent(new CustomEvent("fn:paperwork"));
});

// "enter your own dates" opens the collapsed manual form.
document.getElementById("openManual")?.addEventListener("click", () => {
  const manual = document.getElementById("manualEntry") as HTMLDetailsElement | null;
  if (manual) {
    manual.open = true;
    manual.scrollIntoView({ block: "center" });
    (manual.querySelector("select") as HTMLSelectElement | null)?.focus();
  }
});
