import FullTooltip from "@components/FullTooltip";
import { PowerOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Peer } from "@/interfaces/Peer";

type Props = {
  peer: Peer;
};
export const EphemeralPeerIndicator = ({ peer }: Props) => {
  const t = useTranslations("peers");

  if (!peer.ephemeral) {
    return null;
  }

  const tooltipContent = t("ephemeralPeerTooltip");

  return (
    <FullTooltip
      content={<div className={"text-xs max-w-xs"}>{tooltipContent}</div>}
    >
      <PowerOffIcon size={12} className={"shrink-0 text-yellow-400"} />
    </FullTooltip>
  );
};
