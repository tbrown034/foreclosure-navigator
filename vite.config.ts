import { defineConfig } from "vite";

// Static build: index.html is the single entry; lib/ and src/ are bundled in.
// api/ is NOT part of this build — Vercel deploys extract.ts and polish.ts
// separately as the project's two serverless functions.
export default defineConfig({
  build: {
    target: "es2022",
  },
});
