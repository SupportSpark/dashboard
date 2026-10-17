import Badge from "@components/Badge";
import FullTooltip from "@components/FullTooltip";
import {
  Braces,
  Flag,
  GlobeOff,
  Link2,
  LockOpen,
  Network,
  ShieldAlert,
  ShieldOff,
  ShieldX,
  Users,
} from "lucide-react";
import * as React from "react";
import { ReverseProxyEvent } from "@/interfaces/ReverseProxy";
import { useTranslations } from "next-intl";

type Props = {
  event: ReverseProxyEvent;
  compact?: boolean;
};

export const ReverseProxyEventsAuthMethodCell = ({
  event,
  compact = false,
}: Props) => {
  const t = useTranslations("reverseProxy");
  const authMethod = event.auth_method_used;

  if (!authMethod) {
    if (compact) return null;
    return <span className="text-nb-gray-400 text-sm px-3 py-2">-</span>;
  }

  const getAuthMethodDisplay = () => {
    switch (authMethod.toLowerCase()) {
      case "oidc":
      case "sso":
      case "bearer":
        return {
          icon: <Users size={12} />,
          label: "SSO",
        };
      case "password":
        return {
          icon: (
            <span
              className={
                "font-mono text-[9px] font-medium tracking-wider leading-none px-1 py-0.5 rounded border border-current"
              }
            >
              PWD
            </span>
          ),
          label: t("password"),
        };
      case "pin":
        return {
          icon: (
            <span
              className={
                "font-mono text-[9px] font-medium tracking-wider leading-none px-1 py-0.5 rounded border border-current"
              }
            >
              PIN
            </span>
          ),
          label: t("pinCode"),
        };
      case "header":
        return {
          icon: <Braces size={12} />,
          label: t("httpHeaders"),
        };
      case "link":
      case "magic_link":
      case "magic-link":
        return {
          icon: <Link2 size={12} />,
          label: t("authMagicLink"),
        };
      case "ip_restricted":
        return {
          icon: <Network size={12} />,
          label: t("authIpRestricted"),
        };
      case "country_restricted":
        return {
          icon: <Flag size={12} />,
          label: t("authCountryRestricted"),
        };
      case "geo_unavailable":
        return {
          icon: <GlobeOff size={12} />,
          label: t("authGeoUnavailable"),
        };
      case "path_bypass":
        return {
          icon: <LockOpen size={12} />,
          label: t("authBypassed"),
        };
      case "path_block":
        return {
          icon: <ShieldX size={12} />,
          label: t("pathBlocked"),
        };
      case "crowdsec_ban":
        return {
          icon: <ShieldAlert size={12} />,
          label: t("authCrowdSecBan"),
        };
      case "crowdsec_captcha":
        return {
          icon: <ShieldAlert size={12} />,
          label: t("authCrowdSecCaptcha"),
        };
      case "crowdsec_throttle":
        return {
          icon: <ShieldAlert size={12} />,
          label: t("authCrowdSecThrottle"),
        };
      case "crowdsec_unavailable":
        return {
          icon: <ShieldOff size={12} />,
          label: t("authCrowdSecUnavailable"),
        };
      default:
        return {
          icon: null,
          label: authMethod,
        };
    }
  };

  const { icon, label } = getAuthMethodDisplay();

  if (compact) {
    return (
      <FullTooltip
        interactive={false}
        content={
          <span className={"text-xs"}>
            <span className={"text-nb-gray-400"}>{t("authTooltipPrefix")}</span>
            <span className={"text-nb-gray-100"}>{label}</span>
          </span>
        }
      >
        <span
          className={
            "inline-flex items-center justify-center text-nb-gray-300 cursor-help"
          }
        >
          {icon}
        </span>
      </FullTooltip>
    );
  }

  return (
    <div className="px-3 py-2">
      <Badge variant="gray" className="gap-1.5">
        {icon}
        {label}
      </Badge>
    </div>
  );
};
