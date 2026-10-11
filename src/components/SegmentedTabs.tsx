import { TabContext, useTabContext } from "@components/Tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { cn } from "@utils/helpers";
import React from "react";

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  // "automatic" activates a tab on focus; use "manual" when onChange drives
  // side effects that must not fire on hover or focus.
  activationMode?: "automatic" | "manual";
  children: React.ReactNode;
};
function SegmentedTabs({
  value,
  onChange,
  activationMode = "automatic",
  children,
}: Props) {
  return (
    <TabContext.Provider value={value || ""}>
      <Tabs
        activationMode={activationMode}
        onValueChange={(value) => onChange && onChange(value)}
        value={value}
      >
        {children}
      </Tabs>
    </TabContext.Provider>
  );
}

function List({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsList
      className={cn(
        "bg-nb-gray-930/70 p-1.5 rounded-t-lg flex justify-center gap-1 border border-b-0 border-nb-gray-900",
        className,
      )}
    >
      {children}
    </TabsList>
  );
}

/**
 * Trigger.
 *
 * `w-full` is deliberately NOT applied here. The trigger's parent is a flex
 * `TabsList` that sizes itself to its content, so `w-full` resolved to the
 * LIST's width and every trigger claimed all of it. With three or four of them
 * the only way to satisfy four full-width requests was to stretch the list
 * across the page — visible as a tab bar spanning the whole header.
 *
 * Nothing rendered wrong while the labels were short English words, because the
 * list still collapsed to its content: the browser had no reason to grow it. The
 * longer Chinese labels (节点/用户/组/网络) pushed it past the available space, and
 * `nowrap` stopped the labels from wrapping to absorb the overflow, so the
 * stretch showed up. Callers that genuinely want equal-width triggers — a
 * dropdown-style segmented control — can still pass `w-full` themselves.
 */
function Trigger({
  children,
  value,
  disabled = false,
  className,
  "data-testid": dataTestId,
}: {
  children: React.ReactNode;
  value: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}) {
  const currentValue = useTabContext();
  return (
    <TabsTrigger
      disabled={disabled}
      data-testid={dataTestId}
      className={cn(
        "px-4 py-2 text-sm rounded-md transition-all data-[disabled]:opacity-50",
        value == currentValue
          ? "bg-nb-gray-900"
          : disabled
          ? "data-[disabled]:text-nb-gray-400"
          : "text-nb-gray-400 hover:bg-nb-gray-900/50",
        className,
      )}
      value={value}
    >
      <div className={"flex items-center justify-center gap-2"}>
        {children}
      </div>
    </TabsTrigger>
  );
}

function Content({
  children,
  value,
}: {
  children: React.ReactNode;
  value: string;
}) {
  return (
    <TabsContent
      value={value}
      className={
        "bg-nb-gray-930/70 px-4 pt-2 pb-5 rounded-b-md mt-0 border border-t-0  border-nb-gray-900"
      }
    >
      {children}
    </TabsContent>
  );
}

SegmentedTabs.List = List;
SegmentedTabs.Trigger = Trigger;
SegmentedTabs.Content = Content;

export { SegmentedTabs };
