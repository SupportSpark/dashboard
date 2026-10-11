import Button from "@components/Button";
import { cn } from "@utils/helpers";
import { useGuardedRouter } from "@utils/navigation-guard";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useTrial } from "@/cloud/cloud-hooks/useTrial";
import { useLoggedInUser } from "@/contexts/UsersProvider";
import { PlanIcon } from "@/modules/billing/PlanIcon";

export const TrialNavigationInfoCard = () => {
  const router = useGuardedRouter();
  const t = useTranslations("billing");
  const tCommon = useTranslations("common");
  const { isOwnerOrAdmin } = useLoggedInUser();
  const { trialDaysRemaining } = useTrial();

  return (
    <div
      className={cn(
        "w-full rounded-md text-xs flex flex-col gap-3 whitespace-normal border",
        "bg-nb-gray-900/20 py-4 px-4 border-nb-gray-800/30 relative",
      )}
    >
      <div className={"flex items-center text-sm gap-3"}>
        <PlanIcon name={"trial"} size={33} />
        <div className={"min-w-0"}>
          <div className={"font-semibold"}>{tCommon("freeTrial")}</div>
          <div className={"truncate text-xs text-nb-gray-300 transition-all"}>
            {t("trialEndsInDays", { count: trialDaysRemaining ?? 0 })}
          </div>
        </div>
      </div>

      {isOwnerOrAdmin && (
        <div className={"flex gap-3 text-xs font-medium"}>
          <Button
            variant={"input"}
            size={"xs"}
            className={"w-full"}
            onClick={() => {
              router.push("/settings?tab=plans-and-billing");
            }}
          >
            {t("upgradePlan")}
          </Button>
        </div>
      )}
    </div>
  );
};
