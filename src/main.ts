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
import { initStepper } from "./sections/stepper";
import { initUploadDemo } from "./sections/upload-demo";

initStepper();
initDeadlineChain();
initActionKits();
initDocumentDesk();
initPolishDemo();
initSampleScenarios();
initUploadDemo();

// The masthead link targets the seam map, which lives inside a collapsed
// newsroom layer — open it when the link is used.
document.querySelectorAll<HTMLAnchorElement>('a[href="#aiH"]').forEach((a) =>
  a.addEventListener("click", () => {
    const details = document.getElementById("aiDetails") as HTMLDetailsElement | null;
    if (details) details.open = true;
  }),
);
