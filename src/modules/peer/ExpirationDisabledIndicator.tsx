import FullTooltip from "@components/FullTooltip";
import { TimerResetIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Peer } from "@/interfaces/Peer";

type Props = {
  peer: Peer;
};
export const ExpirationDisabledIndicator = ({ peer }: Props) => {
  const t = useTranslations("peers");

  if (peer.login_expiration_enabled) {
    return null;
  }

  const tooltipContent = t("expirationDisabledPeerTooltip");

  return (
    <FullTooltip
      content={<div className={"text-xs max-w-xs"}>{tooltipContent}</div>}
    >
      <TimerResetIcon size={14} className={"shrink-0 text-nb-gray-300"} />
    </FullTooltip>
  );
};
