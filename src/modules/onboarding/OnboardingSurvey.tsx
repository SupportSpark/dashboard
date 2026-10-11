import { useOidcUser } from "@axa-fr/react-oidc";
import Button from "@components/Button";
import ButtonGroup from "@components/ButtonGroup";
import { Checkbox } from "@components/Checkbox";
import HelpText from "@components/HelpText";
import { Input } from "@components/Input";
import { Label } from "@components/Label";
import { SegmentedTabs } from "@components/SegmentedTabs";
import { SelectDropdown, SelectOption } from "@components/select/SelectDropdown";
import { cn } from "@utils/helpers";
import {
  BriefcaseIcon,
  FolderIcon,
  Gamepad2,
  HomeIcon,
  Laptop,
  Layers,
  Server,
  ShieldCheck,
  UserIcon,
  Waypoints,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useLoggedInUser } from "@/contexts/UsersProvider";
import { HubspotFormField } from "@/contexts/AnalyticsProvider";

type Props = {
  domainCategory: string;
  onSubmit?: (fields: HubspotFormField[]) => void;
};

export const companySizes = [
  {
    label: "1-5",
    value: "1",
  },
  {
    label: "5-50",
    value: "5",
  },
  {
    label: "50-300",
    value: "50",
  },
  {
    label: "300-1000",
    value: "300",
  },
  {
    label: "1000+",
    value: "1000",
  },
];

// Referral-source options for the signup survey. The LABEL is localized; the
// VALUE stays the English short name because it is sent to HubSpot as the
// `how_did_you_hear_about_us` field.
const referralSourceValues: { key: string; value: string }[] = [
  { key: "searchEngines", value: "Search Engines (Google, Bing etc.)" },
  { key: "coworkerOrFriend", value: "Coworker or Friend" },
  { key: "tradeShowOrEvent", value: "Trade Show or Event" },
  { key: "blogs", value: "Blogs" },
  { key: "comparisonSites", value: "Comparison Sites" },
  { key: "slack", value: "Slack" },
  { key: "other", value: "Other" },
  { key: "netbirdYoutubeChannel", value: "NetBird YouTube Channel" },
  { key: "otherYoutubeChannel", value: "Other YouTube Channel" },
  { key: "netbirdSubreddit", value: "NetBird SubReddit" },
  { key: "otherRedditThread", value: "Other Reddit Thread" },
  { key: "github", value: "GitHub" },
];

/** Build the referral-source options; `t` is bound to the `onboarding` namespace. */
export function getReferralSourceOptions(
  t: (key: string) => string,
): SelectOption[] {
  return referralSourceValues.map((option) => ({
    label: t(option.key),
    value: option.value,
  }));
}

