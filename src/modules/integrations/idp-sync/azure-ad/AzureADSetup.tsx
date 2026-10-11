import Button from "@components/Button";
import InlineLink from "@components/InlineLink";
import { Input } from "@components/Input";
import { Modal, ModalContent, ModalFooter } from "@components/modal/Modal";
import { notify } from "@components/Notification";
import Steps from "@components/Steps";
import { GradientFadedBackground } from "@components/ui/GradientFadedBackground";
import { Lightbox } from "@components/ui/Lightbox";
import { Mark } from "@components/ui/Mark";
import { MinimalList } from "@components/ui/MinimalList";
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { useApiCall } from "@utils/api";
import { cn } from "@utils/helpers";
import { isEmpty, trim } from "lodash";
import {
  Box,
  Clock4,
  Folder,
  FolderGit2,
  KeyRound,
  PlusCircle,
  Repeat,
  Settings2,
  Shield,
  UserCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useState } from "react";
import { useEmbeddedIdentityProviders } from "@/hooks/useEmbeddedIdentityProviders";
import { useSWRConfig } from "swr";
import integrationImage from "@/assets/integrations/entra-id.png";
import { AzureADIntegration } from "@/interfaces/IdentityProvider";
import azureGrantAdmin from "@/modules/integrations/idp-sync/azure-ad/images/azure-grant-admin-conset.png";
import { EmbeddedIdentityProviderSelect } from "@/modules/integrations/idp-sync/EmbeddedIdentityProviderSelect";
import { GroupPrefixHelpText } from "@/modules/integrations/idp-sync/GroupPrefixHelpText";
import { IntegrationModalHeader } from "@/modules/integrations/IntegrationModalHeader";
import { GroupPrefixInput } from "../GroupPrefixInput";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export default function AzureADSetup({ open, onOpenChange, onSuccess }: Props) {
  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange} key={open ? 1 : 0}>
        <SetupContent
          onSuccess={() => {
            onOpenChange(false);
            onSuccess && onSuccess();
          }}
        />
      </Modal>
    </>
  );
}

type ModalProps = {
  onSuccess: () => void;
};

