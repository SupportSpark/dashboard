import FullTooltip from "@components/FullTooltip";
import { PowerOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { SetupKey } from "@/interfaces/SetupKey";

type Props = {
  setupKey: SetupKey;
};
export default function SetupKeyStatusCell({ setupKey }: Readonly<Props>) {
  return (
    <div className={"flex items-center gap-1.5"}>
      {setupKey?.ephemeral && <Ephemeral />}
      {setupKey?.allow_extra_dns_labels && <AllowExtraDNSLabels />}
    </div>
  );
}

export const AllowExtraDNSLabels = () => {
  const t = useTranslations("setupKeys");
  return (
    <FullTooltip
      interactive={false}
      content={
        <div className="max-w-xs text-xs">{t("allowExtraDnsLabelsTooltip")}</div>
      }
    >
      <span
        className={
          "font-mono text-[9px] font-medium tracking-wider leading-none px-1 py-0.5 rounded border border-nb-gray-700 text-nb-gray-300 cursor-help"
        }
      >
        DNS
      </span>
    </FullTooltip>
  );
};

export const Ephemeral = () => {
  const t = useTranslations("setupKeys");
  return (
    <FullTooltip
      interactive={false}
      content={
        <div className={"max-w-xs text-xs"}>{t("ephemeralPeersHelp")}</div>
      }
    >
      <PowerOffIcon
        size={12}
        className={"shrink-0 text-yellow-400 cursor-help"}
      />
    </FullTooltip>
  );
};
