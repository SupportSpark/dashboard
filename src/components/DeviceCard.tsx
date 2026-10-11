import TruncatedText from "@components/ui/TruncatedText";
import { cn } from "@utils/helpers";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useMemo } from "react";
import RoundedFlag from "@/assets/countries/RoundedFlag";
import { PeerOSIcon } from "@/assets/icons/PeerOSIcon";
import { ResourceIcon } from "@/assets/icons/ResourceIcon";
import { useIsCjkLocale } from "@/hooks/useIsCjkLocale";
import { NetworkResource } from "@/interfaces/Network";
import type { Peer } from "@/interfaces/Peer";

type DeviceCardProps = {
  device?: Peer;
  resource?: NetworkResource;
  className?: string;
  address?: string;
  description?: string;
};

export const DeviceCard = ({
  device,
  resource,
  className,
  address,
  description,
}: DeviceCardProps) => {
  const t = useTranslations("common");
  const isCjkLocale = useIsCjkLocale();

  // Every hook runs before the early return below: `useMemo` used to sit after
  // it, so the hook order changed between renders as soon as this component was
  // mounted with no device and later with one.
  const descriptionText = useMemo(() => {
    return description !== undefined
      ? description
      : address || device?.ip || resource?.address;
  }, [description, address, device, resource]);

  if (!device && !resource) return null;

  return (
    <div
      className={cn(
        // w-[230px] fits an English hostname in the ~156px left after the 36px
        // icon tile, its gap and the padding. Chinese is the wider of the two
        // languages at the same size and cannot break at word boundaries, so the
        // same box truncates it. CJK locales get a wider card.
        isCjkLocale ? "w-[268px]" : "w-[230px]",
        "flex shrink-0 items-center gap-2.5 text-nb-gray-200 text-left py-1 pl-3 pr-4 rounded-md group/machine my-0",
        !descriptionText && "py-2",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-md h-9 w-9 shrink-0 bg-nb-gray-900 transition-all",
          "group-hover:bg-nb-gray-800 relative",
        )}
      >
        {device ? (
          <PeerOSIcon os={device.os} />
        ) : resource?.type ? (
          <ResourceIcon type={resource.type} />
        ) : null}

        {device?.country_code && (
          <div className={"absolute -bottom-[4px] -right-[4px]"}>
            <div
              className={cn(
                "flex items-center justify-center rounded-full border-[3px] shrink-0",
                "border-nb-gray-940",
              )}
            >
              <RoundedFlag country={device?.country_code} size={10} />
            </div>
          </div>
        )}
      </div>
      <div
        className={
          "flex flex-col gap-0 justify-center top-[0.15rem] leading-tight relative"
        }
      >
        <span
          className={
            "font-normal text-[0.85rem] text-nb-gray-100 flex items-center gap-2"
          }
        >
          <TruncatedText
            text={device?.name || resource?.name || t("unknown")}
            maxWidth={"150px"}
            hideTooltip={true}
          />
        </span>
        {descriptionText && (
          <span
            className={
              "text-sm font-normal text-nb-gray-400 relative whitespace-nowrap"
            }
          >
            <TruncatedText text={descriptionText} maxWidth={"160px"} />
          </span>
        )}
      </div>
    </div>
  );
};
