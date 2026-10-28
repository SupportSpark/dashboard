import FullTooltip from "@components/FullTooltip";
import HelpText from "@components/HelpText";
import { Input } from "@components/Input";
import { Label } from "@components/Label";
import Separator from "@components/Separator";
import { IconInfoCircle } from "@tabler/icons-react";
import { cn } from "@utils/helpers";
import { TimerIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export const DEFAULT_SYNC_INTERVAL = 1;
const MAX_SYNC_INTERVAL = 1440;

export const isValidSyncInterval = (value: string) => {
  const minutes = Number(value);
  return (
    Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_SYNC_INTERVAL
  );
};

type Props = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export const EDRSyncIntervalInput = ({
  name,
  value,
  onChange,
  className,
}: Props) => {
  const t = useTranslations("integrations");

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <Separator />
      <div className={"flex flex-row gap-3 w-full justify-between"}>
        <div>
          <Label htmlFor={"sync-interval"}>
            <div className={"flex gap-2 items-center"}>
              <TimerIcon size={14} />
              {t("edrSyncFrequency")}
            </div>
          </Label>
          <FullTooltip
            interactive={false}
            content={
              <div className={"max-w-xs text-xs"}>
                {t("edrSyncFrequencyTooltip", { name })}
              </div>
            }
          >
            <HelpText className={"max-w-sm mt-1"}>
              {t("edrSyncFrequencyHelp", { name })}{" "}
              <span className={"whitespace-nowrap"}>
                <IconInfoCircle
                  size={14}
                  className={"relative inline ml-1 -top-[1px]"}
                />
              </span>
            </HelpText>
          </FullTooltip>
        </div>

        <Input
          id={"sync-interval"}
          placeholder={DEFAULT_SYNC_INTERVAL.toString()}
          min={1}
          max={MAX_SYNC_INTERVAL}
          className={"w-full min-w-[130px] ml-auto"}
          value={value}
          type={"number"}
          error={
            isValidSyncInterval(value)
              ? undefined
              : t("edrSyncIntervalInvalid", { max: MAX_SYNC_INTERVAL })
          }
          errorTooltip={true}
          onChange={(e) => onChange(e.target.value)}
          customSuffix={t("edrSyncIntervalUnit")}
        />
      </div>
    </div>
  );
};
