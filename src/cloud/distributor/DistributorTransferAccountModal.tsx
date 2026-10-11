import Button from "@components/Button";
import { useTranslations } from "next-intl";
import { Modal, ModalContent } from "@components/modal/Modal";
import { notify } from "@components/Notification";
import Paragraph from "@components/Paragraph";
import { GradientFadedBackground } from "@components/ui/GradientFadedBackground";
import { useApiCall } from "@utils/api";
import { cn } from "@utils/helpers";
import * as React from "react";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { useMSP } from "@/cloud/msp/contexts/MSPProvider";
import { useDialog } from "@/contexts/DialogProvider";
import { useLoggedInUser } from "@/contexts/UsersProvider";
import { useAccount } from "@/modules/account/useAccount";

export const DistributorTransferAccountModal = () => {
  const td = useTranslations("distributor");
  const tCommon = useTranslations("common");
  const { mspInfo } = useMSP();
  const account = useAccount();
  const { confirm } = useDialog();
  const { isOwner } = useLoggedInUser();
  const { mutate } = useSWRConfig();
  const resellerRequest = useApiCall<string>(
    "/integrations/msp/reseller/msps",
    true,
  );

  const hasResellerInvite = mspInfo?.reseller_status === "invited";

  const [open, setOpen] = useState(true);

  const grantAccess = async () => {
    const choice = await confirm({
      title: td("grantAccessTitle"),
      description: td("grantAccessConfirmDescription"),
      confirmText: td("grantAccess"),
      cancelText: tCommon("cancel"),
      type: "danger",
    });
    if (!choice) return;

    notify({
      title: td("grantingAccessToDistributor"),
      description: td("accessGranted"),
      loadingMessage: td("grantingAccess"),
      promise: resellerRequest
        .put(
          {
            value: "accept",
          },
          `/${account?.id}/invite`,
        )
        .finally(() => {
          setOpen(false);
          mutate("/integrations/msp/reseller");
          mutate("/integrations/msp");
        }),
    });
  };

  const deny = () => {
    notify({
      title: td("accessRequestDenied"),
      description: td("youDeniedDistributorAccess"),
      loadingMessage: td("decliningAccess"),
      promise: resellerRequest
        .put(
          {
            value: "decline",
          },
          `/${account?.id}/invite`,
        )
        .finally(() => {
          setOpen(false);
          mutate("/integrations/msp/reseller");
          mutate("/integrations/msp");
        }),
    });
  };

  if (!hasResellerInvite) return;

  return (
    isOwner && (
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
          <div
            className={
              "mx-auto text-center flex flex-col items-center justify-center mt-3 z-[1] px-6"
            }
          >
            <h2
              className={"text-lg my-0 leading-[1.5] text-center text-balance"}
            >
              {td("requestHeading")}
            </h2>
            <Paragraph
              className={cn("text-sm text-center max-w-[450px] px-4 mt-2")}
            >
              {td("requestDescription")}
            </Paragraph>
            <div className={"flex gap-4 items-center mt-6 w-full"}>
              <Button className={"w-full"} variant={"secondary"} onClick={deny}>
                {td("deny")}
              </Button>
              <Button
                className={"w-full"}
                variant={"danger"}
                onClick={grantAccess}
              >
                {td("grantAccess")}
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    )
  );
};
