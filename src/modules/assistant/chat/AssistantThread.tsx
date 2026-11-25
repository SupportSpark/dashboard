"use client";

import {
  ActionBarPrimitive,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import Paragraph from "@components/Paragraph";
import { cn } from "@utils/helpers";
import { ArrowDown, ArrowUp, Cable, Check, ChevronRight, Copy, History, PenLine, RotateCw, ShieldCheck, Square } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import NetBirdLogoMark from "@/assets/netbird.svg";
import { useLoggedInUser } from "@/contexts/UsersProvider";
import useCopyToClipboard from "@/hooks/useCopyToClipboard";
import type { PageContextEntry } from "@/interfaces/Assistant";
import { CHAT_PAD } from "@/interfaces/Assistant";
import { useAssistant } from "@/modules/assistant/hooks/useAssistant";
import { acceptsFreeText, type PendingInputRequest } from "@/modules/assistant/hooks/useBrowserToolLoop";
import { describeAssistantError } from "@/modules/assistant/lib/session-client";
import {
  type AssistantTranslator,
  translate,
} from "@/modules/assistant/lib/tools";
import {
  AssistantApprovalGate,
  AssistantOpenQuestionCard,
  isOpenQuestion,
} from "@/modules/assistant/chat/AssistantApprovalCard";
import { AssistantContextChip } from "@/modules/assistant/chat/AssistantContextChip";
import { AssistantErrorNotice } from "@/modules/assistant/chat/AssistantErrorNotice";
import { AssistantInlineComponent } from "@/modules/assistant/chat/AssistantInlineComponent";
import { AssistantMarkdownText } from "@/modules/assistant/chat/AssistantMarkdownText";
import {
  type AssistantQuestion,
  AssistantQuestionCard,
  numbersPickOptions,
  parseOptionNumbers,
} from "@/modules/assistant/chat/AssistantQuestionCard";
import { AssistantToolActivity } from "@/modules/assistant/chat/AssistantToolActivity";
import { TurnActiveContext } from "@/modules/assistant/chat/AssistantTurnContext";
import { useArmingDelay } from "@/modules/assistant/chat/useArmingDelay";

const SCROLLBAR_WIDTH = 10;

const CONTEXT_LIFT = 50;

const StatusContext = createContext<string | null>(null);

// Never rendered as tool rows: eve does not write these tools' results back
// into the message, so a row would spin long after the user answered.
const isQuestionTool = (name?: string) =>
  name === "ask_question" || name === "session_limit_continuation";

// Reasoning and step-start parts render as nothing but are still grouped,
// so the tool calls around them coalesce into one panel.
const groupSteps = (part: { type: string; toolName?: string }) => {
  if (part.type === "reasoning" || part.type === "step-start")
    return ["group-steps"] as const;
  return part.type === "tool-call" &&
    part.toolName !== "render_component" &&
    !isQuestionTool(part.toolName)
    ? (["group-steps"] as const)
    : null;
};

const SUMMARIZE_FROM = 3;

function UserText({ text }: Readonly<{ text: string }>) {
  return <span className="whitespace-pre-wrap">{text}</span>;
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="mb-5 flex justify-end">
      <div className="max-w-[85%] rounded-lg rounded-br-sm bg-nb-gray-900 px-3 py-2 text-sm text-nb-gray-100">
        <MessagePrimitive.Parts components={{ Text: UserText }} />
      </div>
    </MessagePrimitive.Root>
  );
}

const actionClass =
  "flex h-7 w-7 items-center justify-center rounded-md text-nb-gray-300 transition-colors hover:bg-nb-gray-900 hover:text-nb-gray-100 disabled:pointer-events-none disabled:opacity-30";

