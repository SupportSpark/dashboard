import { defineConfig } from "vitest/config";

// Unit tests only — e2e lives in e2e/ and runs through Playwright (npm test).
export default defineConfig({
  resolve: {
    // Honors the "@/…" / "@components/…" aliases from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // Provides a translation context for upstream component tests, which render
    // components bare. See the file for why this is preferable to editing
    // upstream's tests: it keeps them byte-identical to upstream so they keep
    // merging cleanly on every sync.
    setupFiles: ["./vitest.setup.ts"],
    // src/i18n/detection.test.ts is a standalone assertion script (`npm run
    // test:i18n`), not a vitest suite: it calls process.exit() and registers no
    // tests. Vitest's `include` glob would collect it and fail with
    // "No test suite found in file".
    exclude: ["**/node_modules/**", "src/i18n/detection.test.ts"],
  },
});
