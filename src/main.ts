/**
 * Entry point. The page is static HTML (index.html) with one behavior
 * module per section mounted onto it. Section order matters only in that
 * the deadline chain publishes the sale clock the kits and desk read on
 * their first render.
 */

import "./styles.css";
import { initActionKits } from "./sections/action-kits";
import { initAuctionCalendar } from "./sections/auction-calendar";
import { initDeadlineChain } from "./sections/deadline-chain";
import { initDocumentDesk } from "./sections/document-desk";
import { initPolishDemo } from "./sections/polish-demo";
import { initStepper } from "./sections/stepper";
import { initTrackSelector } from "./sections/track-selector";

initTrackSelector();
initStepper();
initDeadlineChain();
initActionKits();
initDocumentDesk();
initPolishDemo();
initAuctionCalendar();
