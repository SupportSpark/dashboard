"use client";

import InlineLink from "@components/InlineLink";
import Paragraph from "@components/Paragraph";
import SkeletonTable from "@components/skeletons/SkeletonTable";
import { RestrictedAccess } from "@components/ui/RestrictedAccess";
import { usePortalElement } from "@hooks/usePortalElement";
import useFetchApi from "@utils/api";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { lazy, Suspense } from "react";
import GroupsProvider from "@/contexts/GroupsProvider";
import { usePermissions } from "@/contexts/PermissionsProvider";
import PoliciesProvider from "@/contexts/PoliciesProvider";
import { PostureCheck } from "@/interfaces/PostureCheck";
import PageContainer from "@/layouts/PageContainer";

const PostureCheckTable = lazy(
  () => import("@/modules/posture-checks/table/PostureCheckTable"),
);

export default function PostureChecksPage() {
  const t = useTranslations("postureChecks");
  const tCommon = useTranslations("common");
  const { permission } = usePermissions();
  const { data: postureChecks, isLoading } =
    useFetchApi<PostureCheck[]>("/posture-checks");

  const { ref: headingRef, portalTarget } =
    usePortalElement<HTMLHeadingElement>();

  return (
    <PageContainer>
      <GroupsProvider>
        <div className={"p-default py-6"}>
          <h1 ref={headingRef}>{t("title")}</h1>
          <Paragraph>
            {t("pageDescription")}{" "}
            <InlineLink
              href={"https://docs.netbird.io/how-to/manage-posture-checks"}
              target={"_blank"}
            >
              {tCommon("learnMore")}
              <ExternalLinkIcon size={12} />
            </InlineLink>
          </Paragraph>
        </div>

        <RestrictedAccess
          page={t("title")}
          hasAccess={permission.policies.read}
        >
          <PoliciesProvider>
            <Suspense fallback={<SkeletonTable />}>
              <PostureCheckTable
                headingTarget={portalTarget}
                isLoading={isLoading}
                postureChecks={postureChecks}
              />
            </Suspense>
          </PoliciesProvider>
        </RestrictedAccess>
      </GroupsProvider>
    </PageContainer>
  );
}