export const OnboardingSurvey = ({ domainCategory, onSubmit }: Props) => {
  const t = useTranslations("onboarding");
  const { oidcUser: user } = useOidcUser();
  const name = user?.given_name || user?.name || user?.preferred_username;
  const welcomeMessage = name
    ? t("surveyWelcomeNamed", { name })
    : t("surveyWelcome");

  const isPrivate = domainCategory === "private";
  const [personalOrBusiness, setPersonalOrBusiness] = useState(
    isPrivate ? "business" : "personal",
  );
  const [companySize, setCompanySize] = useState<string>("");
  const isCompanySizeSelected = (size: string) => companySize === size;
  const isBusiness = personalOrBusiness === "business";

  const [homelab, setHomelab] = useState(false);
  const [remoteAccess, setRemoteAccess] = useState(false);
  const [homeRemoteAccess, setHomeRemoteAccess] = useState(false);
  const [fileAccess, setFileAccess] = useState(false);
  const [gaming, setGaming] = useState(false);
  const [zeroTrust, setZeroTrust] = useState(false);
  const [ioT, setIoT] = useState(false);
  const [siteToSite, setSiteToSite] = useState(false);
  const [businessVPN, setBusinessVPN] = useState(false);
  const [referralSource, setReferralSource] = useState("");
  const [msp, setMsp] = useState(false);

  const [other, setOther] = useState(false);
  const [otherUseCase, setOtherUseCase] = useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { loggedInUser } = useLoggedInUser();

  const getUseCases = () => {
    const hl = homelab && !isBusiness ? "Homelab Automation" : "";
    const hra = homeRemoteAccess && !isBusiness ? "Home Remote Access" : "";
    const fa = fileAccess && !isBusiness ? "File Access" : "";
    const g = gaming && !isBusiness ? "Gaming" : "";

    const zt = zeroTrust && isBusiness ? "Zero Trust Security" : "";
    const ra = remoteAccess && isBusiness ? "Employee Remote Access" : "";
    const bv = businessVPN && isBusiness ? "Business VPN" : "";
    const st = siteToSite && isBusiness ? "Site-to-Site Connectivity" : "";
    const iot = ioT && isBusiness ? "IoT (Internet of Things)" : "";
    const mp = msp && isBusiness ? "MSP (Managed Service Provider)" : "";

    const ou = other ? otherUseCase : "";
    return [hl, hra, fa, g, zt, ra, bv, st, iot, mp, ou]
      .filter((s) => s != "")
      .join(", ");
  };

  const hasSelectedUseCase = useMemo(() => {
    if (isBusiness) {
      return (
        zeroTrust ||
        remoteAccess ||
        businessVPN ||
        siteToSite ||
        ioT ||
        msp ||
        (other && otherUseCase !== "")
      );
    } else {
      return (
        homelab ||
        homeRemoteAccess ||
        fileAccess ||
        gaming ||
        (other && otherUseCase !== "")
      );
    }
  }, [
    businessVPN,
    fileAccess,
    gaming,
    homeRemoteAccess,
    homelab,
    ioT,
    isBusiness,
    other,
    otherUseCase,
    remoteAccess,
    siteToSite,
    zeroTrust,
    msp,
  ]);

  const hasCompanySizeSelected = useMemo(() => {
    return companySize !== "";
  }, [companySize]);

  const hasHowDidYouHearAboutUsSelected = useMemo(() => {
    return referralSource !== "";
  }, [referralSource]);

  const canSubmit = useMemo(() => {
    if (isBusiness) {
      return (
        hasCompanySizeSelected &&
        hasSelectedUseCase &&
        hasHowDidYouHearAboutUsSelected
      );
    } else {
      return hasSelectedUseCase && hasHowDidYouHearAboutUsSelected;
    }
  }, [
    hasSelectedUseCase,
    isBusiness,
    hasCompanySizeSelected,
    hasHowDidYouHearAboutUsSelected,
  ]);

  const randomizedOptions = useMemo(() => {
    return getReferralSourceOptions(t).sort(() => Math.random() - 0.5);
  }, [t]);

  const submitForm = () => {
    let fields: HubspotFormField[] = [];
    try {
      // Fallback: use OIDC user email if loggedInUser?.email is missing
      const email = loggedInUser?.email || user?.email || "";
      if (loggedInUser || user) {
        fields = [
          {
            name: "email",
            value: email,
          },
          {
            name: "is_company",
            value: personalOrBusiness === "business" ? "Business" : "Personal",
          },
          {
            name: "use_case",
            value: getUseCases(),
          },
          {
            name: "how_did_you_hear_about_us",
            value: referralSource || "Other",
          },
        ];

        let accountCategory;
        switch (personalOrBusiness) {
          case "business":
            accountCategory = "business";
            break;
          case "personal":
            accountCategory = "personal";
            break;
          default:
            accountCategory = "unknown";
        }

        fields.push({
          name: "account_category",
          value: accountCategory,
        });

        if (domainCategory) {
          if (domainCategory === "business") {
            fields.push({
              name: "0-2/domain",
              value: email.split("@")[1] || "",
            });
          }
        }

        if (personalOrBusiness === "business" && companySize !== "") {
          fields.push({
            name: "planned_users",
            value: companySize,
          });
        }
      }
    } catch (e) {}
    onSubmit?.(fields);
  };

  return (
    <>
      <div className={"relative"}>
        <h1 className={"text-xl text-center"}>{welcomeMessage}</h1>
        <div
          className={
            "text-sm text-nb-gray-300 font-light mt-2 block text-center max-w-md px-10"
          }
        >
          {t("surveyIntro")}
        </div>
        <div className={"flex flex-col mt-8 z-0 gap-8"}>
          <SegmentedTabs
            value={personalOrBusiness}
            onChange={setPersonalOrBusiness}
          >
            <SegmentedTabs.List className={"rounded-lg border"}>
              <SegmentedTabs.Trigger value={"business"}>
                <BriefcaseIcon size={16} />
                {t("business")}
              </SegmentedTabs.Trigger>
              <SegmentedTabs.Trigger value={"personal"}>
                <UserIcon size={16} />
                {t("personal")}
              </SegmentedTabs.Trigger>
            </SegmentedTabs.List>
          </SegmentedTabs>

          {personalOrBusiness === "business" && (
            <div className={"flex w-full flex-col gap-2"}>
              <div>
                <Label>
                  {t("companySizeQuestion")}
                  <RequiredAsterisk />
                </Label>
              </div>
              <ButtonGroup>
                {companySizes.map((size) => (
                  <ButtonGroup.Button
                    key={size.value}
                    className={"w-full"}
                    onClick={() => setCompanySize(size.value)}
                    variant={
                      isCompanySizeSelected(size.value)
                        ? "tertiary"
                        : "secondary"
                    }
                  >
                    {size.label}
                  </ButtonGroup.Button>
                ))}
              </ButtonGroup>
            </div>
          )}

          <div className={"flex w-full flex-col gap-2"}>
            <Label>
              {t("referralQuestion")}
              <RequiredAsterisk />
            </Label>
            <SelectDropdown
              value={referralSource}
              onChange={setReferralSource}
              options={randomizedOptions}
              showValues={false}
              placeholder={t("selectAnOptionPlaceholder")}
              variant={"dropdown"}
            />
          </div>

          <div className={"flex w-full flex-col gap-2"}>
            <div>
              <Label>
                {t("useCaseQuestion")}
                <RequiredAsterisk />
              </Label>
              <HelpText className={"mt-1.5"}>{t("useCaseHelp")}</HelpText>
            </div>

            <div className={"flex flex-col gap-3"}>
              {isBusiness ? (
                <>
                  <OnboardingCheckbox value={zeroTrust} setValue={setZeroTrust}>
                    <ShieldCheck size={16} />
                    {t("useCaseZeroTrust")}
                  </OnboardingCheckbox>
                  <OnboardingCheckbox
                    value={remoteAccess}
                    setValue={setRemoteAccess}
                  >
                    <Laptop size={16} />
                    {t("useCaseEmployeeRemoteAccess")}
                  </OnboardingCheckbox>
                  <OnboardingCheckbox
                    value={businessVPN}
                    setValue={setBusinessVPN}
                  >
                    <BriefcaseIcon size={16} />
                    {t("useCaseBusinessVpn")}
                  </OnboardingCheckbox>
                  <OnboardingCheckbox
                    value={siteToSite}
                    setValue={setSiteToSite}
                  >
                    <Layers size={16} />
                    {t("useCaseSiteToSite")}
                  </OnboardingCheckbox>
                  <OnboardingCheckbox value={ioT} setValue={setIoT}>
                    <Waypoints size={16} />
                    {t("useCaseIot")}
                  </OnboardingCheckbox>
                  <OnboardingCheckbox value={msp} setValue={setMsp}>
                    <Server size={15} />
                    {t("useCaseMsp")}
                  </OnboardingCheckbox>
                </>
              ) : (
                <>
                  <OnboardingCheckbox value={homelab} setValue={setHomelab}>
                    <HomeIcon size={16} />
                    {t("useCaseHomelab")}
                  </OnboardingCheckbox>
                  <OnboardingCheckbox
                    value={homeRemoteAccess}
                    setValue={setHomeRemoteAccess}
                  >
                    <Laptop size={16} />
                    {t("useCaseHomeRemoteAccess")}
                  </OnboardingCheckbox>
                  <OnboardingCheckbox
                    value={fileAccess}
                    setValue={setFileAccess}
                  >
                    <FolderIcon size={16} />
                    {t("useCaseFileAccess")}
                  </OnboardingCheckbox>
                  <OnboardingCheckbox value={gaming} setValue={setGaming}>
                    <Gamepad2 size={16} />
                    {t("useCaseGaming")}
                  </OnboardingCheckbox>
                </>
              )}

              <label
                className={
                  "text-neutral-500 dark:text-nb-gray-300 font-normal flex items-center gap-4 cursor-pointer"
                }
              >
                <Checkbox
                  checked={other}
                  onCheckedChange={(v) => {
                    setOther(!other);
                    inputRef.current?.focus();
                  }}
                />
                <div
                  className={
                    "flex items-center gap-1.5 whitespace-nowrap text-sm select-none"
                  }
                >
                  {t("otherPleaseSpecify")}
                </div>
              </label>
            </div>

            <div
              className={cn(
                !other && "!h-0 opacity-0",
                "mt-2",
                other && "mb-3",
              )}
            >
              <Input
                ref={inputRef}
                placeholder={
                  isBusiness
                    ? t("otherUseCaseBusinessPlaceholder")
                    : t("otherUseCasePersonalPlaceholder")
                }
                value={otherUseCase}
                onChange={(e) => setOtherUseCase(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <Button
        variant={"primary"}
        className={"w-full mt-4"}
        onClick={submitForm}
        disabled={!canSubmit}
      >
        {t("continue")}
      </Button>
    </>
  );
};

const OnboardingCheckbox = ({
  value,
  setValue,
  children,
}: {
  value: boolean;
  setValue: (value: boolean) => void;
  children: React.ReactNode;
}) => {
  return (
    <label
      className={
        "text-neutral-500 dark:text-nb-gray-300 font-normal flex items-center gap-4 cursor-pointer"
      }
    >
      <Checkbox checked={value} onCheckedChange={setValue} />
      <div
        className={
          "flex items-center gap-1.5 whitespace-nowrap text-sm select-none"
        }
      >
        {children}
      </div>
    </label>
  );
};

const RequiredAsterisk = () => (
  <span className={"text-red-500 relative -top-[2.5px]"}>*</span>
);
