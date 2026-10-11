import Button from "@components/Button";
import { Modal, ModalClose, ModalContent } from "@components/modal/Modal";
import Paragraph from "@components/Paragraph";
import { GradientFadedBackground } from "@components/ui/GradientFadedBackground";
import { cn } from "@utils/helpers";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useState } from "react";

export const PlanSuccessModal = () => {
  const t = useTranslations("billing");
  const tCommon = useTranslations("common");
  const params = useSearchParams();
  const subscriptionSuccess = params.get("success");
  const [successModal, setSuccessModal] = useState(
    subscriptionSuccess === "true",
  );
  return (
    <Modal open={successModal} onOpenChange={setSuccessModal}>
      <ModalContent maxWidthClass={"max-w-sm relative"} showClose={false}>
        <GradientFadedBackground />

        <div
          className={
            "mx-auto text-center flex flex-col items-center justify-center "
          }
        >
          <h2 className={"text-xl my-0 leading-[1.5] mb-2"}>
            {t("thanksForSubscribing")}
          </h2>
          <Paragraph className={cn("text-sm text-center max-w-xs")}>
            {t("subscriptionActivated")}
          </Paragraph>
          <ModalClose asChild={true}>
            <Button variant={"primary"} className={"w-full mt-4"} size={"xs"}>
              {tCommon("close")}
            </Button>
          </ModalClose>
        </div>
      </ModalContent>
    </Modal>
  );
};
