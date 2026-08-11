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
import { initSampleScenarios } from "./sections/sample-scenarios";
import { initCaseLookup } from "./sections/case-lookup";
import { initStageSummary } from "./sections/stage-summary";
import { initTourSteps } from "./sections/tour-steps";
import { initUploadDemo } from "./sections/upload-demo";
import { initUploadDoor } from "./sections/upload-door";

initDeadlineChain();
initActionKits();
initDocumentDesk();
initSampleScenarios();
initUploadDemo();
initUploadDoor();
initStageSummary();
initTourSteps();
initCaseLookup();

// The desk's way back up — one click returns to the chain.
document.getElementById("backToChain")?.addEventListener("click", () => {
  document.querySelector('section[data-tour="2"]')?.scrollIntoView({ block: "start" });
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
