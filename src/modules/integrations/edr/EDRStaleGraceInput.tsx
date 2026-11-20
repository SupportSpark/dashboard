import FancyToggleSwitch from "@components/FancyToggleSwitch";
import FullTooltip from "@components/FullTooltip";
import HelpText from "@components/HelpText";
import { Input } from "@components/Input";
import { Label } from "@components/Label";
import Separator from "@components/Separator";
import { IconInfoCircle } from "@tabler/icons-react";
import { cn } from "@utils/helpers";
import { HourglassIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export const DEFAULT_STALE_GRACE = 30;
const MAX_STALE_GRACE = 240;

export const isValidStaleGrace = (enabled: boolean, value: string) => {
  if (!enabled) return true;
  const minutes = Number(value);
  return (
    Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_STALE_GRACE
  );
};

type Props = {
  name: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  newPeers: boolean;
  onNewPeersChange: (newPeers: boolean) => void;
  className?: string;
};

export const EDRStaleGraceInput = ({
  name,
  enabled,
  onEnabledChange,
  value,
  onChange,
  newPeers,
  onNewPeersChange,
  className,
}: Props) => {
  const t = useTranslations("integrations");

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <Separator />
      <FancyToggleSwitch
        variant={"blank"}
        value={enabled}
        onChange={onEnabledChange}
        label={
          <>
            <HourglassIcon size={14} />
            {t("edrStaleGraceLabel")}
          </>
        }
        helpText={<>{t("edrStaleGraceHelp", { name })}</>}
      >
        <div className={"flex flex-row gap-3 w-full justify-between"}>
          <div>
            <Label htmlFor={"stale-grace"}>{t("edrStaleGraceDuration")}</Label>
            <FullTooltip
              interactive={false}
              content={
                <div className={"max-w-xs text-xs"}>
                  {t("edrStaleGraceExample", {
                    minutes: DEFAULT_STALE_GRACE,
                    name,
                  })}
                </div>
              }
            >
              <HelpText className={"max-w-sm"} margin={false}>
                {t("edrStaleGraceDurationHelp")}
                <IconInfoCircle
                  size={14}
                  className={"relative inline ml-1 -top-[1px]"}
                />
              </HelpText>
            </FullTooltip>
          </div>

          <Input
            id={"stale-grace"}
            placeholder={DEFAULT_STALE_GRACE.toString()}
            min={1}
            max={MAX_STALE_GRACE}
            className={"w-full min-w-[130px] ml-auto"}
            value={value}
            type={"number"}
            error={
              isValidStaleGrace(enabled, value)
                ? undefined
                : t("edrStaleGraceInvalid", { max: MAX_STALE_GRACE })
            }
            errorTooltip={true}
            onChange={(e) => onChange(e.target.value)}
            customSuffix={t("edrStaleGraceUnit")}
          />
        </div>

        <FancyToggleSwitch
          variant={"blank"}
          className={"mt-5"}
          value={newPeers}
          onChange={onNewPeersChange}
          label={t("edrStaleGraceNewPeersLabel")}
          helpText={<>{t("edrStaleGraceNewPeersHelp", { name })}</>}
        />
      </FancyToggleSwitch>
    </div>
  );
};
