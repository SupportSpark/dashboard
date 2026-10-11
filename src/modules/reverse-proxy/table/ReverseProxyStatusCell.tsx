import {
  REVERSE_PROXY_TROUBLESHOOTING_DOCS_LINK,
  ReverseProxy,
  ReverseProxyMeta,
  ReverseProxyStatus,
} from "@/interfaces/ReverseProxy";
import useFetchApi from "@utils/api";
import Badge from "@components/Badge";
import FullTooltip from "@components/FullTooltip";
import InlineLink from "@components/InlineLink";
import { CircleAlert, Loader2 } from "lucide-react";
import * as React from "react";
import { useRef } from "react";
import { useTranslations } from "next-intl";

type Props = {
  serviceId: string;
  meta?: ReverseProxyMeta;
  enabled?: boolean;
  isL4?: boolean;
  compact?: boolean;
  // Rendered when the service is fully active (no setup/cert/error badge to
  // show). Lets callers swap in another piece of UI (e.g. the cluster badge)
  // in the same slot once the cell would otherwise be empty.
  readyFallback?: React.ReactNode;
};

const POLL_INTERVAL_MS = 3500;

export default function ReverseProxyStatusCell({
  serviceId,
  meta,
  enabled,
  isL4,
  compact,
  readyFallback,
}: Readonly<Props>) {
  const t = useTranslations("reverseProxy");
  const tCommon = useTranslations("common");
  const dataRef = useRef<ReverseProxy | undefined>(undefined);

  const isActive =
    meta?.status === ReverseProxyStatus.ACTIVE ||
    dataRef.current?.meta?.status === ReverseProxyStatus.ACTIVE;

  const hasError =
    meta?.status === ReverseProxyStatus.ERROR ||
    dataRef.current?.meta?.status === ReverseProxyStatus.ERROR;

  const isTunnelNotCreated =
    meta?.status === ReverseProxyStatus.TUNNEL_NOT_CREATED ||
    dataRef.current?.meta?.status === ReverseProxyStatus.TUNNEL_NOT_CREATED;

  const certificateIssued =
    !!meta?.certificate_issued_at ||
    !!dataRef.current?.meta?.certificate_issued_at;

  const shouldPoll = !!enabled && !(isActive && (isL4 || certificateIssued));

  const { data } = useFetchApi<ReverseProxy>(
    `/reverse-proxies/services/${serviceId}`,
    true,
    false,
    shouldPoll,
    { refreshInterval: POLL_INTERVAL_MS },
  );

  dataRef.current = data;

  if (!enabled) return <>{readyFallback ?? null}</>;

  // L4 services don't need certificates
  if (isL4) {
    if (isActive) return <>{readyFallback ?? null}</>;
    if (hasError) {
      return (
        <div className={"flex"} data-status-cell>
          <FullTooltip
            content={
              <div className={"text-xs max-w-xs"}>
                {t.rich("serviceSetupErrorHelp", {
                  link: (chunks) => (
                    <InlineLink
                      href={REVERSE_PROXY_TROUBLESHOOTING_DOCS_LINK}
                      target={"_blank"}
                    >
                      {chunks}
                    </InlineLink>
                  ),
                })}
              </div>
            }
            align={"center"}
            alignOffset={0}
          >
            <div className={"flex"}>
              {compact ? (
                <span className={"text-red-400 cursor-help truncate"}>
                  {tCommon("error")}
                </span>
              ) : (
                <Badge variant={"red"}>
                  <CircleAlert size={11} />
                  {tCommon("error")}
                </Badge>
              )}
            </div>
          </FullTooltip>
        </div>
      );
    }
    if (isTunnelNotCreated) {
      return (
        <div className={"flex"} data-status-cell>
          <FullTooltip
            content={
              <div className={"text-xs max-w-xs"}>
                {t.rich("tunnelNotCreatedHelp", {
                  link: (chunks) => (
                    <InlineLink
                      href={REVERSE_PROXY_TROUBLESHOOTING_DOCS_LINK}
                      target={"_blank"}
                    >
                      {chunks}
                    </InlineLink>
                  ),
                })}
              </div>
            }
            align={"center"}
            alignOffset={0}
          >
            <div className={"flex"}>
              {compact ? (
                <span className={"text-red-400 cursor-help truncate"}>
                  {t("tunnelNotCreated")}
                </span>
              ) : (
                <Badge variant={"red"}>
                  <CircleAlert size={11} />
                  {t("tunnelNotCreated")}
                </Badge>
              )}
            </div>
          </FullTooltip>
        </div>
      );
    }
    return <SettingUpService compact={compact} />;
  }

  // HTTP services: hide once active with certificate issued
  if (isActive && certificateIssued) {
    return <>{readyFallback ?? <div data-status-cell />}</>;
  }

  if (!certificateIssued) {
    return (
      <div className={"flex"} data-status-cell>
        {compact ? (
          <span
            className={"inline-flex items-center gap-1.5 text-yellow-400 truncate"}
          >
            <Loader2 size={11} className={"animate-spin shrink-0"} />
            {t("issuingCertificate")}
          </span>
        ) : (
          <Badge variant={"yellow"}>
            <Loader2 size={12} className={"animate-spin"} />
            {t("issuingCertificate")}
          </Badge>
        )}
      </div>
    );
  }

  return <SettingUpService compact={compact} />;
}

const SettingUpService = ({ compact }: { compact?: boolean }) => {
  const t = useTranslations("reverseProxy");
  return (
    <div className={"flex"} data-status-cell>
      {compact ? (
        <span
          className={"inline-flex items-center gap-1.5 text-yellow-400 truncate"}
        >
          <Loader2 size={11} className={"animate-spin shrink-0"} />
          {t("settingUpService")}
        </span>
      ) : (
        <Badge variant={"yellow"}>
          <Loader2 size={14} className={"animate-spin"} />
          {t("settingUpService")}
        </Badge>
      )}
    </div>
  );
};
