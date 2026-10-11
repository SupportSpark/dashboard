import Button from "@components/Button";
import { useTranslations } from "next-intl";
import { Callout } from "@components/Callout";
import InlineLink, { InlineButtonLink } from "@components/InlineLink";
import useFetchApi from "@utils/api";
import {
  ChartColumnIcon,
  CheckIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  GaugeIcon,
  KeyRoundIcon,
  ListChecksIcon,
  LucideIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SquareTerminalIcon,
  XCircleIcon,
} from "lucide-react";
import * as React from "react";
import { useEffect, useState } from "react";
import type {
  APIAgentNetworkAccessLog,
  APIAgentNetworkAccessLogsResponse,
} from "@/modules/agent-network/agentAccessLogApi";
import { useAIProviders } from "@/modules/agent-network/AIProvidersProvider";
import { formatDenyReason } from "@/modules/agent-network/data/mockData";
import {
  TEST_REQUEST_LOOKBACK_MS,
  TEST_REQUEST_POLL_MS,
  testRequestLogUrl,
  TestRequestOutcome,
  testRequestOutcome,
} from "@/modules/onboarding/agent-network/testRequest";
import { WaitingForDevice } from "@/modules/onboarding/OnboardingDevices";

const QUICKSTART_DOCS = "https://docs.netbird.io/agent-network/quickstart";

type Props = {
  // deviceName names the operator's device, where the test request has to
  // come from: only a peer in the policy reaches the endpoint.
  deviceName?: string;
  // userId is the operator's: only their own request counts as the test, not
  // another user's traffic on the account.
  userId?: string;
  onBack: () => void;
  onFinish: () => void;
};

// OnboardingAgentEnd asks for a test request and watches the access log for
// it, as the network onboarding asks for a ping. The operator can skip it.
export const OnboardingAgentEnd = ({
  deviceName,
  userId,
  onBack,
  onFinish,
}: Props) => {
  const tonb = useTranslations("onboarding");
  const outcome = useTestRequest(userId);

  if (outcome.kind === "passed") {
    return <AllSet entry={outcome.entry} onBack={onBack} onFinish={onFinish} />;
  }

  return (
    <div className={"relative flex flex-col h-full gap-4"}>
      <div>
        <h1 className={"text-xl text-center max-w-sm mx-auto"}>
          {tonb("sendTestRequest")}
        </h1>
        <div
          className={
            "text-sm text-nb-gray-300 font-light mt-2 block text-center sm:px-4"
          }
        >
          {tonb.rich("agentTestIntro", {
            name: deviceName || tonb("youDeviceFallback"),
            device: (chunks) => (
              <span className={"text-nb-gray-100 whitespace-nowrap"}>
                {chunks}
              </span>
            ),
          })}
        </div>
      </div>

      <TestRequestStatus outcome={outcome} onOpenLogs={onFinish} />

      <div className={"flex items-center justify-center mt-4 gap-3"}>
        <Button variant={"secondary"} onClick={onBack}>
          {tonb("goBack")}
        </Button>
        <Button variant={"secondaryLighter"} onClick={onFinish}>
          {tonb("skip")}
        </Button>
      </div>
    </div>
  );
};

// The dashboard's Agent Network sections, one line each.
const getSections = (
  tonb: ReturnType<typeof useTranslations>,
): { icon: LucideIcon; title: string; description: string }[] => [
  {
    icon: KeyRoundIcon,
    title: tonb("endProviders"),
    description: tonb("endProvidersDesc"),
  },
  {
    icon: ShieldCheckIcon,
    title: tonb("endPolicies"),
    description: tonb("endPoliciesDesc"),
  },
  {
    icon: ListChecksIcon,
    title: tonb("endGuardrails"),
    description: tonb("endGuardrailsDesc"),
  },
  {
    icon: GaugeIcon,
    title: tonb("endBudgets"),
    description: tonb("endBudgetsDesc"),
  },
  {
    icon: ChartColumnIcon,
    title: tonb("endUsage"),
    description: tonb("endUsageDesc"),
  },
  {
    icon: ScrollTextIcon,
    title: tonb("endAccessLogs"),
    description: tonb("endAccessLogsDesc"),
  },
  {
    icon: DatabaseIcon,
    title: tonb("endLogRetention"),
    description: tonb("endLogRetentionDesc"),
  },
  {
    icon: SquareTerminalIcon,
    title: tonb("endAgentSetup"),
    description: tonb("endAgentSetupDesc"),
  },
];

// AllSet is where a passed test request ends the onboarding: it confirms the
// request and lists what the dashboard offers from here.
const AllSet = ({
  entry,
  onBack,
  onFinish,
}: {
  entry: APIAgentNetworkAccessLog;
  onBack: () => void;
  onFinish: () => void;
}) => {
  const tonb = useTranslations("onboarding");
  const SECTIONS = getSections(tonb);
  return (
  <div className={"relative flex flex-col h-full gap-4"}>
    <div>
      <h1 className={"text-xl text-center max-w-sm mx-auto"}>
        {tonb("allSet")}
      </h1>
      <PassedRequest entry={entry} />
    </div>

    <ul
      className={"mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 text-sm"}
      data-testid={"agent-network-sections"}
    >
      {SECTIONS.map(({ icon: Icon, title, description }) => (
        <li key={title} className={"flex items-start gap-3"}>
          <Icon size={16} className={"text-nb-gray-400 shrink-0 mt-0.5"} />
          <div>
            <div className={"text-nb-gray-100"}>{title}</div>
            <div className={"text-nb-gray-400 font-light mt-0.5"}>
              {description}
            </div>
          </div>
        </li>
      ))}
    </ul>

    <div className={"flex items-center justify-center mt-4 gap-3"}>
      <Button variant={"secondary"} onClick={onBack}>
        {tonb("goBack")}
      </Button>
      <Button variant={"primary"} onClick={onFinish}>
        {tonb("finish")}
        <CheckIcon size={16} />
      </Button>
    </div>
  </div>
  );
};

