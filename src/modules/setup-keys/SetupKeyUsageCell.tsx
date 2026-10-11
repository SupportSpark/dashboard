import { IconRepeat } from "@tabler/icons-react";
import { Repeat1 } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  current: number;
  limit: number;
  reusable: boolean;
};
export default function SetupKeyUsageCell({ current, limit, reusable }: Props) {
  const t = useTranslations("setupKeys");
  return reusable ? (
    <div className={"flex items-center text-[13px] text-nb-gray-300 gap-2"}>
      <IconRepeat size={14} className={"text-green-400"} />
      <span>
        {t("usageOfLimit", {
          current,
          limit: limit == 0 ? t("unlimited") : limit,
        })}
      </span>
    </div>
  ) : (
    <div className={"flex items-center text-[13px] text-nb-gray-300 gap-2"}>
      <Repeat1 size={14} /> {t("oneOff")}
    </div>
  );
}
