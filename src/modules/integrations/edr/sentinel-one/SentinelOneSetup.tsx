import Button from "@components/Button";
import { Checkbox } from "@components/Checkbox";
import FullTooltip from "@components/FullTooltip";
import InlineLink from "@components/InlineLink";
import { Input } from "@components/Input";
import { Label } from "@components/Label";
import { Modal, ModalContent, ModalFooter } from "@components/modal/Modal";
import { notify } from "@components/Notification";
import { SelectDropdown } from "@components/select/SelectDropdown";
import Steps from "@components/Steps";
import { GradientFadedBackground } from "@components/ui/GradientFadedBackground";
import { Lightbox } from "@components/ui/Lightbox";
import { Mark } from "@components/ui/Mark";
import { MinimalList } from "@components/ui/MinimalList";
import { IconArrowLeft, IconArrowRight, IconInfoCircle } from "@tabler/icons-react";
import { useApiCall } from "@utils/api";
import { cn, validator } from "@utils/helpers";
import { isEmpty } from "lodash";
import {
  Box,
  Clock4,
  ExternalLinkIcon,
  FolderGit2,
  GlobeIcon,
  KeyRound,
  PlusCircle,
  RefreshCcw,
  Repeat,
  Settings2,
  Shield,
  ShieldCheckIcon
} from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useMemo, useReducer, useState } from "react";
import { useSWRConfig } from "swr";
import integrationImage from "@/assets/integrations/sentinelone.png";
import HelpText from "@/components/HelpText";
import { PeerGroupSelector } from "@/components/PeerGroupSelector";
import { Account } from "@/interfaces/Account";
import { DEFAULT_SENTINELONE_MATCH_ATTRIBUTES, SentinelOneIntegration } from "@/interfaces/EDR";
import useGroupHelper from "@/modules/groups/useGroupHelper";
import { isValidSentinelOneApiUrl, matchAttributesReducer } from "@/modules/integrations/edr/sentinel-one/SentinelOne";
import { SentinelOneMatchSettings } from "@/modules/integrations/edr/sentinel-one/SentinelOneMatchSettings";
import SentinelOneUrlInput from "@/modules/integrations/edr/sentinel-one/SentinelOneUrlInput";
import { IntegrationModalHeader } from "@/modules/integrations/IntegrationModalHeader";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  account: Account;
};

export default function SentinelOneSetup({
  open,
  onOpenChange,
  onSuccess,
  account,
}: Props) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} key={open ? 1 : 0}>
      <SetupContent
        account={account}
        onSuccess={() => {
          onOpenChange(false);
          onSuccess && onSuccess();
        }}
      />
    </Modal>
  );
}

type ModalProps = {
  onSuccess: () => void;
  account: Account;
};

