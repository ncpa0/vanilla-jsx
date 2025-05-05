import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    dir: "__tests__",
    environment: "happy-dom",
    setupFiles: "__tests__/setup.ts",
  },
  esbuild: {
    jsxInject: "",
    jsxFactory: "jsx",
    jsxFragment: "Fragment",
  },
  resolve: {
    alias: {
      "@/": "./src/",
    },
  },
});
