import Button from "@components/Button";
import Code from "@components/Code";
import InlineLink from "@components/InlineLink";
import { Modal, ModalContent } from "@components/modal/Modal";
import Steps from "@components/Steps";
import { cn } from "@utils/helpers";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useMemo, useState } from "react";
import { NetworkResource } from "@/interfaces/Network";
import { Peer } from "@/interfaces/Peer";
import { SetupModalContent } from "@/modules/setup-netbird-modal/SetupModal";

type Props = {
  resource?: NetworkResource;
  device?: Peer;
  onNext?: () => void;
  onTroubleshootingClick?: () => void;
};

export const OnboardingTestResource = ({
  resource,
  device,
  onNext,
  onTroubleshootingClick,
}: Props) => {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);

  const isSubnet = resource?.type === "subnet";
  const isWildCard = resource?.address.includes("*");
  const isHost = resource?.type === "host";

  const pingAddress = useMemo(() => {
    let a = resource?.address || "";
    if (isHost) {
      if (a.endsWith("/32")) a = a.slice(0, -3);
      else if (a.endsWith("/128")) a = a.slice(0, -4);
    }
    if (isWildCard) return t("anySubdomainOf", { address: a });
    return isSubnet ? t("resourceIpInSubnet") : a;
  }, [isWildCard, isHost, isSubnet, resource?.address, t]);

  return (
    <div className={"relative flex flex-col h-full gap-4"}>
      <div>
        <h1 className={"text-xl text-center max-w-sm mx-auto"}>
          {t("testConnectionTitle")}
        </h1>
        <div
          className={
            "text-sm text-nb-gray-300 font-light mt-2 block text-center sm:px-4"
          }
        >
          {t("testResourceIntro")}
        </div>
      </div>

      <Steps className={"stepper-bg-variant"}>
        <Steps.Step step={1}>
          <p className={"!text-nb-gray-300"}>
            {t.rich("pingResourceHint", {
              device: device?.name || t("yourDevice"),
              span: (chunks) => (
                <span className={cn(device && "text-white")}>{chunks}</span>
              ),
            })}
          </p>
          <Code showCopyIcon={!isSubnet && !isWildCard}>
            ping {pingAddress}
          </Code>
        </Steps.Step>
        <Steps.Step step={2} line={false} className={"pb-0"} disabled={!device}>
          <p className={"!text-nb-gray-300"}>
            {t("everythingWorkingHint")}{" "}
            <InlineLink
              href={"https://docs.netbird.io/how-to/troubleshooting-client"}
              target={"_blank"}
              onClick={onTroubleshootingClick}
            >
              {t("troubleshootingGuide")}
              <ExternalLinkIcon size={12} />
            </InlineLink>
          </p>
          <div className={"mt-2"}>
            <Button
              variant={"secondaryLighter"}
              onClick={onNext}
              className={"w-full"}
            >
              {t("itWorksContinue")}
            </Button>
          </div>
        </Steps.Step>
      </Steps>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <SetupModalContent title={tCommon("installNetBird")} />
        </ModalContent>
      </Modal>
    </div>
  );
};
