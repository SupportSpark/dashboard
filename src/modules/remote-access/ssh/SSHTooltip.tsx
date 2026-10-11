import FullTooltip from "@components/FullTooltip";
import InlineLink from "@components/InlineLink";
import { ArrowUpRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useState } from "react";
import { usePeer } from "@/contexts/PeerProvider";

type Props = {
  children?: React.ReactNode;
  hasPermission: boolean;
  isOnline?: boolean;
  isSSHEnabled?: boolean;
  side?: "top" | "right" | "bottom" | "left";
};
export const SSHTooltip = ({
  children,
  hasPermission,
  isOnline,
  isSSHEnabled,
  side = "top",
}: Props) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const tooltipContent = () => {
    if (!hasPermission) {
      return <NoPermissionText />;
    }
    if (!isSSHEnabled) {
      return <SSHDisabledText setShowTooltip={setShowTooltip} />;
    }
    if (!isOnline) {
      return <IsOfflineText />;
    }
    return null;
  };

  return (
    <FullTooltip
      customOpen={showTooltip}
      customOnOpenChange={setShowTooltip}
      className={"w-full"}
      side={side}
      content={tooltipContent()}
      disabled={isOnline && isSSHEnabled && hasPermission}
    >
      {children}
    </FullTooltip>
  );
};

const NoPermissionText = () => {
  const t = useTranslations("remoteAccessWave4");
  return (
    <div className={"max-w-xs text-xs flex flex-col gap-2"}>
      <div>{t("sshNoPermissionTooltip")}</div>
    </div>
  );
};

const IsOfflineText = () => {
  const t = useTranslations("remoteAccessWave4");
  return (
    <div className={"max-w-[200px] text-xs"}>
      <div>{t("sshOfflineTooltip")}</div>
    </div>
  );
};

const SSHDisabledText = ({
  setShowTooltip,
}: {
  setShowTooltip: (show: boolean) => void;
}) => {
  const { setSSHInstructionsModal } = usePeer();
  const t = useTranslations("remoteAccessWave4");
  const tPeers = useTranslations("peers");

  return (
    <div className={"max-w-xs text-xs flex flex-col gap-2"}>
      <div>{t("sshDisabledTooltip")}</div>
      <div>
        <InlineLink
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowTooltip(false);
            setSSHInstructionsModal(true);
          }}
          href={"#"}
          target={"_blank"}
        >
          {tPeers("enableSSH")} <ArrowUpRightIcon size={12} />
        </InlineLink>
      </div>
    </div>
  );
};