// PassedRequest is the step's subtitle: it names the provider the test
// request was routed to when it is one of the account's.
const PassedRequest = ({ entry }: { entry: APIAgentNetworkAccessLog }) => {
  const tonb = useTranslations("onboarding");
  const { providers } = useAIProviders();
  const provider = providers.find((p) => p.id === entry.resolved_provider_id);

  return (
    <div
      className={
        "text-sm text-nb-gray-300 font-light mt-2 block text-center sm:px-4"
      }
      data-testid={"agent-network-test-passed"}
    >
      {passedSentence(tonb, entry, provider?.name)}
    </div>
  );
};

// passedSentence reads e.g. "Your request reached Anthropic and used 1,234
// tokens.", naming the model when the provider is unknown. `tonb` is passed in
// because this is module scope, where calling the hook itself would throw.
const passedSentence = (
  tonb: ReturnType<typeof useTranslations>,
  entry: APIAgentNetworkAccessLog,
  providerName?: string,
) => {
  const target = providerName || entry.model;
  const tokens =
    entry.total_tokens > 0
      ? tonb("requestUsedTokens", {
          count: entry.total_tokens.toLocaleString(),
        })
      : "";
  if (!target) return tonb("requestWentThrough", { tokens });
  return tonb("requestReachedProvider", { provider: target, tokens });
};

// TestRequestStatus shows what became of the latest request. onOpenLogs leaves
// the onboarding for the Access Logs, as the onboarding covers every page
// while it is open.
const TestRequestStatus = ({
  outcome,
  onOpenLogs,
}: {
  outcome: Exclude<TestRequestOutcome, { kind: "passed" }>;
  onOpenLogs: () => void;
}) => {
  const tonb = useTranslations("onboarding");
  // The deny-reason labels that formatDenyReason resolves live in the
  // `agentNetwork` catalog, not `onboarding`. Passing the wrong translator made
  // next-intl echo the key back ("onboarding.denyReasonModelNotAvailable"),
  // which rendered as-is in the callout.
  const tan = useTranslations("agentNetwork");
  if (outcome.kind === "waiting") {
    return <WaitingForDevice text={tonb("waitingForFirstRequest")} />;
  }

  const { entry } = outcome;
  const forModel = entry.model
    ? tonb("requestForModel", { model: entry.model })
    : "";

  return (
    <div className={"flex flex-col"}>
      <Callout
        variant={outcome.kind === "denied" ? "error" : "warning"}
        icon={<XCircleIcon size={16} className={"shrink-0 mt-0.5"} />}
        data-testid={`agent-network-test-${outcome.kind}`}
      >
        <p>
          {outcome.kind === "denied"
            ? tonb("lastRequestDenied", {
                forModel,
                reason:
                  formatDenyReason(entry.deny_reason, tan) || tonb("noReasonGiven"),
              })
            : tonb("lastRequestStatus", {
                forModel,
                status: entry.status_code,
              })}
        </p>
        <p className={"mt-1"}>
          {tonb("learnMoreInThe")}{" "}
          <InlineButtonLink variant={"dashed"} onClick={onOpenLogs}>
            {tonb("accessLogs")}
          </InlineButtonLink>{" "}
          {tonb("orThe")}{" "}
          <InlineLink
            variant={"dashed"}
            href={QUICKSTART_DOCS}
            target={"_blank"}
          >
            {tonb("docs")}
            <ExternalLinkIcon size={12} />
          </InlineLink>
          .
        </p>
      </Callout>
      <WaitingForDevice text={tonb("waitingForNextRequest")} />
    </div>
  );
};

// windowStart opens the window the test request is looked for in.
const windowStart = () => new Date(Date.now() - TEST_REQUEST_LOOKBACK_MS);

// useTestRequest reads the operator's newest request since shortly before the
// step opened, until one passes. It reads nothing until it knows the operator.
// A timer drives the reads, not SWR's focus revalidation, so a passed request
// stays on screen.
function useTestRequest(userId?: string): TestRequestOutcome {
  const [since] = useState(windowStart);
  const { data, mutate } = useFetchApi<APIAgentNetworkAccessLogsResponse>(
    testRequestLogUrl(since, userId ?? ""),
    true,
    false,
    !!userId,
    { shouldRetryOnError: false },
  );
  const outcome = testRequestOutcome(data?.data?.[0]);
  const watching = !!userId && outcome.kind !== "passed";

  useEffect(() => {
    if (!watching) return;
    const timer = setInterval(() => mutate(), TEST_REQUEST_POLL_MS);
    return () => clearInterval(timer);
  }, [watching, mutate]);

  return outcome;
}
