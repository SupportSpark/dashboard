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
import ReverseProxiesProvider from "@/contexts/ReverseProxiesProvider";
import { REVERSE_PROXY_CUSTOM_DOMAINS_DOCS_LINK } from "@/interfaces/ReverseProxy";
import PageContainer from "@/layouts/PageContainer";

const CustomDomainsTable = lazy(
  () => import("@/modules/reverse-proxy/domain/CustomDomainsTable"),
);

export default function ReverseProxyCustomDomainsPage() {
  const t = useTranslations("reverseProxy");
  const tCommon = useTranslations("common");
  const { permission } = usePermissions();

  const { ref: headingRef, portalTarget } =
    usePortalElement<HTMLHeadingElement>();

  return (
    <PageContainer>
      <div className={"p-default py-6"}>
        <h1 ref={headingRef}>{t("customDomains")}</h1>
        <Paragraph>
          {t("customDomainsDescription")}{" "}
          <InlineLink
            href={REVERSE_PROXY_CUSTOM_DOMAINS_DOCS_LINK}
            target={"_blank"}
          >
            {tCommon("learnMore")}
            <ExternalLinkIcon size={12} />
          </InlineLink>
        </Paragraph>
        <RestrictedAccess
          page={t("customDomains")}
          hasAccess={permission.services?.read}
        >
          <Suspense fallback={<SkeletonTable />}>
            <ReverseProxiesProvider>
              <CustomDomainsTable headingTarget={portalTarget} />
            </ReverseProxiesProvider>
          </Suspense>
        </RestrictedAccess>
      </div>
    </PageContainer>
  );
}
