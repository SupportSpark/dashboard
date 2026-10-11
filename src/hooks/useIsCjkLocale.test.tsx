import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import React from "react";
import LocaleProvider from "@/contexts/LocaleProvider";
import { useIsCjkLocale } from "./useIsCjkLocale";

/**
 * The flag drives real layout decisions (a wider DeviceCard, dropping 10px
 * uppercase labels for Chinese), so it has to be right in both directions.
 *
 * LocaleProvider resolves the locale on the client, so these render through it —
 * the hook is a thin read of that context.
 */
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <NextIntlClientProvider locale="en" messages={{}}>
        {children}
      </NextIntlClientProvider>
    </LocaleProvider>
  );
}

describe("useIsCjkLocale", () => {
  it("returns a boolean without a provider, never throws", () => {
    // Components in stories and tests render outside LocaleProvider; the context
    // default must keep this callable (an earlier try/catch version broke the
    // rules of hooks and eslint rejected it).
    const { result } = renderHook(() => useIsCjkLocale());
    expect(typeof result.current).toBe("boolean");
  });

  it("is false for the default (English) locale", () => {
    const { result } = renderHook(() => useIsCjkLocale(), { wrapper });
    expect(result.current).toBe(false);
  });
});
