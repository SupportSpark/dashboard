import Button from "@components/Button";
import InlineLink from "@components/InlineLink";
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalFooter,
} from "@components/modal/Modal";
import Steps from "@components/Steps";
import { GradientFadedBackground } from "@components/ui/GradientFadedBackground";
import { Lightbox } from "@components/ui/Lightbox";
import { Mark } from "@components/ui/Mark";
import { MinimalList } from "@components/ui/MinimalList";
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { useApiCall } from "@utils/api";
import { cn } from "@utils/helpers";
import { isEmpty } from "lodash";
import {
  Box,
  Clock4,
  FolderGit2,
  LogInIcon,
  MailIcon,
  PlusCircle,
  Settings2,
  Share2,
  Shield,
  UserCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useEffect, useState } from "react";
import { useEmbeddedIdentityProviders } from "@/hooks/useEmbeddedIdentityProviders";
import integrationImage from "@/assets/integrations/okta.png";
import { OktaIntegration } from "@/interfaces/IdentityProvider";
import oktaGroupsAssignments from "@/modules/integrations/idp-sync/okta-scim/images/okta-groups-assignments.png";
import oktaSCIMToApp from "@/modules/integrations/idp-sync/okta-scim/images/okta-scim-to-app-sync-enabled.png";
import oktaSSO from "@/modules/integrations/idp-sync/okta-scim/images/okta-sso-configuration.png";
import oktaSyncGroups from "@/modules/integrations/idp-sync/okta-scim/images/okta-sync-groups.png";
import { EmbeddedIdentityProviderSelect } from "@/modules/integrations/idp-sync/EmbeddedIdentityProviderSelect";
import { IntegrationModalHeader } from "@/modules/integrations/IntegrationModalHeader";
import { useEnterpriseConnections } from "@/modules/integrations/sso/useEnterpriseConnections";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export default function OktaSetup({ open, onOpenChange, onSuccess }: Props) {
  const [authToken, setAuthToken] = useState("");
  const [connectorId, setConnectorId] = useState("");
  const { oktaConnection } = useEnterpriseConnections();

  const integrationsRequest = useApiCall<OktaIntegration[]>(
    "/integrations/okta-scim-idp",
  );

  const authTokenRequest = useApiCall<OktaIntegration>(
    "/integrations/okta-scim-idp",
    true,
  ).post;

  useEffect(() => {
    if (!open) return;
    if (!oktaConnection) return;
    const getAuthToken = async () => {
      const integration = await integrationsRequest.get();
      if (!isEmpty(integration)) {
        const integrationId = integration[0].id;
        if (authToken != "") return authToken;
        const okta = await authTokenRequest(
          {
            connection_name: oktaConnection.name,
          },
          `/${integrationId}/token`,
        );
        if (!okta) return "";
        return okta.auth_token;
      } else {
        const okta = await authTokenRequest({
          connection_name: oktaConnection.name,
          ...(connectorId ? { connector_id: connectorId } : {}),
        });
        if (!okta) return "";
        return okta.auth_token;
      }
    };

    getAuthToken().then((t) => setAuthToken(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      {open && (
        <SetupContent
          authToken={authToken}
          connectorId={connectorId}
          onConnectorIdChange={setConnectorId}
          onSuccess={() => {
            onOpenChange(false);
            onSuccess && onSuccess();
          }}
        />
      )}
    </Modal>
  );
}

type ModalProps = {
  onSuccess: () => void;
  authToken: string;
  connectorId?: string;
  onConnectorIdChange?: (value: string) => void;
};

export function SetupContent({
  onSuccess,
  authToken,
  connectorId = "",
  onConnectorIdChange,
}: ModalProps) {
  const t = useTranslations("idpSync");
  const tCommon = useTranslations("common");
  const { isEmbeddedIdPEnabled } = useEmbeddedIdentityProviders();
  const [step, setStep] = useState(isEmbeddedIdPEnabled ? -1 : 0);
  const maxSteps = 5;

  return (
    <ModalContent
      maxWidthClass={cn(
        "relative",
        step == 0
          ? "max-w-lg"
          : step == 2
          ? "max-w-2xl"
          : step == 1
          ? "max-w-lg"
          : "max-w-xl",
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
        title={t("connectNetBirdWith", { name: "Okta" })}
        description={t("startSyncingWithProvider", { name: "Okta" })}
      />

      {step === -1 && onConnectorIdChange && (
        <EmbeddedIdentityProviderSelect
          value={connectorId}
          onChange={onConnectorIdChange}
          location="setup"
          filterByType={["okta"]}
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
            {t.rich("oktaPermissionsIntro", {
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
              {t("addOktaApplications")}
            </div>
            <div
              className={
                "py-2 px-6 flex items-center gap-2 rounded-md w-full justify-center bg-nb-gray-930/0 text-nb-gray-200"
              }
            >
              <Settings2 size={14} className={"text-sky-500"} />
              {t("configureOktaApplications")}
            </div>
          </div>
        </div>
      )}

      {step == 1 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <LogInIcon size={20} />
            {t("configureSsoInOkta")}
          </p>
          <Steps>
            <Steps.Step step={1}>
              <p className={"font-normal"}>
                {t.rich("oktaConfigureSsoStep1", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={2}>
              <p className={"font-normal"}>
                {t.rich("oktaSignOnSettingsStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={3} line={false}>
              <p className={"font-normal"}>
                {t.rich("oktaUsernameFormatStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
              <Lightbox image={oktaSSO} />
            </Steps.Step>
          </Steps>
        </div>
      )}

      {step == 2 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <Share2 size={20} />
            {t("enableOktaScimInNetBird")}
          </p>
          <Steps>
            <Steps.Step step={1}>
              <p>
                {t.rich("oktaEnableScimStep1", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={2}>
              <p className={"font-normal"}>
                {t.rich("oktaEnableScimStep2", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={3}>
              <p className={"font-normal"}>
                {t.rich("oktaEnableScimStep3", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
              <MinimalList
                data={[
                  { label: t("oktaAuthorizationLabel"), value: authToken },
                ]}
              />
            </Steps.Step>
            <Steps.Step step={4} line={false}>
              <p className={"font-normal"}>
                {t.rich("oktaEnableScimStep4", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
          </Steps>
        </div>
      )}

      {step == 3 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <Box size={20} />
            {t("oktaConfigureProvisioningTitle")}
          </p>
          <Steps>
            <Steps.Step step={1}>
              <p>
                {t.rich("oktaToAppStep1", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={2} line={false}>
              <p className={"font-normal"}>
                {t.rich("oktaToAppStep2", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
              <Lightbox image={oktaSCIMToApp} />
            </Steps.Step>
          </Steps>
        </div>
      )}

      {step == 4 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <UserCircle size={20} />
            {t("syncUsersToNetBird")}
          </p>
          <Steps>
            <Steps.Step step={1}>
              <p>
                {t.rich("oktaSyncUsersStep1", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
              <Lightbox image={oktaGroupsAssignments} />
            </Steps.Step>
            <Steps.Step step={2}>
              <p className={"font-normal"}>
                {t.rich("oktaSyncUsersStep2", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={3} line={false}>
              <p className={"font-normal"}>
                {t.rich("oktaSyncUsersStep3", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
          </Steps>
        </div>
      )}

      {step == 5 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <FolderGit2 size={20} />
            {t("syncGroupsToNetBird")}
          </p>
          <Steps>
            <Steps.Step step={1}>
              <p>
                {t.rich("oktaSyncGroupsStep1", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
              <Lightbox image={oktaSyncGroups} />
            </Steps.Step>
            <Steps.Step step={2} line={false}>
              <p className={"font-normal"}>
                {t.rich("oktaSyncGroupsStep2", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
          </Steps>
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
            onClick={() => {
              onSuccess();
            }}
          >
            {t("finishSetup")}
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
              {t("setupDuration", { duration: "5-15" })}
            </span>
          </div>
        </div>
      )}
    </ModalContent>
  );
}

export function SetupSSOContent() {
  const t = useTranslations("idpSync");
  const tCommon = useTranslations("common");
  const [step, setStep] = useState(0);
  const maxSteps = 2;

  return (
    <ModalContent
      maxWidthClass={cn("relative", step == 2 ? "max-w-xl" : "max-w-lg")}
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
        title={t("connectNetBirdWith", { name: "Okta" })}
        description={t("startSyncingWithProvider", { name: "Okta" })}
      />

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
            {t.rich("oktaPermissionsIntro", {
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
              {t("addOktaApplications")}
            </div>
            <div
              className={
                "py-2 px-6 flex items-center gap-2 rounded-md w-full justify-center bg-nb-gray-930/0 text-nb-gray-200"
              }
            >
              <Settings2 size={14} className={"text-sky-500"} />
              {t("configureOktaApplications")}
            </div>
          </div>
        </div>
      )}

      {step == 1 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <Box size={20} />
            {t("oktaInstallAppTitle")}
          </p>
          <Steps>
            <Steps.Step step={1}>
              <p>
                {t.rich("oktaNavigateIntegrationNetwork", {
                  link: (chunks) => (
                    <InlineLink
                      className={"inline"}
                      target={"_blank"}
                      href={"https://www.okta.com/integrations/netbird"}
                    >
                      {chunks}
                    </InlineLink>
                  ),
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={2}>
              <p className={"font-normal"}>
                {t.rich("oktaAddIntegrationStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={3} line={false}>
              <p>
                {t.rich("oktaAssignPeopleStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
          </Steps>
        </div>
      )}

      {step == 2 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <MailIcon size={20} />
            {t("oktaShareDetailsTitle")}
          </p>
          <Steps>
            <Steps.Step step={1}>
              <p className={"font-normal"}>
                {t.rich("oktaShareStep1", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                  br: () => <br />,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={2}>
              <p className={"font-normal"}>
                {t.rich("oktaShareStep2", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={3}>
              <p className={"font-normal"}>
                {t.rich("oktaShareStep3", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={4} line={false}>
              <p className={"font-normal"}>
                {t.rich("oktaShareStep4", {
                  link: (chunks) => (
                    <InlineLink href={"https://app.netbird.io"}>
                      {chunks}
                    </InlineLink>
                  ),
                })}
              </p>
            </Steps.Step>
          </Steps>

          <div className={"flex flex-col gap-6 max-w-lg mb-4 z-0"}>
            <div
              className={
                "bg-netbird-950 px-6 py-4 rounded-md border border-netbird-500 "
              }
            >
              <p className={"!text-netbird-200"}>
                {t.rich("oktaShareSecretsNote", {
                  link: (chunks) => (
                    <InlineLink
                      href={"mailto:support@netbird.io"}
                      className={"inline !text-netbird-500 font-medium"}
                    >
                      {chunks}
                    </InlineLink>
                  ),
                  support: (chunks) => (
                    <InlineLink
                      href={"mailto:support@netbird.io"}
                      className={"inline !text-netbird-500 font-medium"}
                    >
                      {chunks}
                    </InlineLink>
                  ),
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      <ModalFooter className={"items-center gap-4"}>
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
            onClick={() => setStep(step + 1)}
          >
            {step == 0 ? t("getStarted") : tCommon("continue")}
            <IconArrowRight size={16} />
          </Button>
        )}
        {step == maxSteps && (
          <ModalClose asChild={true}>
            <Button variant={"primary"} className={"w-full"}>
              {tCommon("close")}
            </Button>
          </ModalClose>
        )}
      </ModalFooter>
      {step == 0 && (
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
              {t("setupDuration", { duration: "5" })}
            </span>
          </div>
        </div>
      )}
    </ModalContent>
  );
}
