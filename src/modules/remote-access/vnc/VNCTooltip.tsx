import FullTooltip from "@components/FullTooltip";
import { useTranslations } from "next-intl";
import * as React from "react";

type Props = {
  isOnline?: boolean;
  // isVNCEnabled is the whole NetBird path being usable: the client ships a
  // capturer for this system and the peer has the server switched on.
  isVNCEnabled?: boolean;
  // isNetBirdVNCSupported separates the two reasons it may not be, so the
  // tooltip does not tell someone to switch on a server their system has no
  // capturer for.
  isNetBirdVNCSupported?: boolean;
  children?: React.ReactNode;
  hasPermission?: boolean;
  side?: "top" | "right" | "bottom" | "left";
};
export const VNCTooltip = ({
  isOnline,
  isVNCEnabled,
  isNetBirdVNCSupported = true,
  children,
  hasPermission,
  side = "top",
}: Props) => {
  const t = useTranslations("vnc");
  // Still shown when NetBird screen sharing is off: the action works in that
  // case, so the tooltip is telling the operator which of the two servers
  // they are about to be offered rather than why they cannot proceed.
  const hideTooltip = isOnline && isVNCEnabled && hasPermission;

  return (
    <FullTooltip
      className={"w-full"}
      side={side}
      content={
        <div className={"max-w-xs text-xs flex flex-col gap-2"}>
          {!hasPermission ? (
            <div>{t("noPermissionTooltip")}</div>
          ) : !isOnline ? (
            <div>{t("peerOfflineTooltip")}</div>
          ) : !isNetBirdVNCSupported ? (
            <div>{t("unsupportedTooltip")}</div>
          ) : (
            <div>
              {t.rich("notEnabledTooltip", {
                code: (chunks) => <span className="font-mono">{chunks}</span>,
              })}
            </div>
          )}
        </div>
      }
      disabled={hideTooltip}
    >
      {children}
    </FullTooltip>
  );
};
