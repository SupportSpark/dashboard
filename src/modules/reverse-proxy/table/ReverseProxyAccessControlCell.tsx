import Badge from "@components/Badge";
import Button from "@components/Button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@components/HoverCard";
import {
  FlagIcon,
  LucideIcon,
  NetworkIcon,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  WorkflowIcon,
} from "lucide-react";
import * as React from "react";
import { useMemo } from "react";
import { useCountries } from "@/contexts/CountryProvider";
import { usePermissions } from "@/contexts/PermissionsProvider";
import { useReverseProxies } from "@/contexts/ReverseProxiesProvider";
import { CrowdSecMode, ReverseProxy } from "@/interfaces/ReverseProxy";
import { useTranslations } from "next-intl";

type RuleEntry = {
  key: string;
  label: string;
  Icon: LucideIcon;
  value: string;
  blocked?: boolean;
};

type Props = {
  reverseProxy: ReverseProxy;
};

export default function ReverseProxyAccessControlCell({
  reverseProxy,
}: Readonly<Props>) {
  const t = useTranslations("common");
  const tr = useTranslations("reverseProxy");

  const { permission } = usePermissions();
  const { openModal, domains } = useReverseProxies();
  const { countries } = useCountries();

  const canConfigure = !!permission?.services?.update;
  const restrictions = reverseProxy.access_restrictions;

  const supportsCrowdSec = domains?.find(
    (d) => d.domain === reverseProxy.proxy_cluster,
  )?.supports_crowdsec;

  const hasCrowdSec =
    supportsCrowdSec &&
    restrictions?.crowdsec_mode != null &&
    restrictions.crowdsec_mode !== CrowdSecMode.OFF;

  const ruleCount =
    (restrictions?.allowed_cidrs?.length ?? 0) +
    (restrictions?.blocked_cidrs?.length ?? 0) +
    (restrictions?.allowed_countries?.length ?? 0) +
    (restrictions?.blocked_countries?.length ?? 0) +
    (hasCrowdSec ? 1 : 0);

  const rulesBadge = (
    <Badge
      variant={"gray"}
      disabled={!canConfigure}
      className={
        "cursor-pointer !rounded-r-none !border-r-0 !h-[34px] !px-2 min-w-[50px] hover:bg-nb-gray-930 transition-all"
      }
    >
      {ruleCount > 0 ? (
        <ShieldCheck size={12} className="text-green-500" />
      ) : (
        <ShieldOff size={12} className="text-red-500" />
      )}
      <span className={"font-medium text-xs"}>{ruleCount}</span>
    </Badge>
  );

  const ruleGroups = useMemo(() => {
    const getCountryName = (code: string) => {
      const country = countries?.find((c) => c.country_code === code);
      return country?.country_name ?? code;
    };

    const entries: RuleEntry[] = [];

    if (restrictions?.allowed_countries?.length) {
      entries.push({
        key: "allowed-countries",
        label: tr("allowedCountries", {
          count: restrictions.allowed_countries.length,
        }),
        Icon: FlagIcon,
        value: restrictions.allowed_countries.map(getCountryName).join(", "),
      });
    }

    if (restrictions?.blocked_countries?.length) {
      entries.push({
        key: "blocked-countries",
        label: tr("blockedCountries", {
          count: restrictions.blocked_countries.length,
        }),
        Icon: FlagIcon,
        value: restrictions.blocked_countries.map(getCountryName).join(", "),
        blocked: true,
      });
    }

    const allowedIps =
      restrictions?.allowed_cidrs?.filter((c) => c.endsWith("/32")) ?? [];
    const allowedCidrs =
      restrictions?.allowed_cidrs?.filter((c) => !c.endsWith("/32")) ?? [];
    const blockedIps =
      restrictions?.blocked_cidrs?.filter((c) => c.endsWith("/32")) ?? [];
    const blockedCidrs =
      restrictions?.blocked_cidrs?.filter((c) => !c.endsWith("/32")) ?? [];

    if (allowedIps.length) {
      entries.push({
        key: "allowed-ips",
        label: tr("allowedIps", { count: allowedIps.length }),
        Icon: WorkflowIcon,
        value: allowedIps.map((c) => c.replace(/\/32$/, "")).join(", "),
      });
    }

    if (allowedCidrs.length) {
      entries.push({
        key: "allowed-cidrs",
        label: tr("allowedCidrs", { count: allowedCidrs.length }),
        Icon: NetworkIcon,
        value: allowedCidrs.join(", "),
      });
    }

    if (blockedIps.length) {
      entries.push({
        key: "blocked-ips",
        label: tr("blockedIps", { count: blockedIps.length }),
        Icon: WorkflowIcon,
        value: blockedIps.map((c) => c.replace(/\/32$/, "")).join(", "),
        blocked: true,
      });
    }

    if (blockedCidrs.length) {
      entries.push({
        key: "blocked-cidrs",
        label: tr("blockedCidrs", { count: blockedCidrs.length }),
        Icon: NetworkIcon,
        value: blockedCidrs.join(", "),
        blocked: true,
      });
    }

    if (hasCrowdSec) {
      entries.push({
        key: "crowdsec",
        // CrowdSec is a product name and stays as-is in both locales.
        label: "CrowdSec",
        Icon: ShieldAlert,
        value:
          restrictions?.crowdsec_mode === CrowdSecMode.ENFORCE
            ? tr("crowdSecModeEnforce")
            : tr("crowdSecModeObserve"),
      });
    }

    return entries;
  }, [restrictions, countries, hasCrowdSec, tr, t]);

  const showRulesHover = ruleGroups.length > 0;

  return (
    <div
      className={"flex"}
      data-access-control-cell
      onClick={(e) => {
        e.stopPropagation();
        if (permission?.services?.update) {
          openModal({ proxy: reverseProxy, initialTab: "access-control" });
        }
      }}
    >
      <div className={"flex items-center"}>
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild={true}>{rulesBadge}</HoverCardTrigger>
          {showRulesHover && (
            <HoverCardContent
              className={"p-0"}
              sideOffset={14}
              onClick={(e) => e.stopPropagation()}
            >
                <div className={"text-xs"}>
                  {ruleGroups.map(({ key, label, Icon, value, blocked }) => (
                    <div
                      key={key}
                      className={
                        "flex justify-between gap-12 py-2 px-4 border-b border-nb-gray-920 last:border-b-0"
                      }
                    >
                      <div
                        className={
                          "flex items-start gap-2 font-medium whitespace-nowrap text-nb-gray-100 pt-0.5"
                        }
                      >
                        <Icon
                          size={14}
                          className={
                            blocked ? "text-red-500" : "text-green-500"
                          }
                        />
                        {label}
                      </div>
                      <div
                        className={"max-w-[200px] text-nb-gray-300 text-right"}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
            </HoverCardContent>
          )}
        </HoverCard>
        <Button
          size={"xs"}
          variant={"secondary"}
          className={"!rounded-l-none !px-2 !h-[34px]"}
          onClick={(e) => {
            e.stopPropagation();
            openModal({ proxy: reverseProxy, initialTab: "access-control" });
          }}
          disabled={!permission?.services?.update}
          aria-label={t("configureAccessControl")}
        >
          <Settings size={12} />
        </Button>
      </div>
    </div>
  );
}
