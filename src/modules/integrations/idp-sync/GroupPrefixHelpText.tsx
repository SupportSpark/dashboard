import HelpText from "@components/HelpText";
import { useTranslations } from "next-intl";
import * as React from "react";

type Props = {
  type?: "user-groups" | "groups";
};
export const GroupPrefixHelpText = ({ type = "groups" }: Props) => {
  const t = useTranslations("idpSync");

  return type === "user-groups" ? (
    <HelpText className={"max-w-lg mt-2"}>
      {t.rich("defaultSyncAllUsers", {
        accent: (chunks) => (
          <span className={"text-netbird font-semibold"}>{chunks}</span>
        ),
      })}{" "}
      <br />
      {t("userGroupPrefixHelp")}
    </HelpText>
  ) : (
    <HelpText className={"max-w-lg mt-2"}>
      {t.rich("defaultSyncAllGroups", {
        accent: (chunks) => (
          <span className={"text-netbird font-semibold"}>{chunks}</span>
        ),
      })}{" "}
      <br />
      {t("groupPrefixHelp")}
    </HelpText>
  );
};
