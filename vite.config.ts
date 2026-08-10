import { defineConfig } from "vite";

// Static build: index.html is the single entry; lib/ and src/ are bundled in.
// api/polish.ts is NOT part of this build — Vercel deploys it separately as
// the project's one serverless function.
export default defineConfig({
  build: {
    target: "es2022",
  },
});
