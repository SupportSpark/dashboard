import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SegmentedTabs } from "./SegmentedTabs";

/**
 * Regression guard for the tab bar stretching across the page.
 *
 * The shared Trigger used to carry `w-full`. Its parent is a flex TabsList that
 * sizes to its content, so `w-full` resolved to the list's own width and every
 * trigger asked for all of it. With two short English labels the browser still
 * collapsed the list to its content and nothing looked wrong; four longer
 * Chinese labels (节点/用户/组/网络) pushed past the available space and, with the
 * labels unable to wrap, the list stretched instead.
 *
 * A layout assertion in jsdom cannot measure pixels, so these pin the class
 * contract that produced the bug: no orphan `w-full` on the trigger itself, and
 * a nowrap label that is allowed to shrink.
 */
describe("SegmentedTabs trigger sizing", () => {
  // Each case renders its own tree; without this, `getAllByRole` also returns
  // the tabs left in the document by the previous test.
  afterEach(cleanup);

  /** Tabs rendered for this test only. */
  function renderTabs(n: number, triggerClass = "") {
    render(
      <SegmentedTabs value={"t0"}>
        <SegmentedTabs.List>
          {Array.from({ length: n }, (_, i) => (
            <SegmentedTabs.Trigger
              key={i}
              value={`t${i}`}
              className={triggerClass}
            >
              标签{i}
            </SegmentedTabs.Trigger>
          ))}
        </SegmentedTabs.List>
      </SegmentedTabs>,
    );
    return screen.getAllByRole("tab");
  }

  it("does not force every trigger to the full list width", () => {
    const tabs = renderTabs(4);
    expect(tabs).toHaveLength(4);
    for (const tab of tabs) {
      // `w-full` on its own is the bug: four of them cannot fit.
      const classes = tab.className.split(/\s+/);
      expect(classes).not.toContain("w-full");
    }
  });

  it("keeps the content row centered without claiming the full width", () => {
    const tabs = renderTabs(4);
    const row = tabs[0].firstElementChild as HTMLElement;
    expect(row.className).toContain("justify-center");
    expect(row.className.split(/\s+/)).not.toContain("w-full");
  });

  it("still honours an explicit w-full from the caller", () => {
    // A dropdown-style control wants equal-width segments; that must keep working.
    const tabs = renderTabs(2, "w-full");
    for (const tab of tabs) {
      expect(tab.className).toContain("w-full");
    }
  });
});
