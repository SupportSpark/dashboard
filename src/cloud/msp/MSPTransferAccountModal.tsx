import Button from "@components/Button";
import { Modal, ModalContent } from "@components/modal/Modal";
import { notify } from "@components/Notification";
import Paragraph from "@components/Paragraph";
import { GradientFadedBackground } from "@components/ui/GradientFadedBackground";
import { useApiCall } from "@utils/api";
import { cn, generateColorFromString } from "@utils/helpers";
import {
  ArrowRightLeft,
  MonitorSmartphoneIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useState } from "react";
import { useSWRConfig } from "swr";
import netBirdLogo from "@/assets/netbird.svg";
import { useMSP } from "@/cloud/msp/contexts/MSPProvider";
import { TenantDNSResponse, TenantStatus } from "@/cloud/msp/interfaces/Tenant";
import { useDialog } from "@/contexts/DialogProvider";
import { useLoggedInUser } from "@/contexts/UsersProvider";

export const MSPTransferAccountModal = () => {
  const { mspInfo } = useMSP();
  const { confirm } = useDialog();
  const { isOwner } = useLoggedInUser();
  const { mutate } = useSWRConfig();
  const tenantRequest = useApiCall<TenantDNSResponse>(
    "/integrations/msp/tenants",
    true,
  );
  const t = useTranslations("msp");
  const tCommon = useTranslations("common");

  const hasParent = mspInfo && Object.hasOwn(mspInfo, "parent_name");
  const isInvited = mspInfo?.status === TenantStatus.Invited;
  const tenantId = mspInfo?.id;

  const firstChar = mspInfo?.parent_name?.charAt(0);
  const color = generateColorFromString(mspInfo?.parent_name);
  const [open, setOpen] = useState(true);

  const grantAccess = async () => {
    const choice = await confirm({
      title: t("grantAccessTitle", { domain: mspInfo?.parent_domain ?? "" }),
      description: t("grantAccessConfirmDescription"),
      confirmText: t("grantAccess"),
      cancelText: tCommon("cancel"),
      type: "danger",
    });
    if (!choice) return;

    notify({
      title: t("grantingAccessTo", { domain: mspInfo?.parent_domain ?? "" }),
      description: t("accessGranted"),
      loadingMessage: t("grantingAccess"),
      promise: tenantRequest
        .put(
          {
            value: "accept",
          },
          `/${tenantId}/invite`,
        )
        .finally(() => {
          setOpen(false);
          mutate("/integrations/msp");
        }),
    });
  };

  const deny = () => {
    notify({
      title: t("accessRequestDenied"),
      description: t("youDeniedAccess"),
      loadingMessage: t("decliningAccess"),
      promise: tenantRequest
        .put(
          {
            value: "decline",
          },
          `/${tenantId}/invite`,
        )
        .finally(() => {
          setOpen(false);
          mutate("/integrations/msp");
        }),
    });
  };

  const showModal = hasParent && isInvited;
  if (!showModal) return;

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
          <div className={"flex justify-center items-center gap-4 mt-2"}>
            <div
              className={
                "h-12 w-12 flex items-center justify-center rounded-md bg-nb-gray-900/70 p-2 border border-nb-gray-900/70"
              }
            >
              <div
                className={cn(
                  "w-8 h-8 flex items-center shrink-0 rounded-[4px] justify-center text-xl font-medium text-white uppercase",
                )}
                style={{
                  color: color,
                }}
              >
                <span>{firstChar}</span>
              </div>
            </div>
            <div>
              <ArrowRightLeft size={24} className={"text-netbird"} />
            </div>
            <div
              className={
                "h-12 w-12 flex items-center justify-center rounded-md bg-nb-gray-900/70 p-2 border border-nb-gray-900/70"
              }
            >
              <Image
                src={netBirdLogo}
                alt={"NetBird"}
                className={"rounded-[4px]"}
              />
            </div>
          </div>
          <div
            className={
              "mx-auto text-center flex flex-col items-center justify-center mt-6 z-[1] px-6"
            }
          >
            <h2 className={"text-lg my-0 leading-[1.5 text-center]"}>
              {mspInfo?.parent_owner_name
                ? t.rich("requestHeadingWithOwner", {
                    owner: mspInfo.parent_owner_name,
                    name: mspInfo.parent_name || mspInfo.name || "",
                    tenant: (chunks) => <span>{chunks}</span>,
                  })
                : t.rich("requestHeading", {
                    name: mspInfo?.parent_name || mspInfo?.name || "",
                    tenant: (chunks) => <span>{chunks}</span>,
                  })}
            </h2>
            <Paragraph
              className={cn("text-sm text-center max-w-[450px] px-4 mt-2")}
            >
              {t("requestDescription")}
            </Paragraph>
            <div
              className={"bg-nb-gray-920 px-5 py-4 rounded-lg mt-4 text-left"}
            >
              <div className={"text-sm text-nb-gray-200 mb-2 text-left"}>
                {t("reviewRequestNotice")}
              </div>
              <ul className="flex flex-col gap-1.5 mt-4 mb-1">
                <li className="flex items-center gap-2 text-sm text-nb-gray-200">
                  <SettingsIcon size={16} className={"text-netbird"} />
                  {t("permissionAccount")}
                </li>
                <li className="flex items-center gap-2 text-sm text-nb-gray-200">
                  <MonitorSmartphoneIcon size={16} className={"text-netbird"} />
                  {t("permissionDevices")}
                </li>
                <li className="flex items-center gap-2 text-sm text-nb-gray-200">
                  <UserIcon size={16} className={"text-netbird"} />
                  {t("permissionUsers")}
                </li>
              </ul>
            </div>
            <div className={"flex gap-4 items-center mt-6 w-full"}>
              <Button className={"w-full"} variant={"secondary"} onClick={deny}>
                {t("deny")}
              </Button>
              <Button
                className={"w-full"}
                variant={"danger"}
                onClick={grantAccess}
              >
                {t("grantAccess")}
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    )
  );
};
