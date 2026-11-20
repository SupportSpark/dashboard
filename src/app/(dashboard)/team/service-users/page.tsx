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
import { usePermissions } from "@/contexts/PermissionsProvider";
import { User } from "@/interfaces/User";
import PageContainer from "@/layouts/PageContainer";
import UsersTabs from "@/modules/users/UsersTabs";

const ServiceUsersTable = lazy(
  () => import("@/modules/users/ServiceUsersTable"),
);

export default function ServiceUsers() {
  const t = useTranslations("serviceUsers");
  const tUsers = useTranslations("users");
  const { permission } = usePermissions();
  const { data: users, isLoading } = useFetchApi<User[]>(
    "/users?service_user=true",
  );

  const { ref: headingRef, portalTarget } =
    usePortalElement<HTMLHeadingElement>();

  return (
    <PageContainer>
      <div className={"p-default py-6"}>
        <h1 ref={headingRef}>{t("title")}</h1>
        <Paragraph>
          {t("serviceUsersDescription")}{" "}
          <InlineLink
            href={"https://docs.netbird.io/how-to/access-netbird-public-api"}
            target={"_blank"}
          >
            {tUsers("learnMore")}
            <ExternalLinkIcon size={12} />
          </InlineLink>
        </Paragraph>
      </div>
      <UsersTabs current={"service-users"} />
      <RestrictedAccess page={t("title")} hasAccess={permission.users.read}>
        <Suspense fallback={<SkeletonTable />}>
          <ServiceUsersTable
            users={users}
            isLoading={isLoading}
            headingTarget={portalTarget}
          />
        </Suspense>
      </RestrictedAccess>
    </PageContainer>
  );
}
