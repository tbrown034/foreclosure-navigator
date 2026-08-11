import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Static build with two entries: index.html (the tool — the 90-second page)
// and more.html (the full story: pitch, exhibits, county layer). lib/ and
// src/ are bundled in. api/ is NOT part of this build — Vercel deploys
// extract.ts and polish.ts separately as the project's two serverless
// functions.
export default defineConfig({
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        more: fileURLToPath(new URL("./more.html", import.meta.url)),
      },
    },
  },
});