export function SetupContent({ onSuccess }: ModalProps) {
  const t = useTranslations("idpSync");
  const tCommon = useTranslations("common");
  const { mutate } = useSWRConfig();
  const azureRequest = useApiCall<AzureADIntegration>(
    "/integrations/azure-idp",
  );

  const { isEmbeddedIdPEnabled } = useEmbeddedIdentityProviders();
  const [step, setStep] = useState(isEmbeddedIdPEnabled ? -1 : 0);
  const maxSteps = 6;

  const [clientSecret, setClientSecret] = useState("");
  const [clientId, setClientId] = useState("");
  const [tenantId, setTenantId] = useState("");

  const clientSecretEntered = !isEmpty(clientSecret);
  const clientIdEntered = !isEmpty(clientId);
  const tenantIdEntered = !isEmpty(tenantId);

  const allEntered = clientIdEntered && tenantIdEntered && clientSecretEntered;

  const isDisabled =
    (step == 3 && !clientSecretEntered) ||
    (step == 4 && (!clientIdEntered || !tenantIdEntered)) ||
    (step == maxSteps && !allEntered);

  const [connectorId, setConnectorId] = useState("");
  const [groupPrefixes, setGroupPrefixes] = useState<string[]>([]);
  const [userGroupPrefixes, setUserGroupPrefixes] = useState<string[]>([]);

  const connect = async () => {
    notify({
      title: t("entraIdIntegrationTitle"),
      description: t("entraIdWasConnected"),
      promise: azureRequest
        .post({
          client_secret: btoa(clientSecret), // Encode client secret to base64
          client_id: clientId,
          tenant_id: tenantId,
          group_prefixes: groupPrefixes
            ? groupPrefixes.filter((prefix) => trim(prefix) !== "")
            : [],
          user_group_prefixes: userGroupPrefixes
            ? userGroupPrefixes.filter((prefix) => trim(prefix) !== "")
            : [],
          ...(connectorId ? { connector_id: connectorId } : {}),
        })
        .then(() => {
          mutate("/integrations/azure-idp");
          onSuccess();
        }),
      loadingMessage: t("settingUpIntegration"),
    });
  };

  return (
    <ModalContent
      maxWidthClass={cn(
        "relative",
        step == 0 ? "max-w-md" : "max-w-xl",
        step === -1 && "max-w-lg",
      )}
      showClose={true}
      className={""}
      onEscapeKeyDown={(e) => step > 0 && e.preventDefault()}
      onInteractOutside={(e) => step > 0 && e.preventDefault()}
      onPointerDownOutside={(e) => step > 0 && e.preventDefault()}
    >
      <GradientFadedBackground />

      {step > 0 && (
        <div className={"flex gap-2 w-full items-center justify-center mb-4"}>
          {Array.from({ length: maxSteps }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-8 h-1 rounded-full bg-nb-gray-800",
                step >= index + 1 && "bg-netbird",
              )}
            />
          ))}
        </div>
      )}

      <IntegrationModalHeader
        image={integrationImage}
        title={t("connectNetBirdWith", { name: "Entra ID (API)" })}
        description={t("entraIdStartSyncDescription")}
      />

      {step === -1 && (
        <EmbeddedIdentityProviderSelect
          value={connectorId}
          onChange={setConnectorId}
          location="setup"
          filterByType={["entra"]}
        />
      )}

      {step == 0 && (
        <div
          className={
            "px-8 py-3 flex z-0 flex-col gap-0 text-sm mb-3 text-center justify-center items-center"
          }
        >
          <div
            className={
              "mt-6 text-base font-medium text-nb-gray-100 flex gap-2 items-center justify-center"
            }
          >
            <Shield size={16} />
            {t("requiredPermissions")}
          </div>
          <p className={"mt-2 !text-nb-gray-300 !leading-[1.5]"}>
            {t.rich("entraIdPermissionsIntro", {
              accent: (chunks) => (
                <span className={"text-nb-gray-100 font-semibold"}>
                  {chunks}
                </span>
              ),
            })}
          </p>
          <div
            className={
              "flex items-center flex-col gap-0 mt-2 w-full justify-center max-w-lg"
            }
          >
            <div
              className={
                "py-2 px-6 flex items-center gap-2 rounded-md w-full justify-center bg-nb-gray-930/0 text-nb-gray-200"
              }
            >
              <PlusCircle size={14} className={"text-sky-500"} />
              {t("createAzureAdApplications")}
            </div>
            <div
              className={
                "py-2 px-6 flex items-center gap-2 rounded-md w-full justify-center bg-nb-gray-930/0 text-nb-gray-200"
              }
            >
              <Settings2 size={14} className={"text-sky-500"} />
              {t("manageAzureAdApplications")}
            </div>
          </div>
        </div>
      )}

      {step == 1 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <Box size={20} />
            {t("entraIdCreateAppTitle")}
          </p>
          <Steps>
            <Steps.Step step={1}>
              <p>
                {t.rich("entraIdNavigateToAzureAd", {
                  link: (chunks) => (
                    <InlineLink
                      className={"inline"}
                      target={"_blank"}
                      href={
                        "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Overview"
                      }
                    >
                      {chunks}
                    </InlineLink>
                  ),
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={2}>
              <p className={"font-normal"}>
                {t.rich("entraIdAppRegistrationsStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={3} line={false}>
              <p className={"font-normal"}>
                {t.rich("entraIdFillFormStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
          </Steps>

          <MinimalList
            data={[
              {
                label: tCommon("name"),
                value: "NetBird",
              },
              {
                label: t("accountTypesLabel"),
                value: t("entraIdFormAccountTypesValue"),
              },
              {
                label: t("redirectTypeLabel"),
                value: t("singlePageApplicationSpa"),
              },
              {
                label: t("redirectUriLabel"),
                value: "https://app.netbird.io/silent-auth",
              },
            ]}
          />
        </div>
      )}

      {step == 2 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <Shield size={20} />
            {t("entraIdAddPermissionsTitle")}
          </p>
          <Steps>
            <Steps.Step step={1}>
              <p className={"font-normal"}>
                {t.rich("entraIdApiPermissionsStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={2}>
              <p className={"font-normal"}>
                {t.rich("entraIdAddPermissionStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={3}>
              <p className={"font-normal"}>
                {t.rich("entraIdSelectPermissionsStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={4} line={false}>
              <p className={"font-normal"}>
                {t.rich("entraIdGrantConsentStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
              <Lightbox image={azureGrantAdmin} />
            </Steps.Step>
          </Steps>
        </div>
      )}

      {step == 3 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <KeyRound size={20} />
            {t("entraIdGenerateSecretTitle")}
          </p>
          <Steps>
            <Steps.Step step={1}>
              <p className={"font-normal"}>
                {t.rich("entraIdCertificatesStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={2}>
              <p className={"font-normal"}>
                {t.rich("entraIdNewSecretStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={3}>
              <p className={"font-normal"}>
                {t.rich("entraIdAddDescriptionStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                  copy: (chunks) => <Mark copy>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={4} line={false}>
              <p className={"font-normal"}>
                {t.rich("entraIdCopyValueStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
          </Steps>
          <div className={"mb-4"}>
            <Input
              type={"text"}
              className={"w-full"}
              customPrefix={
                <div className={"flex items-center gap-2"}>
                  <KeyRound size={16} className={"text-nb-gray-300"} />
                </div>
              }
              placeholder={"YdV7Q~JJ62Xl.LvYoBanxZR2sJA2va_3UbqvncY8"}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
        </div>
      )}

      {step == 4 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <Box size={20} />
            {t("entraIdEnterIdsTitle")}
          </p>
          <Steps>
            <Steps.Step step={1}>
              <p className={"font-normal"}>
                {t.rich("entraIdAllApplicationsStep", {
                  link: (chunks) => (
                    <InlineLink
                      target={"_blank"}
                      className={"inline"}
                      href={
                        "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps"
                      }
                    >
                      {chunks}
                    </InlineLink>
                  ),
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={2} line={false}>
              <p className={"font-normal"}>
                {t.rich("entraIdSelectAppStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
          </Steps>
          <div className={"mb-4 flex flex-col gap-3"}>
            <Input
              type={"text"}
              className={"w-full"}
              customPrefix={
                <div className={"min-w-[165px] flex gap-2 items-center"}>
                  <Box size={16} />
                  {t("applicationClientIdLabel")}
                </div>
              }
              placeholder={"62d3a656-c87d-4f30-a242-5b6347e29e9f"}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <Input
              type={"text"}
              className={"w-full"}
              customPrefix={
                <div className={"min-w-[165px] flex gap-2 items-center"}>
                  <Folder size={16} />
                  {t("directoryTenantIdLabel")}
                </div>
              }
              placeholder={"5d60468a-65b7-45eb-a61a-53ecfbcd1ea3"}
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            />
          </div>
        </div>
      )}

      {step == 5 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <FolderGit2 size={20} />
            {t("groupsToBeSynchronized")}
          </p>

          <div className={"mb-4 flex flex-col gap-1"}>
            <div>
              <GroupPrefixHelpText />
            </div>
            <GroupPrefixInput
              value={groupPrefixes}
              onChange={setGroupPrefixes}
            />
          </div>
        </div>
      )}

      {step == 6 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <UserCircle size={18} />
            {t("usersToBeSynchronized")}
          </p>

          <div className={"mb-4 flex flex-col gap-1"}>
            <div>
              <GroupPrefixHelpText type={"user-groups"} />
            </div>

            <GroupPrefixInput
              addText={t("addUserGroupFilter")}
              text={t("userGroupStartsWith")}
              value={userGroupPrefixes}
              onChange={setUserGroupPrefixes}
            />
          </div>
        </div>
      )}

      <ModalFooter className={"items-center gap-4"}>
        {step === -1 && (
          <Button
            variant={"primary"}
            className={"w-full"}
            onClick={() => setStep(step + 1)}
            disabled={!connectorId || connectorId === ""}
          >
            {tCommon("continue")}
            <IconArrowRight size={16} />
          </Button>
        )}
        {step > 0 && (
          <Button
            variant={"secondary"}
            className={"w-full"}
            onClick={() => setStep(step - 1)}
          >
            <IconArrowLeft size={16} />
            {tCommon("back")}
          </Button>
        )}
        {step >= 0 && step < maxSteps && (
          <Button
            variant={"primary"}
            className={"w-full"}
            disabled={isDisabled}
            onClick={() => setStep(step + 1)}
          >
            {step == 0 ? t("getStarted") : tCommon("continue")}
            <IconArrowRight size={16} />
          </Button>
        )}
        {step == maxSteps && (
          <Button
            variant={"primary"}
            className={"w-full"}
            disabled={isDisabled}
            onClick={connect}
          >
            <Repeat size={16} />
            {t("connect")}
          </Button>
        )}
      </ModalFooter>
      {(step == 0 || step == -1) && (
        <div
          className={
            "text-center z-0 mt-2.5 text-xs text-nb-gray-300 flex items-center justify-center gap-2 font-normal"
          }
        >
          <Clock4 size={12} />
          <div>
            {t("estimatedSetupTime")}
            <span className={"font-medium"}>
              {" "}
              {t("setupDuration", { duration: "10-20" })}
            </span>
          </div>
        </div>
      )}
    </ModalContent>
  );
}
