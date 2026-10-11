"use client";

import { cn } from "@utils/helpers";
import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

// StatusPicker — three-way radio that maps to the `connected` column.
//   undefined → All
//   true      → Online
//   false     → Offline
type Option = {
  value: boolean | undefined;
  label: string;
  dotClass: string;
};

type Props = {
  value: boolean | undefined;
  onChange: (next: boolean | undefined) => void;
  close: () => void;
};

export function StatusPicker({ value, onChange, close }: Props) {
  const t = useTranslations("common");
  const options: Option[] = [
    { value: undefined, label: t("all"), dotClass: "bg-nb-gray-500" },
    { value: true, label: t("online"), dotClass: "bg-green-500" },
    { value: false, label: t("offline"), dotClass: "bg-nb-gray-700" },
  ];

  return (
    <div className={"flex flex-col gap-0.5"}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.label}
            className={cn(
              "flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-colors",
              "text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white",
              selected && "text-white",
            )}
            onClick={() => {
              onChange(option.value);
              close();
            }}
          >
            <CheckIcon
              size={14}
              className={cn(
                "shrink-0 text-white",
                selected ? "opacity-100" : "opacity-0",
              )}
            />
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                option.dotClass,
              )}
            />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// formatChip helper exported for use in the filter def's formatChip().
// `translate` is optional so existing callers keep today's English output; pass
// the namespace-bound translator to localize the chip.
export function formatStatusChip(
  value: boolean | undefined,
  translate?: (key: string) => string,
): string | null {
  if (value === true) return translate?.("online") ?? "Online";
  if (value === false) return translate?.("offline") ?? "Offline";
  return null;
}
