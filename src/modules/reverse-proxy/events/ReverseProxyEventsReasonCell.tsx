import Badge from "@components/Badge";
import FullTooltip from "@components/FullTooltip";
import { ListItem } from "@components/ListItem";
import { Info, ShieldAlert } from "lucide-react";
import * as React from "react";
import { ReverseProxyEvent } from "@/interfaces/ReverseProxy";
import { useTranslations } from "next-intl";

/** CrowdSec verdict code -> catalog key, resolved through the translator. */
const VERDICT_KEYS: Record<string, string> = {
  crowdsec_ban: "verdictBan",
  crowdsec_captcha: "verdictCaptcha",
  crowdsec_throttle: "verdictThrottle",
};

type Props = {
  event: ReverseProxyEvent;
};

export const ReverseProxyEventsReasonCell = ({ event }: Props) => {
  const t = useTranslations("reverseProxy");
  const metadata = event.metadata;
  const verdict = metadata?.crowdsec_verdict;

  if (verdict && !event.auth_method_used?.startsWith("crowdsec_")) {
    const verdictKey = VERDICT_KEYS[verdict];
    const verdictLabel = verdictKey ? t(verdictKey) : verdict;
    const metaEntries = Object.entries(metadata!).filter(
      ([k]) => k !== "crowdsec_verdict",
    );

    return (
      <FullTooltip
        side="top"
        interactive
        delayDuration={250}
        skipDelayDuration={100}
        disabled={metaEntries.length === 0}
        contentClassName="p-0"
        content={
          <div className="text-xs flex flex-col">
            {metaEntries.map(([key, val]) => (
              <ListItem
                key={key}
                icon={<Info size={14} />}
                label={key.replaceAll("_", " ")}
                value={<span className="text-nb-gray-200">{val}</span>}
              />
            ))}
          </div>
        }
      >
        <div className="px-3 py-2">
          <Badge variant="gray" className="gap-1.5">
            <ShieldAlert size={12} className="text-yellow-500" />
            {t("crowdSecObserveVerdict", { verdict: verdictLabel })}
          </Badge>
        </div>
      </FullTooltip>
    );
  }

  return (
    <span className="text-nb-gray-300 text-[0.82rem] py-2 text-left">
      {event.reason || "-"}
    </span>
  );
};
