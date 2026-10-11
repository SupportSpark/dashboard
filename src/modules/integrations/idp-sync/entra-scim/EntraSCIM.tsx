import { useTranslations } from "next-intl";
import * as React from "react";
import integrationImage from "@/assets/integrations/entra-id.png";
import { IdentityProvider } from "@/interfaces/IdentityProvider";
import { GenericSCIM } from "@/modules/integrations/idp-sync/generic-scim/GenericSCIM";

export const EntraSCIM = () => {
  const t = useTranslations("idpSync");
  return (
    <GenericSCIM
      provider={IdentityProvider.ENTRA}
      name={"Entra ID (SCIM)"}
      description={t("entraScimDescription")}
      url={{
        title: "microsoft.com",
        href: "https://learn.microsoft.com/en-us/entra/architecture/sync-scim",
      }}
      image={integrationImage}
    />
  );
};
