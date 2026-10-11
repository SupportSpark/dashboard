import Button from "@components/Button";
import Card from "@components/Card";
import InlineLink from "@components/InlineLink";
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalFooter,
} from "@components/modal/Modal";
import ModalHeader from "@components/modal/ModalHeader";
import { notify } from "@components/Notification";
import Paragraph from "@components/Paragraph";
import Steps from "@components/Steps";
import { GradientFadedBackground } from "@components/ui/GradientFadedBackground";
import { Mark } from "@components/ui/Mark";
import { cn } from "@utils/helpers";
import { ExternalLinkIcon, GlobeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  token: string;
  onVerify: () => Promise<unknown>;
};
export const DomainVerificationModal = ({
  open,
  onOpenChange,
  domain,
  token,
  onVerify,
}: Props) => {
  const t = useTranslations("idpSync");
  const startVerification = async () => {
    notify({
      title: t("domainVerificationTitle"),
      description: t("verificationStarted", { domain }),
      promise: onVerify().then(() => {
        onOpenChange(false);
      }),
      loadingMessage: t("startingDomainVerification"),
    });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        maxWidthClass={cn("relative", "max-w-xl")}
        showClose={true}
        className={""}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <GradientFadedBackground />
        <ModalHeader
          icon={<GlobeIcon size={20} />}
          title={t("verifyDomainOwnershipTitle")}
          description={domain}
          color={"netbird"}
        />
        <div className={"px-8 flex flex-col gap-0"}>
          <Steps className={"pt-0"}>
            <Steps.Step step={1}>
              <p className={"font-normal"}>
                {t("verifyDomainOwnershipStep1")}
              </p>
            </Steps.Step>
            <Steps.Step step={2} line={false}>
              <p className={"font-normal"}>
                {t.rich("verifyDomainOwnershipStep2", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                  domain,
                })}
              </p>
            </Steps.Step>
          </Steps>
          <Card className={"w-full"}>
            <Card.List>
              <Card.ListItem
                copy
                copyText={t("txtHostCopyLabel")}
                label={t("txtHostLabel")}
                value={domain}
              />
              <Card.ListItem
                copy
                copyText={t("txtValueCopyLabel")}
                label={t("txtValueLabel")}
                value={`nb-verification=${token}`}
              />
            </Card.List>
          </Card>

          <Paragraph className={"text-sm mt-4"}>
            {t("verifyDomainDnsNote")}
          </Paragraph>

          <div
            className={
              "bg-nb-gray-900/70 px-4 py-3 rounded-md border border-nb-gray-800/70 my-6 !text-nb-gray-300 text-sm"
            }
          >
            {t.rich("verifyDomainEmailFallback", {
              link: (chunks) => (
                <InlineLink
                  href={"mailto:support@netbird.io"}
                  className={"inline font-medium"}
                >
                  {chunks}
                </InlineLink>
              ),
            })}
          </div>
        </div>
        <ModalFooter className={"items-center"}>
          <div className={"w-full"}>
            <Paragraph className={"text-sm mt-auto"}>
              {t.rich("verifyDomainLearnMore", {
                link: (chunks) => (
                  <InlineLink href={"#"} target={"_blank"}>
                    {chunks}
                    <ExternalLinkIcon size={12} />
                  </InlineLink>
                ),
              })}
            </Paragraph>
          </div>
          <div className={"flex gap-3 w-full justify-end"}>
            <ModalClose asChild={true}>
              <Button variant={"secondary"}>{t("verifyLater")}</Button>
            </ModalClose>

            <Button variant={"primary"} onClick={startVerification}>
              {t("startVerification")}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
