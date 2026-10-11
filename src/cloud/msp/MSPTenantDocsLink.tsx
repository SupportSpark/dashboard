import InlineLink from "@components/InlineLink";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

export const MSPTenantDocsLink = () => {
  const t = useTranslations("msp");
  const tCommon = useTranslations("common");
  return (
    <>
      {tCommon("learnMoreAbout")}
      <InlineLink
        href={"https://docs.netbird.io/how-to/msp-portal"}
        target={"_blank"}
      >
        {t("mspPortal")}
        <ExternalLinkIcon size={12} />
      </InlineLink>
    </>
  );
};