// Not `ActionBarPrimitive.Copy`: `useCopyToClipboard` fires the dashboard's notification.
function CopyAction() {
  const text = useAuiState((s) =>
    s.message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim(),
  );
  const running = useAuiState(
    (s) =>
      s.message.role === "assistant" && s.message.status.type === "running",
  );
  const [, copyToClipboard, copied] = useCopyToClipboard(text);
  const t = useTranslations("assistant");

  if (!text || running) {
    return <div className="h-7 w-7" aria-hidden />;
  }

  return (
    <button
      type="button"
      aria-label={t("copyAnswer")}
      title={t("copy")}
      onClick={() => copyToClipboard(t("answerCopied"))}
      className={actionClass}
    >
      {copied ? (
        <Check size={14} className="text-green-500" />
      ) : (
        <Copy size={14} />
      )}
    </button>
  );
}

function MessageActions() {
  return (
    <ActionBarPrimitive.Root className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/message:opacity-100">
      <CopyAction />
    </ActionBarPrimitive.Root>
  );
}

function StepsPanel({
  running,
  indices,
  children,
}: Readonly<{
  running: boolean;
  indices: readonly number[];
  children: React.ReactNode;
}>) {
  const turnActive = useContext(TurnActiveContext);
  const t = useTranslations("assistant");
  const [open, setOpen] = useState(false);

  // Stays expanded until the turn ends: `running` drops at every round
  // boundary, and collapsing there flickers.
  const [live, setLive] = useState(running);
  if (running && !live) setLive(true);
  if (!running && !turnActive && live) setLive(false);

  const count = useAuiState(
    (s) =>
      indices.filter((i) => s.message.parts[i]?.type === "tool-call").length,
  );

  if (count === 0) return null;
  if (running || (live && turnActive) || count < SUMMARIZE_FROM) {
    return <div className="my-2">{children}</div>;
  }

  return (
    <div className="my-2">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex items-center gap-1.5 rounded-md py-1 text-chat text-nb-gray-300 transition-colors hover:text-nb-gray-100"
      >
        <ChevronRight
          size={13}
          className={cn("shrink-0 transition-transform", open && "rotate-90")}
        />
        {open ? t("hideSteps") : t("showSteps", { count })}
      </button>
      {open && <div className="pl-1">{children}</div>}
    </div>
  );
}

