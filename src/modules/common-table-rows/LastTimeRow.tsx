import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/Tooltip";
import dayjs from "dayjs";
import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/contexts/LocaleProvider";
import EmptyRow from "@/modules/common-table-rows/EmptyRow";

/**
 * Absolute timestamp in the active language.
 *
 * The English form is kept byte-identical to upstream. Chinese needs its own
 * pattern because the upstream one interpolates the literal word "at"
 * (`D MMMM, YYYY [at] h:mm A`), and dayjs will not translate text inside square
 * brackets — a Chinese UI would otherwise read "12 十月, 2026 at 15:04".
 */
function formatAbsolute(date: Date, locale: string) {
  return locale === "zh"
    ? dayjs(date).format("YYYY年M月D日 HH:mm")
    : dayjs(date).format("D MMMM, YYYY [at] h:mm A");
}

type Props = {
  date: Date;
  text?: string;
  prefix?: string;
};
export default function LastTimeRow({ date, text, prefix }: Props) {
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  // Resolved here rather than as a destructuring default: a default parameter is
  // evaluated before `tCommon` exists, so it cannot reference the translator.
  const label = text ?? tCommon("lastSeenOn");
  const neverUsed = dayjs(date).isBefore(dayjs().subtract(2000, "years"));

  return !neverUsed ? (
    <TooltipProvider>
      <Tooltip delayDuration={1}>
        <TooltipTrigger>
          <div
            className={
              "flex items-center whitespace-nowrap gap-2 dark:text-neutral-300 text-neutral-500 hover:text-neutral-100 transition-all hover:bg-nb-gray-800/60 py-2 px-3 rounded-md cursor-default"
            }
          >
            <>
              <History size={14} />
              {prefix && <>{prefix} </>}
              {dayjs().to(date)}
            </>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className={"text-neutral-300 flex flex-col gap-1"}>
            <span className={"text-xs"}>{label}</span>
            <span className={"text-neutral-200"}>
              {formatAbsolute(date, locale)}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <EmptyRow />
  );
}
