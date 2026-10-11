import { Clock4 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

type Props = {
  minutes?: number;
};
export const EstimatedSetupTime = ({ minutes = 5 }: Props) => {
  const t = useTranslations("integrations");
  return (
    <div
      className={
        "text-center z-0 mt-2.5 text-xs text-nb-gray-300 flex items-center justify-center gap-2 font-normal"
      }
    >
      <Clock4 size={12} />
      <div>
        {t("estimatedSetupTime")}
        <span className={"font-medium"}>
          {" "}
          {t("setupDuration", { duration: minutes })}
        </span>
      </div>
    </div>
  );
};
