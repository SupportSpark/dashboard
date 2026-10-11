"use client";

import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import relativeTime from "dayjs/plugin/relativeTime";
import { NextIntlClientProvider } from "next-intl";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  LOCALE_TIMEZONES,
  defaultLocale,
  messages,
  type Locale,
} from "@/i18n/config";
import { detectLocale, persistLocale } from "@/i18n/detection";

dayjs.extend(relativeTime);

/**
 * dayjs locale for each app locale.
 *
 * dayjs keeps ONE global locale rather than taking one per call, so it has to be
 * kept in step with next-intl by hand. Without this, every relative timestamp —
 * `dayjs().to(date)` in LastTimeRow, used by peers, users, jobs, setup keys,
 * groups, access tokens and Okta SSO — renders in English ("6 days ago") inside
 * an otherwise Chinese UI.
 */
const DAYJS_LOCALES: Record<Locale, string> = { en: "en", zh: "zh-cn" };

type LocaleContextValue = {
  /** Active locale. Defaults to {@link defaultLocale} until `mounted` is true. */
  locale: Locale;
  /**
   * Whether the client-side detection has run. Until this is `true`, `locale`
   * reflects the build-time default and should not be trusted for
   * user-specific rendering. Components that must avoid a flash of the wrong
   * language can gate on this flag.
   */
  mounted: boolean;
  /** Switch the active locale: persists a cookie and updates state. */
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  mounted: false,
  setLocale: () => {},
});

/** Access the active locale and a setter that persists the choice. */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

type Props = {
  children: React.ReactNode;
};

/**
 * Resolves the active locale on the client (cookie → browser → default) and
 * feeds it to `NextIntlClientProvider`. Replaces the previous hardcoded
 * `locale="zh"` wiring in `AppLayout`.
 *
 * Because the app is statically exported, there is no server to detect the
 * locale ahead of time; the build emits pages with {@link defaultLocale} and
 * the real locale is resolved in a `useEffect` after hydration. This keeps
 * server/client markup consistent (no hydration mismatch) while still honoring
 * the user's stored preference.
 */
export default function LocaleProvider({ children }: Props) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const detected = detectLocale();
    setLocaleState(detected);
    setMounted(true);
  }, []);

  // Keep <html lang="..."> in sync with the active locale. The layout emits
  // the build-time default (zh) statically; this overrides it on the client.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  // Set dayjs's global locale DURING render, not in an effect.
  //
  // `dayjs().to(date)` reads the locale when it is called, i.e. while children
  // render. Setting it in an effect would run after that pass had already
  // formatted its dates, and nothing would re-render them afterwards — the
  // timestamps would stay in the previous language indefinitely. The call is
  // idempotent and guarded, so re-renders are free.
  const dayjsLocale = DAYJS_LOCALES[locale];
  if (dayjs.locale() !== dayjsLocale) dayjs.locale(dayjsLocale);

  const setLocale = useCallback((next: Locale) => {
    persistLocale(next);
    setLocaleState(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, mounted, setLocale }),
    [locale, mounted, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages[locale]}
        timeZone={LOCALE_TIMEZONES[locale]}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
