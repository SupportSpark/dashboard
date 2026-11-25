"use client";

import Button from "@components/Button";
import { cn } from "@utils/helpers";
import { useTranslations } from "next-intl";
import { AssistantIcon } from "@/assets/icons/AssistantIcon";
import { useAssistantSidebar } from "@/modules/assistant/AssistantSidebarProvider";

export function AssistantButton() {
  const { available, open, toggle } = useAssistantSidebar();
  const t = useTranslations("assistant");

  if (!available) return null;

  return (
    <Button
      size={"xs"}
      variant={"default"}
      onClick={toggle}
      aria-expanded={open}
      aria-label={open ? t("closeAssistantButton") : t("openAssistant")}
      className={cn(
        "h-[38px] px-3 text-[0.95rem]",
        open &&
          "!border-white !bg-white !text-nb-gray-950 hover:!bg-nb-gray-100",
      )}
    >
      <AssistantIcon size={16} />
      <span className="hidden sm:inline">{t("title")}</span>
    </Button>
  );
}

export default AssistantButton;
