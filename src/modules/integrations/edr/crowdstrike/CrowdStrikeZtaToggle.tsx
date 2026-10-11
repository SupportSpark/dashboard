import FancyToggleSwitch from "@components/FancyToggleSwitch";
import InlineLink from "@components/InlineLink";
import { ExternalLinkIcon, GaugeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

type Props = {
  value: boolean;
  onChange: (value: boolean) => void;
};
export const CrowdStrikeZtaToggle = ({ value, onChange }: Props) => {
  const t = useTranslations("integrations");
  return (
    <FancyToggleSwitch
      value={value}
      onChange={onChange}
      label={
        <>
          <GaugeIcon size={15} />
          {t("ztaToggleLabel")}
        </>
      }
      helpText={t.rich("ztaToggleHelp", {
        link: (chunks) => (
          <InlineLink
            href={
              "https://www.crowdstrike.com/resources/white-papers/falcon-zero-trust-risk-score/"
            }
            target={"_blank"}
          >
            {chunks}
            <ExternalLinkIcon
              size={12}
              className={"shrink-0 relative -top-[1px] mr-[1px]"}
            />
          </InlineLink>
        ),
      })}
    />
  );
};
