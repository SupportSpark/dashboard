import Button from "@components/Button";
import HelpText from "@components/HelpText";
import { Input } from "@components/Input";
import { JSONFileUpload } from "@components/JSONFileUpload";
import { Label } from "@components/Label";
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalFooter,
} from "@components/modal/Modal";
import { notify } from "@components/Notification";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/Tabs";
import { GradientFadedBackground } from "@components/ui/GradientFadedBackground";
import { useHasChanges } from "@hooks/useHasChanges";
import { useApiCall } from "@utils/api";
import { cn } from "@utils/helpers";
import { trim } from "lodash";
import {
  AlertOctagon,
  Box,
  Cog,
  FolderGit2,
  KeyRound,
  RefreshCw,
  UserCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useState } from "react";
import { useSWRConfig } from "swr";
import integrationImage from "@/assets/integrations/google-workspace.png";
import { useDialog } from "@/contexts/DialogProvider";
import { GoogleWorkspaceIntegration } from "@/interfaces/IdentityProvider";
import { EmbeddedIdentityProviderSelect } from "@/modules/integrations/idp-sync/EmbeddedIdentityProviderSelect";
import { GroupPrefixHelpText } from "@/modules/integrations/idp-sync/GroupPrefixHelpText";
import { GroupPrefixInput } from "@/modules/integrations/idp-sync/GroupPrefixInput";
import { useIntegrations } from "@/modules/integrations/idp-sync/useIntegrations";
import { IntegrationModalHeader } from "@/modules/integrations/IntegrationModalHeader";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export default function GoogleWorkspaceConfiguration({
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const { google } = useIntegrations();

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange} key={open ? 1 : 0}>
        {google && (
          <ConfigurationContent
            onSuccess={() => {
              onOpenChange(false);
              onSuccess && onSuccess();
            }}
            config={google}
          />
        )}
      </Modal>
    </>
  );
}

type ModalProps = {
  onSuccess: () => void;
  config: GoogleWorkspaceIntegration;
};

