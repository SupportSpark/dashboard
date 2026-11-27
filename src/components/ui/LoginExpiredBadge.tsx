import Badge from "@components/Badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/Tooltip";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  loginExpired: boolean;
};
export default function LoginExpiredBadge({ loginExpired }: Props) {
  const t = useTranslations("peers");

  return loginExpired ? (
    <Tooltip delayDuration={1}>
      <TooltipTrigger>
        <Badge variant={"yellow"} className={"px-2"}>
          <Clock size={12} />
          {t("loginRequired")}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className={"text-nb-gray-300 dark:text-neutral-300 text-xs"}>
          {t.rich("loginExpiredTooltip", { br: () => <br /> })}
        </div>
      </TooltipContent>
    </Tooltip>
  ) : null;
}
