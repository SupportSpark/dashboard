import FullTooltip from "@components/FullTooltip";
import { useTranslations } from "next-intl";
import * as React from "react";

type Props = {
  disabled?: boolean;
  children?: React.ReactNode;
  hasPermission?: boolean;
  side?: "top" | "right" | "bottom" | "left";
};
export const RDPTooltip = ({
  disabled,
  children,
  hasPermission,
  side = "top",
}: Props) => {
  const t = useTranslations("remoteAccessWave4");
  return (
    <FullTooltip
      className={"w-full"}
      side={side}
      content={
        <div className={"max-w-xs text-xs flex flex-col gap-2"}>
          {hasPermission ? (
            <div>{t("rdpOfflineTooltip")}</div>
          ) : (
            <div>{t("rdpNoPermissionTooltip")}</div>
          )}
        </div>
      }
      disabled={disabled}
    >
      {children}
    </FullTooltip>
  );
};
