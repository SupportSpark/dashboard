import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/DropdownMenu";

/**
 * Documents the DropdownMenuItem trap that broke the header language switcher.
 *
 * The wrapper overrides onClick and ends it with preventDefault() +
 * stopPropagation(). Radix composes the caller's onClick with its internal
 * handler through `composeEventHandlers`, which SKIPS the internal handler when
 * the caller called preventDefault. That internal handler is `handleSelect` — it
 * is what dispatches the `menu.itemSelect` event that invokes `onSelect`, and what
 * closes the menu.
 *
 * Therefore: onClick runs, onSelect does not. A menu item whose only action is
 * `onSelect` fires nothing — it renders, the click lands, and nothing happens.
 *
 * The second case below asserts that absence ON PURPOSE. It is not a broken test;
 * it is the regression guard that makes the trap visible, and it pairs with
 * tools/check-dropdown-onselect.mjs, which fails if any item tries onSelect alone.
 * Do not "fix" it by expecting onSelect to be called — if that ever becomes true,
 * this whole file should be reconsidered, because the wrapper changed shape.
 */
function Harness({
  onSelect,
  onClick,
}: {
  onSelect?: () => void;
  onClick?: () => void;
}) {
  return (
    <DropdownMenu open={true} modal={false}>
      <DropdownMenuTrigger>open</DropdownMenuTrigger>
      <DropdownMenuContent forceMount>
        <DropdownMenuItem onSelect={onSelect} onClick={onClick}>
          Item
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe("DropdownMenuItem action wiring", () => {
  afterEach(cleanup);

  it("runs onClick — the only carrier that works", () => {
    const onClick = vi.fn();
    render(<Harness onClick={onClick} />);
    fireEvent.click(screen.getByRole("menuitem"));
    expect(onClick).toHaveBeenCalled();
  });

  it("never runs onSelect — the wrapper's preventDefault blocks it", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("menuitem"));
    // Asserted absent. See the file comment: this is the trap, pinned.
    expect(onSelect).not.toHaveBeenCalled();
  });
});