function AssistantMessage() {
  const status = useContext(StatusContext);
  const t = useTranslations("assistant");

  const hasText = useAuiState((s) =>
    s.message.parts.some(
      (part) => part.type === "text" && part.text.trim().length > 0,
    ),
  );

  return (
    <MessagePrimitive.Root
      className={cn("group/message mt-1.5", hasText ? "mb-6" : "mb-1")}
    >
      <div className="max-w-full">
        {/* `always`, not `no-text`: reasoning renders as nothing here, so
          `no-text` would hide the indicator while the model thinks. */}
        <MessagePrimitive.GroupedParts groupBy={groupSteps} indicator="always">
          {({ part, children }) => {
            switch (part.type) {
              case "group-steps":
                return (
                  <StepsPanel
                    running={part.status?.type === "running"}
                    indices={part.indices}
                  >
                    {children}
                  </StepsPanel>
                );
              case "text":
                return <AssistantMarkdownText />;
              case "reasoning":
                return null;
              case "tool-call": {
                if (isQuestionTool(part.toolName)) return null;
                return part.toolName === "render_component" ? (
                  <AssistantInlineComponent {...part} />
                ) : (
                  <AssistantToolActivity {...part} />
                );
              }
              case "indicator":
                return <WorkingIndicator status={status} />;
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessagePrimitive.Error>
          <ActionBarPrimitive.Reload className="mt-4 flex items-center gap-1.5 rounded-md border border-nb-gray-800 px-2 py-1 text-xs text-nb-gray-300 transition-colors hover:border-nb-gray-700 hover:text-nb-gray-100 disabled:opacity-40">
            <RotateCw size={12} />
            {t("tryAgain")}
          </ActionBarPrimitive.Reload>
        </MessagePrimitive.Error>

        <AuiIf
          condition={(s) =>
            s.message.parts.some(
              (part) => part.type === "text" && part.text.trim().length > 0,
            )
          }
        >
          <MessageActions />
        </AuiIf>
      </div>
    </MessagePrimitive.Root>
  );
}

function WorkingIndicator({ status }: Readonly<{ status: string | null }>) {
  // The status is thread-wide but the indicator slot is per message: without
  // `isLast`, every unfinished message of the turn would repeat it.
  const claimsStatus = useAuiState(
    (s) =>
      s.message.role === "assistant" &&
      s.message.isLast &&
      s.message.status.type === "running",
  );
  const followsText = useAuiState((s) =>
    s.message.parts.some(
      (part) => part.type === "text" && part.text.trim().length > 0,
    ),
  );
  if (!status || !claimsStatus) return null;

  return (
    <div className={cn("flex items-center gap-2 py-1", followsText && "mt-3")}>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <Image
          src={NetBirdLogoMark}
          alt=""
          width={14}
          height={14}
          className="animate-pulse"
        />
      </span>
      <span
        aria-live="polite"
        className="animate-shimmer bg-gradient-to-r from-nb-gray-500 via-nb-gray-100 to-nb-gray-500 bg-[length:200%_100%] bg-clip-text text-chat text-transparent"
      >
        {status}…
      </span>
    </div>
  );
}

// The English of every starter lives in the catalog's `assistant.starter` block,
// still mirrored by the agent's evals/routing/starters.eval.ts: change both together.
const STARTERS: {
  key:
    | "draftNetworkChanges"
    | "reviewAccessPolicies"
    | "troubleshootConnectivity"
    | "whatChangedRecently";
  icon: React.ReactNode;
}[] = [
  {
    key: "draftNetworkChanges",
    icon: <PenLine size={13} className="shrink-0 text-nb-gray-200" />,
  },
  {
    key: "reviewAccessPolicies",
    icon: <ShieldCheck size={13} className="shrink-0 text-nb-gray-200" />,
  },
  {
    key: "troubleshootConnectivity",
    icon: <Cable size={13} className="shrink-0 text-nb-gray-200" />,
  },
  {
    key: "whatChangedRecently",
    icon: <History size={13} className="shrink-0 text-nb-gray-200" />,
  },
];

function EmptyState({ bottomOffset }: Readonly<{ bottomOffset: number }>) {
  const aui = useAui();
  const t = useTranslations("assistant");
  const { loggedInUser } = useLoggedInUser();
  const firstName = loggedInUser?.name?.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  let greeting = t("goodEvening");
  if (hour < 5) greeting = t("stillUp");
  else if (hour < 12) greeting = t("goodMorning");
  else if (hour < 18) greeting = t("goodAfternoon");

  const start = (prompt: string) => aui.thread.append(prompt);

  return (
    <AuiIf condition={(s) => s.thread.isEmpty}>
      <div
        className="absolute inset-x-0 top-0 z-10 flex flex-col items-center justify-center gap-5 overflow-y-auto py-6 text-center"
        style={{
          bottom: bottomOffset,
          paddingLeft: CHAT_PAD.x,
          paddingRight: CHAT_PAD.x,
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2.5">
            <Image src={NetBirdLogoMark} alt="" width={22} height={22} />
            {/* Hidden from the outline: the page beside the panel has its own heading. */}
            <h1 aria-hidden="true" className="text-xl">
              {firstName
                ? t("greetingWithName", { greeting, name: firstName })
                : t("greeting", { greeting })}
            </h1>
          </div>
          <Paragraph className="justify-center">
            {t("emptyStateLead")}
          </Paragraph>
        </div>

        <div className="flex max-w-[30rem] flex-wrap justify-center gap-2.5">
          {STARTERS.map((starter) => {
            const prompt = t(`starter.${starter.key}.prompt`);
            return (
              <button
                key={starter.key}
                type="button"
                onClick={() => start(prompt)}
                title={prompt}
                className="inline-flex items-center gap-1.5 rounded-full border border-nb-gray-850 bg-nb-gray-900 px-3 py-1.5 text-xs text-nb-gray-300 transition-colors hover:border-nb-gray-800 hover:bg-nb-gray-850 hover:text-nb-gray-100"
              >
                {starter.icon}
                {t(`starter.${starter.key}.label`)}
              </button>
            );
          })}
        </div>
      </div>
    </AuiIf>
  );
}

function ThreadQuestion({
  question,
  onAnswer,
  onDismiss,
}: Readonly<{
  question: AssistantQuestion | null;
  onAnswer: (indices: number[]) => void;
  onDismiss: () => void;
}>) {
  if (!question) return null;

  return (
    <AssistantQuestionCard
      key={question.id}
      question={question}
      onAnswer={onAnswer}
      onDismiss={onDismiss}
    />
  );
}

export function composerPlaceholder(
  question: AssistantQuestion | null,
  openQuestion: boolean,
  freeText: boolean,
  t?: AssistantTranslator,
): string {
  if (openQuestion)
    return translate(t, "placeholder.typeAnswer", "Type your answer");
  if (!question)
    return translate(t, "placeholder.howCanIHelp", "How can I help you today?");
  if (!freeText)
    return translate(
      t,
      "placeholder.pickOrNumberOrName",
      "Pick an option, or type its number or name",
    );
  if (question.multi)
    return translate(
      t,
      "placeholder.tickWhatApplies",
      "Tick what applies, or type your answer",
    );
  const numbered = numbersPickOptions(question.options, freeText);
  return translate(
    t,
    numbered ? "placeholder.pickNumberOrType" : "placeholder.pickOrType",
    numbered
      ? "Pick an option, type its number, or type your answer"
      : "Pick an option, or type your answer",
  );
}

export const NO_SUCH_OPTION = "That is not one of the options. Pick one, or type its number or name.";

export function typedAnswer(
  choice: PendingInputRequest,
  text: string,
): string | { text: string } | null {
  if (acceptsFreeText(choice)) return { text };
  const option = choice.options.find(
    (o) => o.label.trim().toLowerCase() === text.trim().toLowerCase(),
  );
  return option ? option.id : null;
}

function Composer({
  question,
  openQuestion,
  pendingId,
  freeText,
  onAnswer,
  onAnswerText,
  onAnswerOpen,
}: Readonly<{
  question: AssistantQuestion | null;
  openQuestion: boolean;
  pendingId: string | null;
  freeText: boolean;
  onAnswer: (indices: number[], typed?: string) => void;
  onAnswerText: (text: string) => boolean;
  onAnswerOpen: (text: string) => void;
}>) {
  const aui = useAui();
  const t = useTranslations("assistant");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isArmed = useArmingDelay(pendingId);
  const holdUnarmedClick = (event: React.MouseEvent) => {
    if (isArmed()) return;
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) inputRef.current?.focus();
  }, []);

  const submitAnswer = (): boolean => {
    const composer = aui.thread.composer();
    const text = composer.getState().text;
    if (openQuestion) {
      if (!text.trim()) return false;
      composer.setText("");
      onAnswerOpen(text.trim());
      return true;
    }
    if (!question) return false;
    const indices = numbersPickOptions(question.options, freeText)
      ? parseOptionNumbers(text, question.options.length, question.multi)
      : null;
    if (indices) {
      composer.setText("");
      onAnswer(indices, text.trim());
      return true;
    }
    if (text.trim()) {
      if (onAnswerText(text.trim())) composer.setText("");
      return true;
    }
    return false;
  };

  // Runs in the capture phase to beat the textarea's own Enter handler.
  const answerByKeyboard = (event: React.KeyboardEvent) => {
    if (!question && !openQuestion) return;
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    )
      return;

    if (submitAnswer()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <ComposerPrimitive.Root
      onKeyDownCapture={answerByKeyboard}
      className={cn(
        "flex flex-col gap-1 rounded-2xl border pl-3 pr-2 py-2",
        "relative z-10",
        "border-nb-gray-700 bg-nb-gray-900",
        "ring-offset-nb-gray-950/50 focus-within:ring-2 focus-within:ring-neutral-500/20 focus-within:ring-offset-2",
      )}
    >
      <ComposerPrimitive.Input
        ref={inputRef}
        rows={1}
        placeholder={composerPlaceholder(question, openQuestion, freeText, t)}
        className="max-h-32 min-h-[38px] w-full resize-none bg-transparent px-0.5 py-1.5 text-sm text-nb-gray-100 outline-none placeholder:text-neutral-400/70"
      />

      <div
        onClickCapture={holdUnarmedClick}
        className="flex items-center justify-end gap-2"
      >
        {(question || openQuestion) && (
          <button
            type="button"
            aria-label={t("question.sendAnswer")}
            onClick={submitAnswer}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
              "bg-netbird-500 text-white hover:bg-netbird-500/90",
            )}
          >
            <ArrowUp size={16} />
          </button>
        )}

        {!question && !openQuestion && (
          <AuiIf condition={(s) => !s.thread.isRunning}>
            <ComposerPrimitive.Send
              aria-label={t("question.send")}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                "bg-netbird-500 text-white hover:bg-netbird-500/90",
                "disabled:bg-nb-gray-900 disabled:text-nb-gray-500",
              )}
            >
              <ArrowUp size={16} />
            </ComposerPrimitive.Send>
          </AuiIf>
        )}

        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel
            aria-label={t("stop")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-nb-gray-700 text-red-500 hover:text-red-400"
          >
            <Square size={12} className="fill-current" />
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </ComposerPrimitive.Root>
  );
}

