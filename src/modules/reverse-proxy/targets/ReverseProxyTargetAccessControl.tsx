import HelpText from "@components/HelpText";
import { Label } from "@components/Label";
import {
  SelectDropdown,
  SelectOption,
} from "@components/select/SelectDropdown";
import { LockKeyhole, LockOpen, ShieldX } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  TargetAccessAction,
  type TargetAccessAction as TargetAccessActionValue,
} from "@/interfaces/ReverseProxy";

type Props = {
  value?: string;
  onChange: (value: TargetAccessActionValue) => void;
  privateService: boolean;
};

const isKnownAction = (value: string): value is TargetAccessActionValue =>
  Object.values(TargetAccessAction).some((action) => action === value);

export default function ReverseProxyTargetAccessControl({
  value,
  onChange,
  privateService,
}: Readonly<Props>) {
  const t = useTranslations("reverseProxy");
  const selectedValue = value ?? TargetAccessAction.INHERIT;
  const hasUnsupportedValue = !isKnownAction(selectedValue);

  const options: SelectOption[] = [
    {
      label: t("targetAccessUseServiceAuth"),
      value: TargetAccessAction.INHERIT,
      icon: LockKeyhole,
    },
    {
      label: t("targetAccessBypassAuth"),
      value: TargetAccessAction.BYPASS,
      icon: LockOpen,
      disabled: privateService,
    },
    {
      label: t("targetAccessBlock"),
      value: TargetAccessAction.BLOCK,
      icon: ShieldX,
    },
  ];

  if (hasUnsupportedValue) {
    options.push({
      label: t("targetAccessUnsupportedOption", { value: selectedValue }),
      value: selectedValue,
      disabled: true,
    });
  }

  return (
    <div
      className={"flex items-center justify-between gap-6"}
      data-testid={"target-access-control-setting"}
    >
      <div>
        <Label>{t("targetAccessLabel")}</Label>
        <HelpText className={"mb-0 max-w-sm"}>{t("targetAccessHelp")}</HelpText>
        {privateService && (
          <div data-testid={"target-access-control-private-service"}>
            <HelpText className={"mb-0 mt-1 !text-yellow-400"}>
              {t("targetAccessPrivateServiceWarning")}
            </HelpText>
          </div>
        )}
        {hasUnsupportedValue && (
          <div data-testid={"target-access-action-unsupported"}>
            <HelpText className={"mb-0 mt-1 !text-yellow-400"}>
              {t("targetAccessUnsupportedHelp")}
            </HelpText>
          </div>
        )}
      </div>
      <SelectDropdown
        value={selectedValue}
        onChange={(next) => onChange(next as TargetAccessActionValue)}
        options={options}
        popoverWidth={260}
        className={"w-[260px]"}
        data-testid={"target-access-action"}
      />
    </div>
  );
}
