import SidebarItem from "@components/SidebarItem";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useEffect, useMemo } from "react";
import ActivityIcon from "@/assets/icons/ActivityIcon";
import MSPIcon from "@/assets/icons/MSPIcon";
import TeamIcon from "@/assets/icons/TeamIcon";
import { useDistributor } from "@/cloud/distributor/contexts/DistributorProvider";
import { usePermissions } from "@/contexts/PermissionsProvider";
import { useLoggedInUser } from "@/contexts/UsersProvider";
import { isNetBirdCloud } from "@utils/netbird";
import { Role } from "@/interfaces/User";
import PeerIcon from "@/assets/icons/PeerIcon";

export const DistributorNavigation = () => {
  const { isActive } = useDistributor();
  const { isOwnerOrAdmin, loggedInUser } = useLoggedInUser();
  const { permission, isRestricted } = usePermissions();
  const isBillingAdmin = loggedInUser?.role === Role.BillingAdmin;
  const t = useTranslations("distributor");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("navigation");

  const show = useMemo(() => {
    return isActive && isNetBirdCloud();
  }, [isActive, isOwnerOrAdmin]);

  /**
   * Hide the entire navigation for billing admins because they only have
   * access to plans & billing settings and no other pages.
   */
  useEffect(() => {
    if (!show || !isBillingAdmin) return;

    const style = document.createElement("style");
    style.setAttribute("data-distributor-billing-admin", "");
    style.textContent = `body[data-distributor] [data-navigation], body[data-distributor] [data-navbar-colappse-toggle] { display: none; }`;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, [show, isBillingAdmin]);

  if (!show) return;

  return (
    <div data-distributor-nav="">
      {/* Show peers only for regular users — distributors don't have peer access,
          but user role has no other pages to navigate to */}
      <SidebarItem
        icon={<PeerIcon />}
        label={tCommon("peers")}
        href={"/peers"}
        visible={!isRestricted && loggedInUser?.role === Role.User}
      />

      <SidebarItem
        icon={<MSPIcon size={17} />}
        visible={isOwnerOrAdmin}
        label={t("customersLabel")}
        href={"/customers"}
        exactPathMatch={true}
        labelClassName={"-left-[1.5px] relative"}
      />

      <SidebarItem
        icon={<TeamIcon />}
        visible={permission.users.read}
        label={tNav("team")}
        href={"/team"}
        collapsible
      >
        <SidebarItem
          label={tNav("users")}
          isChild
          href={"/team/users"}
          visible={permission.users.read}
        />
        <SidebarItem
          label={tNav("serviceUsers")}
          isChild
          href={"/team/service-users"}
          visible={permission.users.read}
        />
      </SidebarItem>
      <SidebarItem
        icon={<ActivityIcon />}
        visible={permission.events.read}
        label={tNav("auditEvents")}
        href={"/events/audit"}
        exactPathMatch={true}
      />
    </div>
  );
};
