import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    dir: "__tests__",
    environment: "happy-dom",
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
