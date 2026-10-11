import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";

/**
 * The header language switcher must actually switch the language when clicked.
 *
 * Reported bug: clicking a language in the top-right menu did nothing, while the
 * settings-page switcher worked. Cause: this component used
 * `onSelect` on `DropdownMenuItem`, whose wrapper ends its own onClick with
 * preventDefault() — and Radix's composeEventHandlers therefore skips
 * `handleSelect`, the function that dispatches the event onSelect listens for.
 * The item rendered, the click landed, and nothing happened.
 *
 * These assertions are about the ACTION firing, not about internals, so they stay
 * meaningful if the menu is rebuilt on a different primitive.
 */

const setLocale = vi.fn();

// LocaleProvider is stubbed: this test is about the click reaching setLocale, not
// about how the locale is detected or persisted.
vi.mock("@/contexts/LocaleProvider", () => ({
  useLocale: () => ({ locale: "en", setLocale, mounted: true }),
}));

describe("LocaleSwitcher", () => {
  afterEach(() => {
    cleanup();
    setLocale.mockClear();
  });

  async function open() {
    const { default: LocaleSwitcher } = await import("./LocaleSwitcher");
    const messages = (await import("@/i18n/messages/en")).default;
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <LocaleSwitcher />
      </NextIntlClientProvider>,
    );
    const trigger = screen.getByRole("button");
    // Radix's dropdown trigger opens on POINTERDOWN, not on click. A plain
    // fireEvent.click leaves aria-expanded="false" and the menu never mounts,
    // which is why the first version of this test could not find any menuitem.
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.pointerUp(trigger, { button: 0 });
    fireEvent.click(trigger);
  }

  it("calls setLocale when a language is clicked", async () => {
    await open();
    // The trigger is a button; the menu items are menuitems.
    const items = await screen.findAllByRole("menuitem");
    expect(items.length).toBeGreaterThan(0);
    fireEvent.click(items[items.length - 1]);
    expect(setLocale).toHaveBeenCalled();
  });

  it("does not need onSelect to be the action carrier", async () => {
    // Regression guard for the specific trap: the wrapper's preventDefault makes
    // onSelect unreachable, so the action MUST ride on onClick.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      "src/components/ui/LocaleSwitcher.tsx",
      "utf8",
    );
    // Strip comments so the explanatory comment mentioning onSelect does not
    // trip this check.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(code).not.toMatch(/onSelect\s*=/);
  });
});
