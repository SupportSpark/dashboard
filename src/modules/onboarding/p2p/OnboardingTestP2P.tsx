import Button from "@components/Button";
import Code from "@components/Code";
import InlineLink from "@components/InlineLink";
import Steps from "@components/Steps";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Peer } from "@/interfaces/Peer";
import { Policy } from "@/interfaces/Policy";

type Props = {
  firstDevice?: Peer;
  secondDevice?: Peer;
  policy?: Policy;
  onNext?: () => void;
  onTroubleshootingClick?: () => void;
};

export const OnboardingTestP2P = ({
  firstDevice,
  secondDevice,
  onNext,
  onTroubleshootingClick,
}: Props) => {
  const t = useTranslations("onboarding");
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
          {t("testConnectionIntro")}
        </div>
      </div>

      <Steps className={"stepper-bg-variant"}>
        <Steps.Step step={1}>
          <p className={"!text-nb-gray-300"}>
            {t.rich("pingHint", {
              first: firstDevice?.name ?? "",
              second: secondDevice?.name ?? "",
              span: (chunks) => <span className={"text-white"}>{chunks}</span>,
            })}
          </p>
          <Code message={t("commandCopied")}>ping {secondDevice?.ip}</Code>
        </Steps.Step>
        <Steps.Step step={2} line={false} className={"pb-0"}>
          <p className={"!text-nb-gray-300"}>
            {t("everythingWorkingHint")}{" "}
            <InlineLink
              onClick={onTroubleshootingClick}
              href={"https://docs.netbird.io/how-to/troubleshooting-client"}
              target={"_blank"}
            >
              {t("troubleshootingGuide")}
              <ExternalLinkIcon size={12} />
            </InlineLink>
          </p>
          <div className={"mt-2"}>
            <Button
              variant={"secondaryLighter"}
              className={"w-full"}
              onClick={onNext}
            >
              {t("itWorksContinue")}
            </Button>
          </div>
        </Steps.Step>
      </Steps>
    </div>
  );
};
