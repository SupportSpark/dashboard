import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/Tooltip";
import dayjs from "dayjs";
import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import EmptyRow from "@/modules/common-table-rows/EmptyRow";

type Props = {
  date: Date;
  text?: string;
  prefix?: string;
};
export default function LastTimeRow({ date, text, prefix }: Props) {
  const tCommon = useTranslations("common");
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
              "flex items-center whitespace-nowrap gap-2 text-nb-gray-300 dark:text-neutral-300 hover:text-nb-gray-100 dark:hover:text-neutral-100 transition-all hover:bg-nb-gray-800/60 py-2 px-3 rounded-md cursor-default"
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
          <div
            className={
              "text-nb-gray-300 dark:text-neutral-300 flex flex-col gap-1"
            }
          >
            <span className={"text-xs"}>{label}</span>
            <span className={"text-nb-gray-200 dark:text-neutral-200"}>
              {dayjs(date).format(tCommon("absoluteDateTime"))}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <EmptyRow />
  );
}
