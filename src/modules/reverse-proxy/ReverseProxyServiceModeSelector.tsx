import React, { ReactNode, useEffect, useMemo } from "react";
import {
  isL4Mode as isL4ServiceMode,
  type ReverseProxyDomain,
  ServiceMode,
} from "@/interfaces/ReverseProxy";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/Select";
import { ArrowRightFromLine, Globe, LockKeyhole } from "lucide-react";
import { HelpTooltip } from "@components/HelpTooltip";
import { Label } from "@components/Label";
import HelpText from "@components/HelpText";
import { useTranslations } from "next-intl";

type Props = {
  value?: ServiceMode;
  onChange: (value: ServiceMode) => void;
  disabled?: boolean;
  domain?: ReverseProxyDomain;
};

type ServiceModeConfig = {
  label: string;
  description: string;
  icon: ReactNode;
};

/**
 * Labels for each service mode. Kept as a translator-driven hook so the
 * strings stay in the reverseProxy catalog; `ReverseProxyTypeCell` renders
 * the bare protocol name from `serviceModeShortLabel`.
 */
export const useServiceModes = (
  t: ReturnType<typeof useTranslations<"reverseProxy">>,
): Record<ServiceMode, ServiceModeConfig> =>
  useMemo(
    () => ({
      [ServiceMode.HTTP]: {
        label: t("httpsService"),
        description: t("httpsServiceDescription"),
        icon: <Globe size={14} />,
      },
      [ServiceMode.TLS]: {
        label: t("tlsPassthrough"),
        description: t("tlsPassthroughDescription"),
        icon: <LockKeyhole size={14} />,
      },
      [ServiceMode.TCP]: {
        label: t("tcpService"),
        description: t("tcpServiceDescription"),
        icon: <ArrowRightFromLine size={14} />,
      },
      [ServiceMode.UDP]: {
        label: t("udpService"),
        description: t("udpServiceDescription"),
        icon: <ArrowRightFromLine size={14} />,
      },
    }),
    [t],
  );

export const ReverseProxyServiceModeSelector = ({
  value,
  onChange,
  disabled,
  domain,
}: Props) => {
  const t = useTranslations("reverseProxy");
  const serviceModes = useServiceModes(t);
  const selected = value ?? ServiceMode.HTTP;
  const selectedMode = serviceModes[selected];
  const isL4Supported = domain?.supports_custom_ports !== undefined;

  // Reset to HTTP if the current L4 mode becomes unsupported (e.g. domain changed)
  useEffect(() => {
    if (!isL4Supported && isL4ServiceMode(selected)) {
      onChange(ServiceMode.HTTP);
    }
  }, [isL4Supported, selected, onChange]);

  return (
    <div className="flex justify-between items-center gap-10 mt-2">
      <div>
        <Label>{t("serviceTypeLabel")}</Label>
        <HelpText>{t("serviceTypeHelp")}</HelpText>
      </div>
      <Select
        value={selected}
        onValueChange={(v) => onChange(v as ServiceMode)}
        disabled={disabled}
      >
        <SelectTrigger className="max-w-[240px] min-w-[200px]">
          <div
            className={"flex items-center gap-2 whitespace-nowrap"}
            data-testid={"service-mode-select-button"}
          >
            {selectedMode.icon}
            <SelectValue placeholder={t("selectTypePlaceholder")} />
          </div>
        </SelectTrigger>
        <SelectContent data-testid={"service-mode-selection"}>
          {Object.entries(serviceModes)
            .filter(
              ([mode]) =>
                isL4Supported || !isL4ServiceMode(mode as ServiceMode),
            )
            .map(([mode, config]) => (
              <SelectItem
                key={mode}
                value={mode}
                data-testid={`service-mode-option-${mode}`}
                extra={
                  <HelpTooltip
                    triggerClassName={"ml-[0.01rem]"}
                    align={"center"}
                    side={"right"}
                    content={<>{config.description}</>}
                  />
                }
              >
                <span className="whitespace-nowrap">{config.label}</span>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
};
