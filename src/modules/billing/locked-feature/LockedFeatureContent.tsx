import Button from "@components/Button";
import { cn } from "@utils/helpers";
import { isNetBirdCloud } from "@utils/netbird";
import { LockIcon, MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { PlanFeatureAvailability } from "@/cloud/cloud-hooks/useIsFeatureLocked";
import { useTrial } from "@/cloud/cloud-hooks/useTrial";
import { useMSP } from "@/cloud/msp/contexts/MSPProvider";
import { useLoggedInUser } from "@/contexts/UsersProvider";
import { PlanTier } from "@/interfaces/Subscription";
import { LockedFeatureInfoCardProps } from "@/modules/billing/locked-feature/LockedFeatureInfoCard";
import { TrialOrUpgradeButton } from "@/modules/billing/trial/TrialOrUpgradeButton";

export const LockedFeatureContent = ({
  feature,
  isTooltip = false,
  featureText,
  isCard = false,
  offerTrial = true,
}: LockedFeatureInfoCardProps) => {
  const t = useTranslations("billing");
  const { isMSPInTenantContext, isAccountWithMSPParent } = useMSP();
  const { isOwnerOrAdmin } = useLoggedInUser();
  const plan = PlanFeatureAvailability[feature];
  const planLabel = isNetBirdCloud()
    ? plan == "team"
      ? t("availableOnTeam")
      : t("availableOnBusiness")
    : t("availableWithEnterpriseLicense");

  return (
    <>
      <div className={"z-10 relative"}>
        <div
          className={cn(
            "flex items-center font-normal mb-1",
            isTooltip ? "text-sm gap-1.5" : "text-base gap-2",
          )}
        >
          <LockIcon
            size={isTooltip ? 12 : 14}
            className={cn("relative", isTooltip && "-top-[1px]")}
          />
            {planLabel}
        </div>
        <div
          className={cn(
            "text-nb-gray-300 font-light",
            isTooltip ? "text-xs" : "",
          )}
        >
          <AvailableOnPlanText
            featureText={featureText ?? t("thisFeature")}
            plan={plan}
          />
          {isCard && <br />}
          <UpgradeOrTrialText offerTrial={offerTrial} />
        </div>
      </div>
      {(isOwnerOrAdmin || !isNetBirdCloud()) && (
        <TrialOrUpgradeButton
          plan={plan}
          feature={feature}
          variant={"primary"}
          isCard={isCard}
          isTooltip={isTooltip}
          offerTrial={offerTrial}
          hidden={isAccountWithMSPParent}
        />
      )}
      {isAccountWithMSPParent && !isMSPInTenantContext && (
        <GetMSPSupportButton />
      )}
    </>
  );
};

const AvailableOnPlanText = ({
  featureText,
  plan,
}: {
  featureText: string;
  plan: PlanTier;
}) => {
  const t = useTranslations("billing");
  const teamOrBusiness =
    plan == "team"
      ? t("availableOnTeamOrHigher")
      : t("availableOnBusinessPlan");
  // "Posture Checks" is plural, so it takes the "are" wording.
  if (featureText.includes("Posture Checks")) {
    if (!isNetBirdCloud())
      return (
        <>
          {t("availableOnEnterpriseOrCloudAre", {
            feature: featureText,
            plan: teamOrBusiness,
          })}
        </>
      );
    return (
      <>
        {t("planAvailabilityAre", {
          feature: featureText,
          plan: teamOrBusiness,
        })}
      </>
    );
  }
  if (!isNetBirdCloud())
    return (
      <>
        {t("availableOnEnterpriseOrCloud", {
          feature: featureText,
          plan: teamOrBusiness,
        })}
      </>
    );
  return (
    <>
      {t("planAvailability", {
        feature: featureText,
        plan: teamOrBusiness,
      })}
    </>
  );
};

const UpgradeOrTrialText = ({
  offerTrial = true,
}: {
  offerTrial?: boolean;
}) => {
  const t = useTranslations("billing");
  const {
    isMSPInTenantContext,
    isAccountWithMSPParent,
    mspContact,
    hasReseller,
  } = useMSP();
  const { isTrialAvailable } = useTrial();
  const { isOwnerOrAdmin } = useLoggedInUser();

  if (!isNetBirdCloud()) {
    return (
      <>
      </>
    );
  }

  if (hasReseller) {
    return <>{t("contactAdminToUpgrade")}</>;
  }

  if (isAccountWithMSPParent && !isMSPInTenantContext) {
    return (
      <>
        {t("contactAdminLead")}{" "}
        <span className={"text-nb-gray-200 font-medium"}>{mspContact}</span>{" "}
        {t("contactAdminTail")}
      </>
    );
  }

  if (!isOwnerOrAdmin) return <>{t("ownerOrAdminUpgradeOnly")}</>;

  if (isTrialAvailable && offerTrial)
    return <>{t("upgradeOrStartTrial")}</>;

  return (
    <>
      {t("upgradePlanToAccess", {
        scope: isMSPInTenantContext ? t("scopeTenants") : t("scopeCurrent"),
      })}
    </>
  );
};

const GetMSPSupportButton = () => {
  const tAws = useTranslations("awsMarketplace");
  const { mspInfo, hasReseller } = useMSP();
  const mailToEmail = mspInfo?.parent_owner_email || "support@netbird.io";
  if (hasReseller) return;

  return (
    <div className={"relative top-1 min-w-[160px]"}>
      <a
        href={`mailto:${mailToEmail}?subject=Request%20for%20Assistance%3A%20Upgrade%20Plan`}
        className={"w-full"}
      >
        <Button
          size={"xs"}
          variant={"primary"}
          className={cn("w-full h-[34px]")}
        >
          <MailIcon size={15} className={"shrink-0"} />
          {tAws("getSupport")}
        </Button>
      </a>
    </div>
  );
};