export interface AssistantThreadProps {
  context: PageContextEntry | null;
  onDismissContext: () => void;
  onNewChat?: () => void;
  className?: string;
}

export function AssistantThread({
  context,
  onDismissContext,
  onNewChat,
  className,
}: Readonly<AssistantThreadProps>) {
  const {
    statusLine: status,
    turnActive,
    pendingInput,
    pendingInputs,
    respondToInput,
    error,
  } = useAssistant();
  const aui = useAui();
  const t = useTranslations("assistant");

  const [answerFailure, setAnswerFailure] = useState<{
    requestId: string;
    message: string;
  } | null>(null);
  const answerError =
    answerFailure && answerFailure.requestId === pendingInput?.requestId
      ? answerFailure.message
      : null;

  const respond = (answer: string | { text: string }, typed?: string) => {
    if (!pendingInput) return;
    const { requestId } = pendingInput;
    setAnswerFailure(null);
    respondToInput(answer).catch((err) => {
      setAnswerFailure({
        requestId,
        message: describeAssistantError(err, t),
      });
      if (typed === undefined) return;
      const composer = aui.thread.composer();
      if (!composer.getState().text) composer.setText(typed);
    });
  };

  const choice =
    pendingInput?.kind === "question" && pendingInput.options.length > 0
      ? pendingInput
      : null;
  const question = useMemo<AssistantQuestion | null>(
    () =>
      choice && {
        id: choice.requestId,
        title: choice.prompt,
        options: choice.options.map(({ label, description }) => ({
          label,
          description,
        })),
        multi: false,
      },
    [choice],
  );

  const answer = (indices: number[], typed?: string) => {
    const option = choice?.options[indices[0]];
    if (option) respond(option.id, typed);
  };

  const answerQuestion = (text: string): boolean => {
    if (!choice) return false;
    const answered = typedAnswer(choice, text);
    if (answered === null) {
      setAnswerFailure({
        requestId: choice.requestId,
        message: t("noSuchOption"),
      });
      return false;
    }
    respond(answered, text);
    return true;
  };

  const dismissQuestion = () => {
    if (!choice) return;
    respond({
      text: "The user dismissed the question without answering. Continue without this information.",
    });
  };

  const composerRef = useRef<HTMLDivElement>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  // The smallest height seen: centring the empty state on the live height
  // would shift it with every line typed.
  const [restingHeight, setRestingHeight] = useState(0);

  useEffect(() => {
    const element = composerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const height = entry.contentRect.height;
      setComposerHeight(height);
      setRestingHeight((resting) =>
        resting === 0 ? height : Math.min(resting, height),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const openQuestion =
    pendingInput && isOpenQuestion(pendingInput) ? pendingInput : null;

  const questionId = question?.id ?? null;
  // Refocuses the composer when the user is being waited on, but never takes
  // focus from another field: the user may be typing on the page beside it.
  useEffect(() => {
    if (turnActive && !questionId && !openQuestion) return;

    const frame = requestAnimationFrame(() => {
      const input =
        composerRef.current?.querySelector<HTMLTextAreaElement>("textarea");
      if (!input || input === document.activeElement) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        (active.isContentEditable ||
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement)
      )
        return;
      input.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [turnActive, questionId, openQuestion?.requestId]);

  return (
    <ThreadPrimitive.Root
      className={cn("relative flex min-h-0 flex-1 flex-col", className)}
    >
      {/* Scrolls natively: the Radix ScrollArea's inline `overflow` overrides
        the viewport's and leaves the thread unscrollable. */}
      <ThreadPrimitive.Viewport
        autoScroll
        className="nb-scrollbar min-h-0 flex-1 overflow-y-auto pt-8"
        style={{
          paddingLeft: CHAT_PAD.x,
          paddingRight: CHAT_PAD.x,
          paddingBottom: composerHeight + 8,
        }}
      >
        <div className="pl-2">
          <StatusContext.Provider value={status}>
            <TurnActiveContext.Provider value={turnActive}>
              <ThreadPrimitive.Messages
                components={{ UserMessage, AssistantMessage }}
              />
              <AssistantErrorNotice error={error ?? answerError} />
            </TurnActiveContext.Provider>
          </StatusContext.Provider>
        </div>
      </ThreadPrimitive.Viewport>

      <div
        className="pointer-events-none absolute left-0 top-0 h-8 bg-gradient-to-b from-nb-gray-925 to-transparent"
        style={{ width: `calc(100% - ${SCROLLBAR_WIDTH}px)` }}
      />

      {/* Must come after the viewport, which covers the same box and would
        swallow clicks on the starters. */}
      <EmptyState bottomOffset={restingHeight} />

      <div
        ref={composerRef}
        className="absolute inset-x-0 bottom-0 pt-2"
        style={{ paddingLeft: CHAT_PAD.x, paddingRight: CHAT_PAD.x }}
      >
        <ThreadPrimitive.ScrollToBottom
          className="absolute -top-9 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-nb-gray-800 bg-nb-gray-900 text-nb-gray-300 shadow-md hover:text-nb-gray-100 disabled:invisible"
          aria-label={t("scrollToBottom")}
        >
          <ArrowDown size={15} />
        </ThreadPrimitive.ScrollToBottom>

        <div
          className="transition-[margin] duration-200"
          style={{ marginBottom: context && !openQuestion ? CONTEXT_LIFT : 0 }}
        >
          <ThreadQuestion
            question={question}
            onAnswer={answer}
            onDismiss={dismissQuestion}
          />
          {openQuestion && <AssistantOpenQuestionCard request={openQuestion} />}
        </div>

        <div
          className="bg-nb-gray-925"
          style={{ paddingBottom: CHAT_PAD.bottom }}
        >
          <div className="relative">
            {pendingInput && !openQuestion && !choice ? (
              <AssistantApprovalGate
                request={pendingInput}
                onRespond={respond}
                onNewChat={onNewChat}
                onStop={() => aui.thread.cancelRun()}
                queued={pendingInputs.length}
              />
            ) : (
              <>
                {!openQuestion && (
                  <AssistantContextChip
                    entry={context}
                    onDismiss={onDismissContext}
                  />
                )}
                <Composer
                  question={question}
                  openQuestion={!!openQuestion}
                  pendingId={openQuestion?.requestId ?? questionId}
                  freeText={!choice || acceptsFreeText(choice)}
                  onAnswer={answer}
                  onAnswerText={answerQuestion}
                  onAnswerOpen={(text) => respond({ text }, text)}
                />
              </>
            )}
          </div>
          <p className="pb-1 pt-3 text-center text-xs leading-none text-nb-gray-500 dark:text-gray-400">
            {t("disclaimer")}
          </p>
        </div>
      </div>
    </ThreadPrimitive.Root>
  );
}
