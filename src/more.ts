/** Entry point for /more — the full-story page. Static content except the
 * live-computed auction calendar and the §34.21 tax redemption calculator. */

import "./styles.css";
import { initAuctionCalendar } from "./sections/auction-calendar";
import { initTaxPanel } from "./sections/track-selector";

initTaxPanel();
initAuctionCalendar();
