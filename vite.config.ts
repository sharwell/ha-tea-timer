import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "TeaTimerCard",
      fileName: () => "tea-timer-card.js",
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    sourcemap: true,
    target: "es2019",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts"
  },
});
