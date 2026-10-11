import { notify } from "@components/Notification";
import { SkeletonIntegration } from "@components/skeletons/SkeletonIntegration";
import useFetchApi, { useApiCall } from "@utils/api";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useState } from "react";
import { useSWRConfig } from "swr";
import integrationImage from "@/assets/integrations/datadog.png";
import { useDialog } from "@/contexts/DialogProvider";
import { usePermissions } from "@/contexts/PermissionsProvider";
import { useIsLicensed } from "@/hooks/useIsLicensed";
import { EventStream } from "@/interfaces/EventStream";
import DatadogSetup from "@/modules/integrations/event-streaming/datadog/DatadogSetup";
import { IntegrationCard } from "@/modules/integrations/IntegrationCard";

export default function Datadog() {
  const t = useTranslations("integrations");
  const tCommon = useTranslations("common");
  const tPeers = useTranslations("peers");
  const { permission } = usePermissions();
  // Event Streaming is a licensed feature; skip the call on open-source.
  const { isLicensed } = useIsLicensed();

  const { mutate } = useSWRConfig();
  const { data: eventStreamIntegrations, isLoading } = useFetchApi<
    EventStream[]
  >(
    "/integrations/event-streaming",
    false,
    false,
    permission.event_streaming.read && isLicensed,
  );

  const dataDogSettings = eventStreamIntegrations?.find(
    (integration) => integration.platform === "datadog",
  );

  const isOtherIntegrationEnabled = eventStreamIntegrations?.some(
    (integration) => integration.enabled && integration.platform !== "datadog",
  );

  const integrationRequest = useApiCall<EventStream>(
    "/integrations/event-streaming",
  );

  const [setupModal, setSetupModal] = useState(false);
  const { confirm } = useDialog();

  const toggleSwitch = async () => {
    if (!dataDogSettings) return setSetupModal(true);

    const choice = await confirm({
      title: t("disconnectIntegrationTitle", { name: "Datadog" }),
      description: t("disconnectConfirmDescription"),
      confirmText: tPeers("disconnect"),
      cancelText: tCommon("cancel"),
      type: "warning",
    });
    if (!choice) return;

    notify({
      title: t("integrationLinkText", { name: "Datadog" }),
      description: t("integrationWasDisconnected", { name: "Datadog" }),
      promise: integrationRequest.del({}, "/" + dataDogSettings.id).then(() => {
        mutate("/integrations/event-streaming");
      }),
      loadingMessage: t("disconnectingIntegration"),
    });
  };

  return isLoading ? (
    <SkeletonIntegration />
  ) : (
    <>
      <IntegrationCard
        name="Datadog"
        description={t("datadogDescription")}
        url={{
          title: "datadoghq.com",
          href: "https://www.datadoghq.com/",
        }}
        image={integrationImage}
        data={dataDogSettings}
        switchState={!dataDogSettings ? false : dataDogSettings.enabled}
        disabled={
          dataDogSettings?.enabled
            ? !permission.event_streaming.update
            : isOtherIntegrationEnabled || !permission.event_streaming.create
        }
        onEnabledChange={toggleSwitch}
        onSetup={() => setSetupModal(true)}
      ></IntegrationCard>
      <DatadogSetup open={setupModal} onOpenChange={setSetupModal} />
    </>
  );
}
