import FullTooltip from "@components/FullTooltip";
import InlineLink from "@components/InlineLink";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

type Props = {
  children: React.ReactNode;
  hoverButton?: boolean;
};

const EXIT_NODE_DOCS =
  "https://docs.netbird.io/how-to/configuring-default-routes-for-internet-traffic";

export const ExitNodeHelpTooltip = ({
  children,
  hoverButton = false,
}: Props) => {
  const tr = useTranslations("routes");
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <FullTooltip
        hoverButton={hoverButton}
        content={
          <div className={"text-xs max-w-xs"}>
            {tr("exitNodeIntro")}
            <div className={"mt-2"}>
              {/* One rich message rather than prefix + link + suffix: the link
                  sits in the middle of the sentence, and Chinese puts it
                  somewhere else, which three concatenated pieces cannot express. */}
              {tr.rich("exitNodeDocsLine", {
                link: (chunks) => (
                  <InlineLink
                    href={EXIT_NODE_DOCS}
                    target={"_blank"}
                    className={"mr-1"}
                  >
                    {chunks}
                    <ExternalLinkIcon size={10} />
                  </InlineLink>
                ),
              })}
            </div>
          </div>
        }
      >
        {children}
      </FullTooltip>
    </div>
  );
};