export function ConfigurationContent({ onSuccess, config }: ModalProps) {
  const t = useTranslations("idpSync");
  const tWave = useTranslations("integrationsWave2");
  const tCommon = useTranslations("common");
  const { mutate } = useSWRConfig();
  const { confirm } = useDialog();

  const [tab, setTab] = useState<string>("settings");

  const googleRequest = useApiCall<GoogleWorkspaceIntegration>(
    "/integrations/google-idp",
  );

  const accountKeyPlaceholder = "******************************";
  const [serviceAccountKey, setServiceAccountKey] = useState(
    accountKeyPlaceholder,
  );

  const [customerID, setCustomerID] = useState(config.customer_id);
  const [interval, setInterval] = useState(config.sync_interval.toString());

  const [connectorId, setConnectorId] = useState(config.connector_id || "");
  const [groupPrefixes, setGroupPrefixes] = useState<string[]>(
    config.group_prefixes || [],
  );
  const [userGroupPrefixes, setUserGroupPrefixes] = useState<string[]>(
    config.user_group_prefixes || [],
  );

  const deleteIntegration = async () => {
    const choice = await confirm({
      title: t("deleteIntegrationQuestion"),
      description: t("deleteIntegrationDescription"),
      confirmText: tCommon("delete"),
      cancelText: tCommon("cancel"),
      type: "danger",
    });

    if (!choice) return;

    notify({
      title: t("googleWorkspaceIntegrationTitle"),
      description: t("googleWorkspaceWasDeleted"),
      promise: googleRequest.del({}, `/${config.id}`).then(() => {
        mutate("/integrations/google-idp");
        onSuccess();
      }),
      loadingMessage: t("deletingIntegration"),
    });
  };

  const updateIntegration = async () => {
    notify({
      title: t("googleWorkspaceIntegrationTitle"),
      description: t("googleWorkspaceWasUpdated"),
      promise: googleRequest
        .put(
          {
            customer_id: customerID,
            service_account_key:
              accountKeyPlaceholder == serviceAccountKey
                ? undefined
                : serviceAccountKey,
            sync_interval: interval ? parseInt(interval) : 300,
            group_prefixes: groupPrefixes
              ? groupPrefixes.filter((prefix) => trim(prefix) !== "")
              : [],
            user_group_prefixes: userGroupPrefixes
              ? userGroupPrefixes.filter((prefix) => trim(prefix) !== "")
              : [],
            ...(connectorId ? { connector_id: connectorId } : {}),
          },
          `/${config.id}`,
        )
        .then(() => {
          mutate("/integrations/google-idp");
          onSuccess();
        }),
      loadingMessage: t("updatingIntegration"),
    });
  };

  const { hasChanges } = useHasChanges([
    customerID,
    serviceAccountKey,
    interval,
    connectorId,
    groupPrefixes,
    userGroupPrefixes,
  ]);

  return (
    <ModalContent
      maxWidthClass={cn("relative max-w-xl")}
      showClose={true}
      className={""}
      autoFocus={false}
    >
      <GradientFadedBackground />

      <IntegrationModalHeader
        image={integrationImage}
        title={t("googleWorkspaceConfigurationTitle")}
        description={t("googleWorkspaceSyncDescription")}
      />

      <Tabs
        defaultValue={tab}
        onValueChange={(v) => setTab(v)}
        className={"mt-6"}
      >
        <TabsList justify={"start"} className={"px-8"}>
          <TabsTrigger value={"settings"}>
            <Cog
              size={16}
              className={
                "text-nb-gray-500 group-data-[state=active]/trigger:text-netbird transition-all"
              }
            />
            {tCommon("settings")}
          </TabsTrigger>
          <TabsTrigger value={"group-sync"}>
            <FolderGit2
              size={16}
              className={
                "text-nb-gray-500 group-data-[state=active]/trigger:text-netbird transition-all"
              }
            />
            {t("groupSync")}
          </TabsTrigger>
          <TabsTrigger value={"user-sync"}>
            <UserCircle
              size={16}
              className={
                "text-nb-gray-500 group-data-[state=active]/trigger:text-netbird transition-all"
              }
            />
            {t("userSync")}
          </TabsTrigger>
          <TabsTrigger value={"danger"}>
            <AlertOctagon
              size={16}
              className={
                "text-nb-gray-500 group-data-[state=active]/trigger:text-netbird transition-all"
              }
            />
            {t("dangerZone")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={"settings"} className={"px-8 text-sm"}>
          <div className={"flex-col gap-3 flex"}>
            <Input
              type={"text"}
              autoCorrect={"off"}
              autoComplete={"off"}
              className={"w-full"}
              customPrefix={
                <div className={"min-w-[165px] flex gap-2 items-center"}>
                  <Box size={16} />
                  {t("customerId")}
                </div>
              }
              placeholder={"62d3a656-c87d-4f30-a242-5b6347e29e9f"}
              value={customerID}
              onChange={(e) => setCustomerID(e.target.value)}
            />

            <Input
              autoCorrect={"off"}
              type={"text"}
              className={"w-full"}
              customPrefix={
                <div className={"min-w-[165px] flex gap-2 items-center"}>
                  <KeyRound size={16} />
                  {tWave("serviceAccountKeyLabel")}
                </div>
              }
              placeholder={"YdV7Q~JJ62Xl.LvYoBanxZR2sJA2va_3UbqvncY8"}
              value={serviceAccountKey}
              readOnly={true}
            />

            <JSONFileUpload
              value={serviceAccountKey}
              onChange={(val) => setServiceAccountKey(btoa(val))}
            />

            <div className={"flex justify-between mt-4"}>
              <div>
                <Label>{t("syncInterval")}</Label>
                <HelpText className={"max-w-[300px]"}>
                  {t("syncIntervalHelp")}
                </HelpText>
              </div>
              <Input
                maxWidthClass={"max-w-[400px]"}
                placeholder={"300"}
                min={1}
                max={99999}
                value={interval}
                type={"number"}
                onChange={(e) => setInterval(e.target.value)}
                customPrefix={
                  <RefreshCw size={16} className={"text-nb-gray-300"} />
                }
                customSuffix={t("secondsSuffix")}
              />
            </div>
            <EmbeddedIdentityProviderSelect
              value={connectorId}
              onChange={setConnectorId}
              location="settings"
            />
          </div>
        </TabsContent>

        <TabsContent value={"group-sync"} className={"px-8"}>
          <div>
            <Label>
              <div className={"flex gap-2 items-center"}>
                <FolderGit2 size={16} />
                {t("synchronizeGroups")}
              </div>
            </Label>
            <GroupPrefixHelpText />
          </div>
          <GroupPrefixInput value={groupPrefixes} onChange={setGroupPrefixes} />
        </TabsContent>

        <TabsContent value={"user-sync"} className={"px-8"}>
          <div>
            <Label>
              <div className={"flex gap-2 items-center"}>
                <UserCircle size={16} />
                {t("synchronizeUsers")}
              </div>
            </Label>
            <GroupPrefixHelpText type={"user-groups"} />
          </div>
          <GroupPrefixInput
            addText={t("addUserGroupFilter")}
            text={t("userGroupStartsWith")}
            value={userGroupPrefixes}
            onChange={setUserGroupPrefixes}
          />
        </TabsContent>

        <TabsContent value={"danger"} className={"px-8"}>
          <div>
            <Label>
              <div className={"flex gap-2 items-center"}>
                <AlertOctagon size={16} />
                {t("deleteIntegration")}
              </div>
            </Label>
            <HelpText className={"max-w-lg mt-2"}>
              {t("deleteIntegrationHelp")}
            </HelpText>
          </div>
          <Button
            variant={"danger"}
            size={"xs"}
            className={"mt-3"}
            onClick={deleteIntegration}
          >
            {t("deleteIntegration")}
          </Button>
        </TabsContent>
      </Tabs>
      <div className={"h-6"}></div>

      <ModalFooter className={"items-center gap-4"}>
        <ModalClose asChild={true}>
          <Button variant={"secondary"} className={"w-full"}>
            {tCommon("cancel")}
          </Button>
        </ModalClose>

        <Button
          variant={"primary"}
          className={"w-full"}
          disabled={!hasChanges}
          onClick={updateIntegration}
        >
          {tCommon("save")}
        </Button>
      </ModalFooter>
    </ModalContent>
  );
}
