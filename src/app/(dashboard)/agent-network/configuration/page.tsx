"use client";

import Breadcrumbs from "@components/Breadcrumbs";
import InlineLink from "@components/InlineLink";
import Paragraph from "@components/Paragraph";
import SkeletonTable from "@components/skeletons/SkeletonTable";
import { RestrictedAccess } from "@components/ui/RestrictedAccess";
import { VerticalTabs } from "@components/VerticalTabs";
import * as Tabs from "@radix-ui/react-tabs";
import { ExternalLinkIcon, Gauge, ScrollText, ServerIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import React, { lazy, Suspense, useMemo } from "react";
import AgentNetworkIcon from "@/assets/icons/AgentNetworkIcon";
import GroupsProvider from "@/contexts/GroupsProvider";
import PeersProvider from "@/contexts/PeersProvider";
import { usePermissions } from "@/contexts/PermissionsProvider";
import { REVERSE_PROXY_CLUSTERS_DOCS_LINK } from "@/interfaces/ReverseProxy";
import PageContainer from "@/layouts/PageContainer";
import { useAgentNetworkMode } from "@/modules/agent-network/useAgentNetworkMode";
import AgentAccountControlsCard from "@/modules/agent-network/AgentAccountControlsCard";
import AgentBudgetRulesTable from "@/modules/agent-network/AgentBudgetRulesTable";
import AIProvidersProvider from "@/modules/agent-network/AIProvidersProvider";

const ClustersTable = lazy(
  () => import("@/modules/reverse-proxy/clusters/ClustersTable"),
);

const TAB_BUDGET_SETTINGS = "budget-settings";
const TAB_LOG_SETTINGS = "log-settings";
const TAB_CLUSTERS = "clusters";

// AgentNetworkConfigurationPage holds the configuration surfaces extracted from
// Usage & Logs — global limits and log-collection controls — using the same
// vertical-tab layout (and per-tab breadcrumb/heading/description) as the main
// Settings page so it reads as "settings for the Agent Network".
export default function AgentNetworkConfigurationPage() {
  const { permission } = usePermissions();
  const { only: agentNetworkOnly } = useAgentNetworkMode();
  const queryParams = useSearchParams();
  const queryTab = queryParams.get("tab");
  const router = useRouter();
  const pathname = usePathname();
  const tAn = useTranslations("agentNetworkLabels");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("navigation");

  // Clusters is a reverse-proxy surface (its table and controls run on the
  // services permission), so it stays hidden from roles that only hold
  // agent_network.settings, e.g. agent_network_admin. Unknown ?tab= values
  // fall back to the first tab so a matching content pane always renders.
  const canReadClusters = !!permission?.services?.read;
  const selectableTabs = useMemo(() => {
    const tabs = new Set([TAB_BUDGET_SETTINGS, TAB_LOG_SETTINGS]);
    if (canReadClusters) tabs.add(TAB_CLUSTERS);
    return tabs;
  }, [canReadClusters]);

  // The ?tab= query is the single source of truth. Trigger clicks push it
  // themselves; onChange covers Radix's keyboard navigation, which fires
  // onValueChange without a click.
  const tab =
    queryTab && selectableTabs.has(queryTab) ? queryTab : TAB_BUDGET_SETTINGS;
  const onTabChange = (value: string) => {
    router.push(`${pathname}?tab=${value}`, { scroll: false });
  };

  return (
    <PageContainer>
      <VerticalTabs value={tab} onChange={onTabChange}>
        <VerticalTabs.List>
          <VerticalTabs.Trigger value={TAB_BUDGET_SETTINGS}>
            <Gauge size={14} />
            {tAn("globalLimitsTab")}
          </VerticalTabs.Trigger>
          <VerticalTabs.Trigger value={TAB_LOG_SETTINGS}>
            <ScrollText size={14} />
            {tAn("logCollectionTab")}
          </VerticalTabs.Trigger>
          {canReadClusters && (
            <VerticalTabs.Trigger value={TAB_CLUSTERS}>
              <ServerIcon size={14} />
              {tNav("clusters")}
            </VerticalTabs.Trigger>
          )}
        </VerticalTabs.List>
        <RestrictedAccess
          page={tAn("configurationPage")}
          hasAccess={permission?.["agent_network.settings"]?.read}
        >
          <GroupsProvider>
            <PeersProvider>
              <AIProvidersProvider>
                <div className={"border-l border-nb-gray-930 w-full"}>
                  <Tabs.Content
                    value={TAB_BUDGET_SETTINGS}
                    className={"w-full"}
                  >
                    <ConfigTabHeader
                      label={tAn("globalLimitsTab")}
                      href={"/agent-network/configuration?tab=budget-settings"}
                    >
                      {tAn("globalLimitsDescription")}
                    </ConfigTabHeader>
                    {/* DataTable applies its own p-default, so it is rendered
                        directly (no extra wrapper) to align with the header. */}
                    <Suspense fallback={<SkeletonTable />}>
                      <AgentBudgetRulesTable />
                    </Suspense>
                  </Tabs.Content>

                  <Tabs.Content value={TAB_LOG_SETTINGS} className={"w-full"}>
                    {/* Self-contained tab (own breadcrumb + heading + save),
                        mirroring the Settings > Authentication layout. */}
                    <Suspense fallback={<SkeletonTable />}>
                      <AgentAccountControlsCard />
                    </Suspense>
                  </Tabs.Content>

                  {canReadClusters && (
                    <Tabs.Content value={TAB_CLUSTERS} className={"w-full"}>
                      <ConfigTabHeader
                        label={tNav("clusters")}
                        href={"/agent-network/configuration?tab=clusters"}
                      >
                        {agentNetworkOnly
                          ? tAn("clustersDescriptionFocused")
                          : tAn("clustersDescriptionDefault")}{" "}
                        <InlineLink
                          href={REVERSE_PROXY_CLUSTERS_DOCS_LINK}
                          target={"_blank"}
                        >
                          {tCommon("learnMore")}
                          <ExternalLinkIcon size={12} />
                        </InlineLink>
                      </ConfigTabHeader>
                      <Suspense fallback={<SkeletonTable />}>
                        <ClustersTable />
                      </Suspense>
                    </Tabs.Content>
                  )}
                </div>
              </AIProvidersProvider>
            </PeersProvider>
          </GroupsProvider>
        </RestrictedAccess>
      </VerticalTabs>
    </PageContainer>
  );
}

// ConfigTabHeader mirrors the breadcrumb + heading + description block each
// Settings tab renders at the top of its content.
function ConfigTabHeader({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children?: React.ReactNode;
}) {
  const tNav = useTranslations("navigation");
  return (
    <div className={"p-default py-6"}>
      <Breadcrumbs>
        <Breadcrumbs.Item
          href={"/agent-network/providers"}
          label={tNav("agentNetwork")}
          icon={<AgentNetworkIcon size={16} />}
        />
        <Breadcrumbs.Item href={href} label={label} active />
      </Breadcrumbs>
      <h1>{label}</h1>
      {children && <Paragraph>{children}</Paragraph>}
    </div>
  );
}
