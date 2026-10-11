import * as React from "react";
import { ReverseProxy, ServiceMode } from "@/interfaces/ReverseProxy";
import Badge from "@components/Badge";
import { cn } from "@utils/helpers";
import { ArrowRightFromLineIcon, GlobeIcon, LockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  reverseProxy?: ReverseProxy;
  compact?: boolean;
};

export const ReverseProxyTypeCell = ({ reverseProxy, compact }: Props) => {
  const t = useTranslations("reverseProxy");

  // Protocol acronyms stay in English in both locales (see the i18n glossary);
  // only the TLS passthrough label is prose and comes from the catalog.
  const serviceModeLabel = reverseProxy?.mode
    ? {
        [ServiceMode.HTTP]: "HTTPS",
        [ServiceMode.TLS]: t("tlsPassthrough"),
        [ServiceMode.TCP]: "TCP",
        [ServiceMode.UDP]: "UDP",
      }[reverseProxy.mode]
    : "HTTPS";

  if (compact) {
    return <span className={"truncate"}>{serviceModeLabel}</span>;
  }

  return (
    <div className={"flex"}>
      <Badge variant={"gray"} className={"font-normal"}>
        {serviceModeLabel}
      </Badge>
    </div>
  );
};

type ReverseProxyServiceIconProps = {
  reverseProxy?: ReverseProxy;
  className?: string;
  size?: number;
};

export const ReverseProxyServiceIcon = ({
  reverseProxy,
  className,
  size = 14,
}: ReverseProxyServiceIconProps) => {
  const mode = reverseProxy?.mode;

  switch (mode) {
    case ServiceMode.HTTP:
      return <GlobeIcon size={size} className={cn("shrink-0", className)} />;
    case ServiceMode.TLS:
      return <LockKeyhole size={size} className={cn("shrink-0", className)} />;
    case ServiceMode.TCP:
      return (
        <ArrowRightFromLineIcon
          size={size}
          className={cn("shrink-0", className)}
        />
      );
    case ServiceMode.UDP:
      return (
        <ArrowRightFromLineIcon
          size={size}
          className={cn("shrink-0", className)}
        />
      );
    default:
      return <GlobeIcon size={size} className={cn("shrink-0", className)} />;
  }
};
