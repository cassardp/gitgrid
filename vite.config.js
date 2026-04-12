import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "gitgrid-worker/public",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/img": "http://localhost:8787",
    },
  },
});
