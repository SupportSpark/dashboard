import Button from "@components/Button";
import { useTranslations } from "next-intl";
import FullTooltip from "@components/FullTooltip";
import { notify } from "@components/Notification";
import { cn } from "@utils/helpers";
import { TrashIcon } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { useSignInDomains } from "@/cloud/sign-in-domains/useSignInDomains";
import { useDialog } from "@/contexts/DialogProvider";
import { usePermissions } from "@/contexts/PermissionsProvider";
import { DomainValidationStatus, SignInDomain } from "@/interfaces/Account";
import { DomainVerificationModal } from "@/modules/integrations/sso/DomainVerificationModal";

type Props = {
  domain: SignInDomain;
};

export default function DomainActionCell({
domain }: Readonly<Props>) {
  const tsid = useTranslations("signInDomains");
  const tCommon = useTranslations("common");
  const { permission } = usePermissions();
  const { verifyDomain, deleteDomain, mutate } = useSignInDomains();
  const { confirm } = useDialog();
  const [modal, setModal] = useState(false);

  const isVerified =
    domain.validation_status === DomainValidationStatus.VERIFIED;
  const connections = domain.connections ?? [];

  const removeBlockedReason: React.ReactNode = domain.is_primary ? (
    <>{tsid("primaryDomainCannotBeRemoved")}</>
  ) : connections.length > 0 ? (
    <>{tsid("domainUsedBySso")}</>
  ) : undefined;

  const deleteDomainHandler = async () => {
    const choice = await confirm({
      title: tsid("removeDomainQuestion", { name: domain.name }),
      description: tsid("removeDescription"),
      confirmText: tCommon("remove"),
      cancelText: tCommon("cancel"),
      type: "danger",
      maxWidthClass: "max-w-md",
    });
    if (!choice) return;
    notify({
      title: tsid("title"),
      description: tsid("domainRemoved", { name: domain.name }),
      promise: deleteDomain(domain.id).then((res) => {
        mutate().catch(() => {});
        return res;
      }),
      loadingMessage: tsid("removingDomain"),
    });
  };

  return (
    <div
      className={
        "relative top-[2px] flex gap-2 items-center justify-end ml-auto min-h-[34px]"
      }
    >
      <DomainVerificationModal
        open={modal}
        onOpenChange={setModal}
        domain={domain.name}
        token={domain.validation_token}
        onVerify={() =>
          verifyDomain(domain.id).then((res) => {
            mutate().catch(() => {});
            return res;
          })
        }
      />

      {!isVerified && (
        <Button
          variant={"secondary"}
          size={"xs"}
          className={"!px-3"}
          disabled={!permission.settings.update}
          onClick={() => setModal(true)}
          data-testid={"verify-domain"}
        >
          Verify
        </Button>
      )}

      <FullTooltip
        content={
          <div className={"text-xs max-w-xs"}>
            {removeBlockedReason ?? tsid("removeDomain")}
          </div>
        }
        interactive={false}
      >
        <Button
          variant={"danger-outline"}
          size={"xs"}
          className={cn(
            "!p-0 !h-[34px] !w-[34px]",
            removeBlockedReason && "pointer-events-none",
          )}
          disabled={!!removeBlockedReason || !permission.settings.update}
          onClick={deleteDomainHandler}
          aria-label={tsid("removeDomain")}
          data-testid={"remove-domain"}
        >
          <TrashIcon size={14} />
        </Button>
      </FullTooltip>
    </div>
  );
}
