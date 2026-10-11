/**
 * Vitest setup for the localized fork.
 *
 * Why this is needed
 * ------------------
 * Upstream's unit tests render components directly (`render(<Component />)`)
 * without any provider, because upstream components had no translation layer.
 * On this branch those same components call `useTranslations()`, which throws
 * "the context from NextIntlClientProvider was not found" under test.
 *
 * The two options were:
 *   1. edit each of upstream's test files to wrap renders in a provider, or
 *   2. provide the translator globally, once, here.
 *
 * (1) would put this fork in permanent conflict with every upstream test file
 * it touches, on every sync. (2) keeps upstream's tests byte-identical to
 * upstream, so they keep merging cleanly — which is the whole point of this
 * branch's design.
 *
 * The mock is deliberately thin: it delegates to next-intl's own
 * `createTranslator`, so real ICU interpolation, plurals, and the `.rich()` /
 * `.markup()` helpers behave exactly as they do in the app. Only the React
 * context requirement is removed.
 */

import { vi } from "vitest";

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  const { createTranslator } = actual;
  const en = (await import("./src/i18n/messages/en")).default;

  /**
   * Build a translator for an optional namespace, using the real English
   * catalog. Falls back to the root catalog when no namespace is given.
   */
  const makeTranslator = (namespace?: string) =>
    createTranslator({
      locale: "en",
      messages: en as Record<string, never>,
      ...(namespace ? { namespace } : {}),
    });

  return {
    ...actual,
    useTranslations: (namespace?: string) => makeTranslator(namespace),
    getTranslations: async (namespaceOrOpts?: unknown) =>
      makeTranslator(
        typeof namespaceOrOpts === "string"
          ? namespaceOrOpts
          : (namespaceOrOpts as { namespace?: string } | undefined)?.namespace,
      ),
    // Components that branch on the active locale should see the default one.
    useLocale: () => "en",
  };
});
