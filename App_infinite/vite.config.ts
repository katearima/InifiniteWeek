import { defineConfig } from "vite";

// Keep the existing Vue in-DOM templates and the Bun development server.
export default defineConfig({
  root: "web",
  build: { outDir: "../dist", emptyOutDir: true },
});
