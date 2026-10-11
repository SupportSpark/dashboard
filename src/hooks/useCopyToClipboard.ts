import { notify } from "@components/Notification";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

export default function useCopyToClipboard(textToCopy?: string) {
  const t = useTranslations("common");
  const tCopy = useTranslations("serviceUsers");
  const wrapper = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const copyToClipboard = async (
    description = t("textCopiedToClipboard"),
  ) => {
    const copy = textToCopy ? textToCopy : wrapper.current?.innerText;
    if (!copy) return;
    try {
      await navigator.clipboard.writeText(copy);
      setCopied(true);

      notify({
        title: tCopy("copySuccess"),
        description: description,
      });

      const timeout = setTimeout(() => {
        setCopied(false);
        clearTimeout(timeout);
      }, 400);
    } catch (err) {
      return;
    }
  };

  return [wrapper, copyToClipboard, copied] as const;
}
