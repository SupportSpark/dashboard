import InlineLink from "@components/InlineLink";
import Paragraph from "@components/Paragraph";
import SkeletonTable, {
  SkeletonTableHeader,
} from "@components/skeletons/SkeletonTable";
import { ExternalLinkIcon } from "lucide-react";
import * as React from "react";
import { Suspense } from "react";
import {
  REVERSE_PROXY_DOCS_LINK,
  ReverseProxyFlatTarget,
} from "@/interfaces/ReverseProxy";
import { ReverseProxyFlatTargetsTable } from "@/modules/reverse-proxy/targets/flat/ReverseProxyFlatTargetsTable";
import { useTranslations } from "next-intl";

type Props = {
  targets: ReverseProxyFlatTarget[];
  isLoading?: boolean;
  hideResourceColumn?: boolean;
  emptyTableTitle?: string;
  emptyTableDescription?: string;
};

export const ReverseProxyFlatTargetsTabContent = ({
  targets,
  isLoading,
  hideResourceColumn,
  emptyTableTitle,
  emptyTableDescription,
}: Props) => {
  const t = useTranslations("reverseProxy");
  const tCommon = useTranslations("common");
  return (
    <div className={"pb-10 px-8"}>
      <div className={"flex justify-between items-center mb-5"}>
        <div>
          <Paragraph>
            {t("exposeServicesDesc")}{" "}
            <InlineLink href={REVERSE_PROXY_DOCS_LINK} target={"_blank"}>
              {tCommon("learnMore")}
              <ExternalLinkIcon size={12} />
            </InlineLink>
          </Paragraph>
        </div>
      </div>
      <Suspense
        fallback={
          <div>
            <SkeletonTableHeader className={"!p-0"} />
            <div className={"mt-8 w-full"}>
              <SkeletonTable withHeader={false} />
            </div>
          </div>
        }
      >
        <ReverseProxyFlatTargetsTable
          targets={targets}
          isLoading={isLoading}
          hideResourceColumn={hideResourceColumn}
          emptyTableTitle={emptyTableTitle ?? t("networkNoServices")}
          emptyTableDescription={
            emptyTableDescription ?? t("networkNoServicesDescription")
          }
        />
      </Suspense>
    </div>
  );
};
