"use client";

import InlineLink from "@components/InlineLink";
import Paragraph from "@components/Paragraph";
import SkeletonTable from "@components/skeletons/SkeletonTable";
import { RestrictedAccess } from "@components/ui/RestrictedAccess";
import { usePortalElement } from "@hooks/usePortalElement";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { lazy, Suspense } from "react";
import { usePermissions } from "@/contexts/PermissionsProvider";
import { REVERSE_PROXY_CLUSTERS_DOCS_LINK } from "@/interfaces/ReverseProxy";
import PageContainer from "@/layouts/PageContainer";

const ClustersTable = lazy(
  () => import("@/modules/reverse-proxy/clusters/ClustersTable"),
);

export default function ReverseProxyClustersPage() {
  const t = useTranslations("reverseProxy");
  const tCommon = useTranslations("common");
  const { permission } = usePermissions();

  const { ref: headingRef, portalTarget } =
    usePortalElement<HTMLHeadingElement>();

  return (
    <PageContainer>
      <div className={"p-default py-6"}>
        <h1 ref={headingRef}>{t("clusters")}</h1>
        <Paragraph>
          {t("clustersDescription")}{" "}
          <InlineLink href={REVERSE_PROXY_CLUSTERS_DOCS_LINK} target={"_blank"}>
            {tCommon("learnMore")}
            <ExternalLinkIcon size={12} />
          </InlineLink>
        </Paragraph>
        <RestrictedAccess
          page={t("clusters")}
          hasAccess={permission.services?.read}
        >
          <Suspense fallback={<SkeletonTable />}>
            <ClustersTable headingTarget={portalTarget} />
          </Suspense>
        </RestrictedAccess>
      </div>
    </PageContainer>
  );
}
