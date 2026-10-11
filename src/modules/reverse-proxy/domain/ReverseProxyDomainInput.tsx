import HelpText from "@components/HelpText";
import { Input } from "@components/Input";
import { Label } from "@components/Label";
import { Callout } from "@components/Callout";
import React from "react";
import { CustomDomainSelector } from "./CustomDomainSelector";
import { isNetBirdCloud } from "@utils/netbird";
import InlineLink from "@components/InlineLink";
import { useTranslations } from "next-intl";

type Props = {
  subdomain: string;
  onSubdomainChange: (value: string) => void;
  baseDomain: string;
  onBaseDomainChange: (value: string) => void;
  domainAlreadyExists: boolean;
  subdomainRequired?: boolean;
  clusterOffline?: {
    clusterName: string;
  };
};

export default function ReverseProxyDomainInput({
  subdomain,
  onSubdomainChange,
  baseDomain,
  onBaseDomainChange,
  domainAlreadyExists,
  subdomainRequired = false,
  clusterOffline,
}: Readonly<Props>) {
  const t = useTranslations("reverseProxy");
  return (
    <div>
      <Label>{t("domain")}</Label>
      <HelpText>
        {subdomainRequired
          ? t("subdomainRequiredHelp")
          : t("subdomainOptionalHelp")}
      </HelpText>
      <div className="flex items-start mt-2">
        <div className="flex-1 min-w-0">
          <Input
            autoFocus
            data-testid="proxy-subdomain-input"
            value={subdomain}
            onChange={(e) => {
              onSubdomainChange(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              );
            }}
            error={
              domainAlreadyExists ? t("domainAlreadyUsed") : undefined
            }
            placeholder={
              subdomainRequired
                ? t("subdomainPlaceholder")
                : t("subdomainOptionalPlaceholder")
            }
            className="!rounded-r-none !border-r-0"
          />
        </div>
        <div className="flex-1 min-w-0">
          <CustomDomainSelector
            value={baseDomain}
            onChange={onBaseDomainChange}
            className="!rounded-l-none"
            data-testid="proxy-domain-selector"
          />
        </div>
      </div>

      {clusterOffline &&
        (isNetBirdCloud() ? (
          <Callout variant={"warning"} className={"mt-3"}>
            {t.rich("clusterOfflineCloud", {
              cluster: clusterOffline.clusterName,
              status: (chunks) => (
                <InlineLink href={"https://status.netbird.io/"} target={"_blank"}>
                  {chunks}
                </InlineLink>
              ),
              support: (chunks) => (
                <InlineLink href={"mailto:support@netbird.io"}>
                  {chunks}
                </InlineLink>
              ),
            })}
          </Callout>
        ) : (
          <Callout variant={"error"} className={"mt-3"}>
            {t("clusterOfflineSelfHosted", {
              cluster: clusterOffline.clusterName,
            })}
          </Callout>
        ))}
    </div>
  );
}
