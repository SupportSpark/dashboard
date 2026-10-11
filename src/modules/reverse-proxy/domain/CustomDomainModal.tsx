import Button from "@components/Button";
import { Callout } from "@components/Callout";
import InlineLink from "@components/InlineLink";
import { Input } from "@components/Input";
import { Label } from "@components/Label";
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalFooter,
} from "@components/modal/Modal";
import ModalHeader from "@components/modal/ModalHeader";
import Paragraph from "@components/Paragraph";
import { validator } from "@utils/helpers";
import { ExternalLinkIcon, GlobeIcon, ServerIcon } from "lucide-react";
import * as React from "react";
import { useMemo, useState } from "react";
import { useReverseProxies } from "@/contexts/ReverseProxiesProvider";
import {
  REVERSE_PROXY_CLUSTERS_DOCS_LINK,
  REVERSE_PROXY_CUSTOM_DOMAINS_DOCS_LINK,
  ReverseProxyDomainType,
} from "@/interfaces/ReverseProxy";
import HelpText from "@components/HelpText";
import Separator from "@components/Separator";
import { isNetBirdCloud } from "@/utils/netbird";
import {
  SelectDropdown,
  SelectOption,
} from "@components/select/SelectDropdown";
import { useTranslations } from "next-intl";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDomainSubmit: (domain: string, targetCluster: string) => void;
};

export const CustomDomainModal = ({
  open,
  onOpenChange,
  onDomainSubmit,
}: Props) => {
  const t = useTranslations("reverseProxy");
  const tCommon = useTranslations("common");
  const { domains } = useReverseProxies();
  const [domain, setDomain] = useState("");
  const [selectedCluster, setSelectedCluster] = useState("");

  // Get available proxy clusters (free domains)
  const availableClusters = useMemo(() => {
    return domains?.filter((d) => d.type === ReverseProxyDomainType.FREE) || [];
  }, [domains]);

  // Auto-select first cluster if only one available
  React.useEffect(() => {
    if (availableClusters.length === 1 && !selectedCluster) {
      setSelectedCluster(availableClusters[0].domain);
    }
  }, [availableClusters, selectedCluster]);

  const error = useMemo(() => {
    if (!domain) return "";
    const isValid = validator.isValidDomain(domain, {
      allowWildcard: false,
      allowOnlyTld: false,
      preventLeadingAndTrailingDots: true,
    });
    if (!isValid) {
      return t("invalidTldDomain");
    }
    return "";
  }, [domain, t]);

  const isValidDomain = !error && domain.length > 0;
  const canSubmit = isValidDomain && selectedCluster;

  const addDomain = () => {
    if (canSubmit && domain && selectedCluster) {
      onDomainSubmit(domain, selectedCluster);
    }
  };

  const availableClusterOptions = availableClusters.map((cluster) => {
    return {
      label: cluster.domain,
      value: cluster.domain,
      icon: ServerIcon,
    } as SelectOption;
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent maxWidthClass={"relative max-w-lg"} showClose={true}>
        <ModalHeader
          icon={<GlobeIcon size={20} />}
          title={t("addCustomDomainTitle")}
          description={t("addCustomDomainDescription")}
          color={"netbird"}
        />

        <Separator />

        <div className={"px-8 flex flex-col gap-6 pt-6 pb-8"}>
          {availableClusters.length === 0 ? (
            isNetBirdCloud() ? (
              <Callout variant={"warning"}>
                {t.rich("noProxyClustersCloud", {
                  status: (chunks) => (
                    <InlineLink
                      href={"https://status.netbird.io/"}
                      target={"_blank"}
                    >
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
              <Callout variant="warning">
                {t.rich("noProxyClustersSelfHostedDomain", {
                  br: () => <br />,
                  link: (chunks) => (
                    <InlineLink
                      href={REVERSE_PROXY_CLUSTERS_DOCS_LINK}
                      target={"_blank"}
                    >
                      {chunks}
                      <ExternalLinkIcon size={12} />
                    </InlineLink>
                  ),
                })}
              </Callout>
            )
          ) : (
            <>
              <div>
                <Label>{t("domain")}</Label>
                <Input
                  autoFocus
                  value={domain}
                  onChange={(e) => setDomain(e.target.value.toLowerCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSubmit) {
                      addDomain();
                    }
                  }}
                  placeholder={t("companyDomainPlaceholder")}
                  error={error || undefined}
                  data-testid={"custom-domain-input"}
                />
              </div>

              <div data-testid={"custom-domain-cluster-selector"}>
                <Label>{t("targetProxyCluster")}</Label>
                <HelpText>{t("targetProxyClusterHelp")}</HelpText>
                <SelectDropdown
                  showSearch={false}
                  value={selectedCluster}
                  onChange={setSelectedCluster}
                  options={availableClusterOptions}
                  placeholder={t("selectProxyClusterPlaceholder")}
                />
              </div>
            </>
          )}
        </div>
        <ModalFooter className={"items-center"}>
          <div className={"w-full"}>
            <Paragraph className={"text-sm mt-auto"}>
              {tCommon("learnMoreAbout")}
              <InlineLink
                href={REVERSE_PROXY_CUSTOM_DOMAINS_DOCS_LINK}
                target={"_blank"}
              >
                {t("customDomains")}
                <ExternalLinkIcon size={12} />
              </InlineLink>
            </Paragraph>
          </div>
          <div className={"flex gap-3 w-full justify-end"}>
            <ModalClose asChild={true}>
              <Button variant={"secondary"}>{tCommon("cancel")}</Button>
            </ModalClose>

            <Button
              variant={"primary"}
              onClick={addDomain}
              disabled={!canSubmit}
              data-testid={"submit-custom-domain"}
            >
              {t("addDomainBtn")}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
