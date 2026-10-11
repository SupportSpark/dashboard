import Button from "@components/Button";
import InlineLink from "@components/InlineLink";
import { Input } from "@components/Input";
import { Modal, ModalContent, ModalFooter } from "@components/modal/Modal";
import { notify } from "@components/Notification";
import Steps from "@components/Steps";
import { GradientFadedBackground } from "@components/ui/GradientFadedBackground";
import { Mark } from "@components/ui/Mark";
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { cn } from "@utils/helpers";
import {
  Box,
  GlobeIcon,
  KeyRoundIcon,
  Loader2,
  PlusCircle,
  Repeat,
  Settings2,
  Shield,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useState } from "react";
import integrationImage from "@/assets/integrations/okta.png";
import { DomainValidationStatus } from "@/interfaces/Account";
import { EstimatedSetupTime } from "@/modules/integrations/EstimatedSetupTime";
import { IntegrationModalHeader } from "@/modules/integrations/IntegrationModalHeader";
import { DomainVerificationModal } from "@/modules/integrations/sso/DomainVerificationModal";
import { useEnterpriseConnections } from "@/modules/integrations/sso/useEnterpriseConnections";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function OktaSSOSetup({ open, onOpenChange }: Props) {
  const t = useTranslations("idpSync");
  const tCommon = useTranslations("common");
  const tIntegrations = useTranslations("integrations");
  const { createOrUpdateConnection, verifyDomain, mutate } =
    useEnterpriseConnections();
  const [step, setStep] = useState(0);
  const maxSteps = 2;

  const [oktaDomain, setOktaDomain] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [primaryEmailDomain, setPrimaryEmailDomain] = useState("");

  const [domainVerificationModal, setDomainVerificationModal] = useState(false);
  const [verificationDomain, setVerificationDomain] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const connect = () => {
    if (isLoading) return;
    setIsLoading(true);
    notify({
      title: t("oktaSsoIntegrationTitle"),
      description: t("oktaSsoWasConnected"),
      loadingMessage: t("oktaSsoConnecting"),
      promise: createOrUpdateConnection({
        domain: oktaDomain,
        client_id: clientId,
        client_secret: btoa(clientSecret),
        email_domain: primaryEmailDomain,
        strategy: "okta",
        provider: "okta",
      })
        .then((connections) => {
          onOpenChange(false);

          const oktaConnection = connections.find(
            (connection) => connection.strategy === "okta",
          );
          if (!oktaConnection) {
            notify({
              title: t("oktaSsoIntegrationTitle"),
              description: t("oktaSsoConnectFailed"),
            });
            return;
          }
          const domain = oktaConnection.domains?.[0] || undefined;
          if (!domain) {
            notify({
              title: t("oktaSsoIntegrationTitle"),
              description: t("oktaSsoConnectFailed"),
            });
            return;
          }
          if (domain.validation_status !== DomainValidationStatus.VERIFIED) {
            setVerificationDomain(domain.name);
            setVerificationToken(domain.validation_token);
            setConnectionId(oktaConnection.id);
            setDomainVerificationModal(true);
          }
          mutate();
        })
        .finally(() => setIsLoading(false)),
    });
  };

  return (
    <>
      <DomainVerificationModal
        open={domainVerificationModal}
        onOpenChange={setDomainVerificationModal}
        domain={verificationDomain}
        token={verificationToken}
        onVerify={() => verifyDomain(connectionId, verificationDomain)}
      />

      <Modal open={open} onOpenChange={onOpenChange}>
        <ModalContent
          maxWidthClass={cn("relative", step == 0 ? "max-w-md" : "max-w-xl")}
          showClose={true}
          className={""}
          onEscapeKeyDown={(e) => step > 0 && e.preventDefault()}
          onInteractOutside={(e) => step > 0 && e.preventDefault()}
          onPointerDownOutside={(e) => step > 0 && e.preventDefault()}
        >
          <GradientFadedBackground />

          {step > 0 && (
            <div
              className={"flex gap-2 w-full items-center justify-center mb-4"}
            >
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
            title={t("oktaSsoSetupTitle")}
            description={t("oktaSsoUseAsProvider")}
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
                <KeyRoundIcon size={20} />
                {t("oktaEnterDetailsTitle")}
              </p>
              <Steps>
                <Steps.Step step={1}>
                  <p className={"font-normal"}>
                    {t.rich("oktaEnterDetailsStep1", {
                      mark: (chunks) => <Mark>{chunks}</Mark>,
                    })}
                  </p>
                  <Input
                    customPrefix={
                      <span className={"min-w-[90px]"}>
                        {tIntegrations("clientIdLabel")}
                      </span>
                    }
                    placeholder={"0obflxtwxoVQcur0z3f3"}
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                  <Input
                    customPrefix={
                      <span className={"min-w-[90px]"}>
                        {tIntegrations("clientSecretLabel")}
                      </span>
                    }
                    placeholder={
                      "jfgbU1Wu3XWAKhGUF4d-PX54DSm3pAQCyNtpxp7Nu8Ij22stSz8_6KnWbO4nQBIb"
                    }
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                  />
                </Steps.Step>
                <Steps.Step step={2}>
                  <p className={"font-normal"}>
                    {t.rich("oktaAccountDomainStep", {
                      mark: (chunks) => <Mark>{chunks}</Mark>,
                    })}
                  </p>
                  <Input
                    customPrefix={<GlobeIcon size={16} />}
                    placeholder={"mydomain.okta.com"}
                    value={oktaDomain}
                    onChange={(e) => setOktaDomain(e.target.value)}
                  />
                </Steps.Step>
                <Steps.Step step={3} line={false}>
                  <p className={"font-normal"}>
                    {t.rich("primaryEmailDomainStep", {
                      mark: (chunks) => <Mark>{chunks}</Mark>,
                    })}
                  </p>
                  <Input
                    customPrefix={<GlobeIcon size={16} />}
                    placeholder={"mycompany.com"}
                    value={primaryEmailDomain}
                    onChange={(e) => setPrimaryEmailDomain(e.target.value)}
                  />
                </Steps.Step>
              </Steps>
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
              <Button
                variant={"primary"}
                className={"w-full"}
                onClick={connect}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 size={16} className={"animate-spin"} />
                ) : (
                  <Repeat size={16} />
                )}
                {t("connect")}
              </Button>
            )}
          </ModalFooter>
          {step == 0 && <EstimatedSetupTime minutes={5} />}
        </ModalContent>
      </Modal>
    </>
  );
}
