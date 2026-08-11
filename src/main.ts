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
import { initUploadDemo } from "./sections/upload-demo";

initDeadlineChain();
initActionKits();
initDocumentDesk();
initPolishDemo();
initSampleScenarios();
initUploadDemo();

// "Read the notice" opens the example document.
document.getElementById("viewExample")?.addEventListener("click", () => {
  const doc = document.getElementById("exampleDoc") as HTMLDetailsElement | null;
  if (doc) {
    doc.open = !doc.open;
    if (doc.open) doc.scrollIntoView({ block: "nearest" });
  }
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
