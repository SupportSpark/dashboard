import Button from "@components/Button";
import { Modal, ModalContent } from "@components/modal/Modal";
import { GradientFadedBackground } from "@components/ui/GradientFadedBackground";
import { Check, CircleCheckBig } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

type Props = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export const TrialSuccessModal = ({ open, setOpen }: Props) => {
  const t = useTranslations("billing");
  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalContent showClose={false} maxWidthClass={"max-w-md"}>
        <GradientFadedBackground />
        <div className={"flex items-center justify-center flex-col gap-3 px-6"}>
          <CircleCheckBig size={28} className={"text-green-500"} />
          <div className={"text-xl font-medium"}>{t("trialStarted")}</div>
          <div className={"text-sm text-nb-gray-300 text-center"}>
            {t("trialWelcomeLead")}{" "}
            <b className={"text-nb-gray-200 font-medium"}>
              {t("trialWelcomeBold")}
            </b>
            .
          </div>
          <div className={"bg-nb-gray-920 px-5 py-4 rounded-lg mt-4"}>
            <div className={"text-base font-medium mb-1"}>{t("whatsNext")}</div>
            <div className={"text-sm text-nb-gray-200 mb-2"}>
              {t("trialExploreIntro")}
            </div>
            <ul className="flex flex-col gap-1.5 mt-4 mb-6">
              <li className="flex items-center gap-2 text-sm text-nb-gray-200">
                <Check size={16} className={"text-netbird"} />
                {t("trialFeatureIdpSync")}
              </li>
              <li className="flex items-center gap-2 text-sm text-nb-gray-200">
                <Check size={16} className={"text-netbird"} />
                {t("trialFeaturePostureChecks")}
              </li>
              <li className="flex items-center gap-2 text-sm text-nb-gray-200">
                <Check size={16} className={"text-netbird"} />
                {t("trialFeatureDeviceApprovals")}
              </li>
            </ul>
            <Button
              className={"w-full"}
              variant={"primary"}
              onClick={() => setOpen(false)}
            >
              {t("exploreNetBird")}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
};