export function SetupContent({ onSuccess, account }: Readonly<ModalProps>) {
  const t = useTranslations("integrations");
  const tWave = useTranslations("integrationsWave2");
  const tCommon = useTranslations("common");
  const { mutate } = useSWRConfig();
  const sentinelOneRequest = useApiCall<SentinelOneIntegration>(
    "/integrations/edr/sentinelone",
  );

  const settingsRequest = useApiCall<Account>("/accounts/" + account.id);

  const [step, setStep] = useState(0);
  const maxSteps = 5;

  const [apiUrl, setApiUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [lastSyncedInterval, setLastSyncedInterval] = useState("24");

  const [matchAttributes, dispatchMatchAttributes] = useReducer(
    matchAttributesReducer,
    DEFAULT_SENTINELONE_MATCH_ATTRIBUTES,
  );

  const [groups, setGroups, { save: saveGroups }] = useGroupHelper({
    initial: [],
  });

  const apiTokenEntered = !isEmpty(apiToken);
  const apiUrlEntered = !isEmpty(apiUrl);
  const allEntered = apiUrlEntered && apiTokenEntered;

  const isValidApiUrl = useMemo(() => {
    return isValidSentinelOneApiUrl(apiUrl);
  }, [apiUrl]);

  const isDisabled =
    (step == 1 && !isValidApiUrl) ||
    (step == 2 && !allEntered) ||
    (step == 3 && groups.length == 0);

  const connect = async () => {
    await settingsRequest.put({
      id: account.id,
      settings: {
        ...account.settings,
        peer_login_expiration_enabled:
          account?.settings?.peer_login_expiration_enabled,
        peer_login_expiration: account?.settings?.peer_login_expiration,
        extra: {
          ...account.settings?.extra,
          peer_approval_enabled: false,
        },
      },
    });

    const savedGroups = await saveGroups();

    notify({
      title: t("integrationLinkText", { name: "SentinelOne" }),
      description: t("integrationWasConnectedToNetBird", { name: "SentinelOne" }),
      promise: sentinelOneRequest
        .post({
          api_token: apiToken,
          api_url: apiUrl,
          groups: savedGroups.map((group) => group.id) || [],
          last_synced_interval: Number(lastSyncedInterval || 24),
          match_attributes: matchAttributes,
        })
        .then(() => {
          mutate("/accounts");
          mutate("/integrations/edr/sentinelone");
          onSuccess();
        }),
      loadingMessage: t("settingUpIntegration"),
    });
  };

  const modalWidth = {
    0: "max-w-lg",
    1: "max-w-lg",
    2: "max-w-xl",
    3: "max-w-lg",
    4: "max-w-xl",
    5: "max-w-lg",
  };

  const sentinelOneServiceUsersUrl = useMemo(() => {
    try {
      if (!apiUrl) return undefined;
      let url = apiUrl.trim();
      const sentinelOneIndex = url.indexOf("sentinelone.net");
      if (sentinelOneIndex === -1) return undefined;
      url = url.substring(0, sentinelOneIndex + "sentinelone.net".length);
      if (validator.isValidUrl(apiUrl)) {
        return url + "/settings/users/service-users";
      } else {
        return;
      }
    } catch (e) {
      return;
    }
  }, [apiUrl]);

  return (
    <ModalContent
      maxWidthClass={cn(
        "relative",
        modalWidth[step as keyof typeof modalWidth],
      )}
      showClose={true}
      className={""}
      onEscapeKeyDown={(e) => step > 0 && e.preventDefault()}
      onInteractOutside={(e) => step > 0 && e.preventDefault()}
      onPointerDownOutside={(e) => step > 0 && e.preventDefault()}
    >
      <GradientFadedBackground />

      {step > 0 && (
        <div className={"flex gap-2 w-full items-center justify-center mb-4"}>
          {Array.from({ length: maxSteps }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-8 h-1 rounded-full bg-nb-gray-800",
                step >= index + 1 && "bg-netbird",
              )}
            />
          ))}
        </div>
      )}

      <IntegrationModalHeader
        image={integrationImage}
        title={t("connectNetBirdWith", { name: "SentinelOne" })}
        description={t("sentineloneSetupDescription")}
      />

      {step == 0 && (
        <div
          className={
            "px-8 py-3 flex z-0 flex-col gap-0 text-sm mb-3 text-center justify-center items-center"
          }
        >
          <div
            className={
              "mt-6 text-base font-medium text-nb-gray-100 flex gap-2 items-center justify-center"
            }
          >
            <Shield size={16} />
            {t("requiredPermissions")}
          </div>
          <p className={"mt-2 !text-nb-gray-300 !leading-[1.5]"}>
            {t.rich("sentinelonePermissionsIntro", {
              accent: (chunks) => (
                <span className={"text-nb-gray-100 font-semibold"}>
                  {chunks}
                </span>
              ),
            })}
          </p>
          <div
            className={
              "flex items-center flex-col gap-0 mt-2 w-full justify-center max-w-lg"
            }
          >
            <div
              className={
                "py-2 px-6 flex items-center gap-2 rounded-md w-full justify-center bg-nb-gray-930/0 text-nb-gray-200"
              }
            >
              <PlusCircle size={14} className={"text-sky-500"} />
              {t("sentinelonePermissionsLine1")}
            </div>
            <div
              className={
                "py-2 px-6 flex items-center gap-2 rounded-md w-full justify-center bg-nb-gray-930/0 text-nb-gray-200"
              }
            >
              <Settings2 size={14} className={"text-sky-500"} />
              {t("sentinelonePermissionsLine2")}
            </div>
          </div>
        </div>
      )}

      {step == 1 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <GlobeIcon size={18} />
            {t("sentineloneConsoleUrlTitle")}
          </p>

          <Steps>
            <Steps.Step step={1}>
              <p>{t("sentineloneNavigateConsole")}</p>
            </Steps.Step>

            <Steps.Step step={2} line={false}>
              <p>{t("sentineloneCopyUrlStep")}</p>
            </Steps.Step>
          </Steps>

          <div className={"mb-4"}>
            <SentinelOneUrlInput value={apiUrl} setValue={setApiUrl} />
          </div>
        </div>
      )}

      {step == 2 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <Box size={20} />
            {t("sentineloneCreateTokenTitle")}
          </p>
          <Steps>
            <Steps.Step step={1}>
              <p className={"font-normal"}>
                {sentinelOneServiceUsersUrl ? (
                  t.rich("sentineloneServiceUsersStep", {
                    link: (chunks) => (
                      <InlineLink
                        href={sentinelOneServiceUsersUrl}
                        target={"_blank"}
                      >
                        {chunks}
                        <ExternalLinkIcon size={14} className={"ml-1"} />
                      </InlineLink>
                    ),
                  })
                ) : (
                  <Mark>{t("sentineloneServiceUsersPath")}</Mark>
                )}
              </p>
            </Steps.Step>
            <Steps.Step step={1}>
              <p className={"font-normal"}>
                {t.rich("sentineloneCreateServiceUserStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={3}>
              <p className={"font-normal"}>
                {t.rich("sentineloneNameStep", {
                  copy: (chunks) => <Mark copy>{chunks}</Mark>,
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
            <Steps.Step step={4} line={false}>
              <p className={"font-normal"}>
                {t.rich("sentineloneScopeStep", {
                  mark: (chunks) => <Mark>{chunks}</Mark>,
                  br: () => <br />,
                })}
              </p>
            </Steps.Step>
          </Steps>

          <div className={"mb-4"}>
            <Input
              type={"text"}
              className={"w-full"}
              customPrefix={
                <div className={"flex items-center gap-2"}>
                  <KeyRound size={16} className={"text-nb-gray-300"} />
                </div>
              }
              placeholder={
                "eyJraWQiOiJ1cy1lYXN0LTEtcHJvZC0wIiwiYWxnIjoiRVMyNTYifQ.eyJzdWIiOiJzZXJ2aWNldXNlci1lYjFiNmNhNy00Y2IxLTRjNjQtYWUyZS0wMTQwMDk2YjczYTVAbWdtdC"
              }
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
            />
          </div>
        </div>
      )}

      {step == 3 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4 mb-3"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <FolderGit2 size={16} />
            {t("peerApproval")}
          </p>

          <HelpText className={"max-w-lg mt-2"}>
            {tWave("sentineloneApplyGroupsHelp")}
          </HelpText>

          <PeerGroupSelector values={groups} onChange={setGroups} />
        </div>
      )}

      {step == 4 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4 mb-3"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <ShieldCheckIcon size={16} />
            {t("complianceRequirements")}
          </p>
          <p className={"mt-2 !text-nb-gray-300 !leading-[1.5]"}>
            {t("requirementsHelp")}
          </p>

          <SentinelOneMatchSettings
            value={matchAttributes}
            dispatch={dispatchMatchAttributes}
          />
        </div>
      )}

      {step == 5 && (
        <div className={"px-8 py-3 flex flex-col gap-0 mt-4 mb-3"}>
          <p className={"font-medium flex gap-3 items-center text-base"}>
            <RefreshCcw size={16} />
            {tWave("sentineloneSyncWindowTitle")}
          </p>
          <div className={"mt-2 flex flex-row gap-3"}>
            <FullTooltip
              interactive={false}
              content={
                <div className={"max-w-xs text-xs"}>
                  {tWave("sentineloneSyncWindowExample")}
                </div>
              }
            >
              <HelpText className={"max-w-lg"}>
                {tWave("sentineloneSyncWindowHelp")}
                <IconInfoCircle
                  size={14}
                  className={"relative inline ml-1 -top-[1px]"}
                />
              </HelpText>
            </FullTooltip>
            <Input
              placeholder={"24"}
              min={24}
              max={336}
              className={"w-full min-w-[130px]"}
              value={lastSyncedInterval}
              type={"number"}
              onChange={(e) => setLastSyncedInterval(e.target.value)}
              customSuffix={t("hoursSuffix")}
            />
          </div>
        </div>
      )}

      <ModalFooter className={"items-center gap-4"}>
        {step > 0 && (
          <Button
            variant={"secondary"}
            className={"w-full"}
            onClick={() => setStep(step - 1)}
          >
            <IconArrowLeft size={16} />
            {tCommon("back")}
          </Button>
        )}
        {step >= 0 && step < maxSteps && (
          <Button
            variant={"primary"}
            className={"w-full"}
            disabled={isDisabled}
            onClick={() => setStep(step + 1)}
          >
            {step == 0 ? t("getStarted") : tCommon("continue")}
            <IconArrowRight size={16} />
          </Button>
        )}
        {step == maxSteps && (
          <Button
            variant={"primary"}
            className={"w-full"}
            disabled={isDisabled}
            onClick={connect}
          >
            <Repeat size={16} />
            {t("connect")}
          </Button>
        )}
      </ModalFooter>
      {step == 0 && (
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
              {t("setupDuration", { duration: "10-20" })}
            </span>
          </div>
        </div>
      )}
    </ModalContent>
  );
}
