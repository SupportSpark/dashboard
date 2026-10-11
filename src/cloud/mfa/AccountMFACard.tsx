import FeatureCard, { FeatureCardStatus } from "@components/FeatureCard";
import useFetchApi from "@utils/api";
import loadConfig from "@utils/config";
import { isNetBirdCloud } from "@utils/netbird";
import { ShieldCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useMemo } from "react";
import { AccountMFA } from "@/cloud/mfa/AccountMFASettings";

const config = loadConfig();

export const AccountMfaCard = () => {
  const t = useTranslations("cloudMfa");
  const { data: accountMfa } = useFetchApi<AccountMFA>(
    "/service/mfa",
    true,
    true,
    !!config.authServiceUrl,
    {
      origin: config.authServiceUrl,
    },
  );

  const enabled = useMemo(() => {
    return accountMfa?.mfa || false;
  }, [accountMfa]);

  const router = useRouter();

  return (
    isNetBirdCloud() && (
      <FeatureCard
        onClick={() => router.push("/settings?tab=authentication")}
        aria-label={t("title")}
        className={"min-w-[432px]"}
        icon={<ShieldCheckIcon size={16} />}
        title={t("title")}
        action={<FeatureCardStatus enabled={enabled} />}
        description={t("enableMfaDescription")}
      />
    )
  );
};
