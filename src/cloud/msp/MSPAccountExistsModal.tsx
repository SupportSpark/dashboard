import Button from "@components/Button";
import { Callout } from "@components/Callout";
import { Modal, ModalContent, ModalFooter } from "@components/modal/Modal";
import { GradientFadedBackground } from "@components/ui/GradientFadedBackground";
import { GlobeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Tenant } from "@/cloud/msp/interfaces/Tenant";

type Props = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tenant: Tenant;
  onAccept: (t: Tenant) => void;
  onCancel: (t: Tenant) => void;
};

export const MSPAccountExistsModal = ({
  open,
  setOpen,
  tenant,
  onAccept,
  onCancel,
}: Props) => {
  const t = useTranslations("msp");
  const tCommon = useTranslations("common");
  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalContent
        showClose={false}
        maxWidthClass={"max-w-md"}
        className={"z-[9999]"}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <GradientFadedBackground />
        <div className={"flex flex-col gap-2 px-8 z-[1]"}>
          <div
            className={
              "text-sm w-full text-center text-white py-2 rounded-lg flex items-center justify-center gap-2"
            }
          >
            <GlobeIcon size={16} className={"text-netbird"} />
            {tenant?.domain}
          </div>
          <div className={"text-xl font-medium text-center mb-1"}>
            {t("accountExistsTitle")}
          </div>
          <div className={"text-sm text-nb-gray-300 text-center"}>
            {t.rich("accountExistsDescription", {
              domain: tenant?.domain ?? "",
              b: (chunks) => <span className="text-white">{chunks}</span>,
            })}
          </div>
          <div className={"text-sm text-nb-gray-300 text-center"}></div>
          <Callout>{t("accountOwnerMustLogIn")}</Callout>
        </div>

        <ModalFooter separator={false} className={"gap-x-2"}>
          <Button
            autoFocus={true}
            className={"w-full"}
            variant={"secondary"}
            onClick={() => onCancel(tenant)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            autoFocus={true}
            className={"w-full"}
            variant={"primary"}
            onClick={() => onAccept(tenant)}
          >
            {t("requestAccess")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
