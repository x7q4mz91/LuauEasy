import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [],
  build: {
    target: "esnext",
  },
  optimizeDeps: {
    exclude: ["luau-web"],
  },
  worker: {
    format: "es",
  },
});