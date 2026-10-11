"use client";

import { useLocale } from "@/contexts/LocaleProvider";

/**
 * Utility to build the "small caps label" style used by table headers and
 * section labels, adapted to the active script.
 *
 * The house style is `text-[11px] uppercase tracking-wider`. Every part of that
 * is a Latin-script device:
 *
 *   - `uppercase` does nothing to CJK;
 *   - `tracking-wider` pushes CJK glyphs apart, which costs width without aiding
 *     legibility (letter-spacing exists to separate visually similar Latin
 *     letterforms and to help all-caps run together less);
 *   - 11px CJK is noticeably harder to read than 11px Latin, because the glyphs
 *     carry more strokes per unit of area.
 *
 * For CJK locales the same label keeps its muted colour and weight but at a
 * readable size with normal spacing, so headers stay aligned with their columns.
 *
 * Usage:
 *   const labelClass = useLabelClass();
 *   <th className={cn("py-2 px-4 text-left text-nb-gray-400 font-medium", labelClass)}>
 */
export function useIsCjkLocale(): boolean {
  const { locale } = useLocale();
  return locale === "zh";
}

/**
 * The small-caps label classes for the active locale.
 *
 * Latin (unchanged from upstream): `text-[11px] uppercase tracking-wider`
 * CJK:                            `text-xs tracking-normal`
 */
export function useLabelClass(): string {
  return useIsCjkLocale()
    ? "text-xs tracking-normal"
    : "text-[11px] uppercase tracking-wider";
}
