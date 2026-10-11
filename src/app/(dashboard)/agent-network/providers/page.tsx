"use client";

import Breadcrumbs from "@components/Breadcrumbs";
import FeatureCard from "@components/FeatureCard";
import { HelpTooltip } from "@components/HelpTooltip";
import InlineLink from "@components/InlineLink";
import Paragraph from "@components/Paragraph";
import SkeletonTable from "@components/skeletons/SkeletonTable";
import { RestrictedAccess } from "@components/ui/RestrictedAccess";
import { usePortalElement } from "@hooks/usePortalElement";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { Suspense } from "react";
import AgentNetworkIcon from "@/assets/icons/AgentNetworkIcon";
import { usePermissions } from "@/contexts/PermissionsProvider";
import PageContainer from "@/layouts/PageContainer";
import AIProviderModal from "@/modules/agent-network/AIProviderModal";
import AIProvidersProvider, {
  useAIProviders,
} from "@/modules/agent-network/AIProvidersProvider";
import EndpointBadge, {
  endpointHelpText,
} from "@/modules/agent-network/EndpointBadge";
import AgentProvidersTable from "@/modules/agent-network/table/AgentProvidersTable";

function EndpointHeader() {
  const { settings, settingsLoading, openWizard } = useAIProviders();
  const { permission } = usePermissions();
  const t = useTranslations("agentNetwork");
  if (settingsLoading) return null;
  if (!settings) {
    // The bootstrap CTA opens the provider wizard, so only callers who can
    // actually connect a provider get it; read-only viewers (usage_viewer)
    // see nothing until an admin sets the endpoint up.
    if (!permission?.["agent_network.providers"]?.create) return null;
    return (
      <FeatureCard
        variant={"plain"}
        onClick={openWizard}
        className={
          "border-dashed bg-nb-gray-900/20 hover:border-nb-gray-700 hover:bg-nb-gray-900/40"
        }
        title={
          <>
            {t("apiBaseUrl")}
            <span onClick={(e) => e.stopPropagation()}>
              <HelpTooltip iconSize={11} content={endpointHelpText(t)} />
            </span>
          </>
        }
        description={t("connectFirstProviderDescription")}
      />
    );
  }
  return <EndpointBadge endpoint={settings.endpoint} variant={"plain"} />;
}

function PageBody({
  headingTarget,
}: {
  headingTarget: HTMLHeadingElement | null;
}) {
  const { isWizardOpen, closeWizard } = useAIProviders();

  return (
    <>
      <Suspense fallback={<SkeletonTable />}>
        <AgentProvidersTable headingTarget={headingTarget} />
      </Suspense>
      <AIProviderModal open={isWizardOpen} onOpenChange={closeWizard} />
    </>
  );
}

export default function AgentNetworkProvidersPage() {
  const { permission } = usePermissions();
  const t = useTranslations("agentNetwork");
  const tCommon = useTranslations("common");
  const tnav = useTranslations("navigation");
  const { ref: headingRef, portalTarget } =
    usePortalElement<HTMLHeadingElement>();

  return (
    <PageContainer>
      {/* Gate the whole surface: AIProvidersProvider and EndpointHeader fetch
          agent-network state, so they must not mount for users without
          read on the providers submodule. */}
      <RestrictedAccess
        page={t("providers")}
        hasAccess={permission?.["agent_network.providers"]?.read}
      >
        <AIProvidersProvider>
          <div className={"p-default py-6"}>
            <Breadcrumbs>
              <Breadcrumbs.Item
                href={"/agent-network/providers"}
                label={tnav("agentNetwork")}
                icon={<AgentNetworkIcon size={16} />}
              />
              <Breadcrumbs.Item
                href={"/agent-network/providers"}
                label={t("providers")}
                active={true}
              />
            </Breadcrumbs>
            <h1 ref={headingRef}>{t("providers")}</h1>
            <Paragraph>
              {t("providersPageDescription")}
              <InlineLink
                href={"https://docs.netbird.io/agent-network/providers"}
                target={"_blank"}
              >
                {tCommon("learnMore")}
                <ExternalLinkIcon size={12} />
              </InlineLink>
            </Paragraph>
            {/* Same 24px step the users and activity pages put between their
                description and the card below it. */}
            <div className={"mt-6"}>
              <EndpointHeader />
            </div>
          </div>

          <PageBody headingTarget={portalTarget} />
        </AIProvidersProvider>
      </RestrictedAccess>
    </PageContainer>
  );
}
