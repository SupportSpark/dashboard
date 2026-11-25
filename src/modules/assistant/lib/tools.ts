import type { CanvasAgentApi } from "./canvas";
import type { ToolOutcome } from "./contract";
import { OPERATION_LABELS, TOOL_MANIFEST } from "./contract";
import { CONTROL_CENTER_TOOLS } from "./control-center";
import { ownEntry } from "./own";

/**
 * The optional translator the pure helpers below accept.
 *
 * Module-level helpers run outside any React tree (and upstream's unit tests
 * call them with no provider at all), so the catalog lookup is injected rather
 * than reached through a hook: a caller inside a component passes its `t`, a
 * caller without one keeps the English the manifests already carry.
 */
export type AssistantTranslator = (key: string, values?: any) => string;

/**
 * Translate `key`, or return `fallback` when no translator was supplied or the
 * catalog has no such key.
 *
 * next-intl reports a missing key by returning the namespace-qualified path
 * (`assistant.tool.foo`) instead of throwing, so a bare lookup would put that
 * path in the chat. `has` is asked first where the translator offers it; the
 * path comparison covers translators that do not.
 */
export function translate(
  t: AssistantTranslator | undefined,
  key: string,
  fallback: string,
  values?: any,
): string {
  if (!t) return fallback;
  const has = (t as { has?: (candidate: string) => boolean }).has;
  if (typeof has === "function" && !has.call(t, key)) return fallback;
  const text = t(key, values);
  return text === key || text.endsWith(`.${key}`) ? fallback : text;
}

export interface BrowserToolContext {
  navigate(href: string): void;
  onControlCenterPage(): boolean;
  currentUserId?: string;
  sessionId?: string;
  canvasWaitMs?: number;
}

// Must never throw; failures ride in `ok: false`.
export type BrowserToolExecutor = (
  input: unknown,
  ctx: BrowserToolContext,
) => Promise<ToolOutcome>;

export interface TrailDescription {
  label: string;
  detail?: string;
  // `undefined` keeps the host's default subject, `null` shows none.
  subject?: string | null;
}

export type ControlCenterToolAction = (
  input: Record<string, unknown>,
  api: CanvasAgentApi,
) => Promise<ToolOutcome>;

export type ControlCenterDescribeTrail = (
  input: Record<string, unknown>,
) => Partial<TrailDescription>;

const ACRONYMS = new Set([
  "acl", "api", "cli", "dhcp", "dns", "http", "https", "id", "ip", "mfa",
  "nat", "sdk", "sso", "ssh", "tls", "ui", "url", "vpn",
]);

const MINOR_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or",
  "the", "to", "with",
]);

export function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      if (index > 0 && MINOR_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

const FRAMEWORK_PREFIX = /^(?:eve|assistant)__/;

export const toolLabel = (
  name: string,
  _running = false,
  t?: AssistantTranslator,
): string => {
  const entry = ownEntry(TOOL_MANIFEST, name);
  if (entry) return translate(t, `tool.${name}`, entry.label);
  const words = name.replace(FRAMEWORK_PREFIX, "").replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const LOAD_SKILL = new Set(["assistant__skill", "eve__skill"]);

function stringField(args: unknown, field: string): string | null {
  if (!args || typeof args !== "object") return null;
  const value = (args as Record<string, unknown>)[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function describeFrameworkTool(
  name: string,
  args: unknown,
  running: boolean,
  t?: AssistantTranslator,
): TrailDescription | null {
  if (LOAD_SKILL.has(name)) {
    const skill = stringField(args, "name") ?? stringField(args, "skill");
    if (!skill)
      return {
        label: translate(t, "loadSkill", "Load a skill"),
        subject: null,
      };
    const humanized = humanizeSlug(skill);
    // `subject: null`: the quoted name already rides in the label.
    return {
      label: translate(t, "loadSkillNamed", `Load skill '${humanized}'`, {
        name: humanized,
      }),
      subject: null,
    };
  }
  if (name === "account_search") {
    // The host quotes the whole subject, so the join supplies only the inner quotes.
    const names = searchedNames(args);
    return { label: toolLabel(name, running, t), subject: names.length > 0 ? names.join("', '") : null };
  }
  return null;
}

function searchedNames(args: unknown): string[] {
  const terms = (args as { terms?: unknown } | null)?.terms;
  const names = [stringField(args, "term"), ...(Array.isArray(terms) ? terms : [])];
  return [...new Set(names.filter((n): n is string => typeof n === "string" && n.trim() !== "").map((n) => n.trim()))];
}

export function describeToolCall(
  name: string,
  args: unknown,
  running = false,
  t?: AssistantTranslator,
): TrailDescription {
  if (ownEntry(CONTROL_CENTER_TOOLS, name)) return describeControlCenterTool(name, args, t);
  const operation = name === "netbird_api" ? (stringField(args, "operation") ?? "") : "";
  const labelled = operation
    ? ownEntry(OPERATION_LABELS, operation)
    : undefined;
  if (labelled)
    return { label: translate(t, `operation.${operation}`, labelled.label) };
  const framework = describeFrameworkTool(name, args, running, t);
  if (framework) return framework;
  return { label: toolLabel(name, running, t) };
}

export function describeControlCenterTool(
  name: string,
  args: unknown,
  t?: AssistantTranslator,
): TrailDescription {
  const tool = ownEntry(CONTROL_CENTER_TOOLS, name);
  if (!tool) return { label: name };
  const input = (args && typeof args === "object" ? args : {}) as Record<
    string,
    unknown
  >;
  return { label: toolLabel(name, false, t), ...tool.describe?.(input) };
}
