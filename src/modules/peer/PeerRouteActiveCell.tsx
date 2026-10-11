import { ToggleSwitch } from "@components/ToggleSwitch";
import GroupBadge from "@components/ui/GroupBadge";
import { useTranslations } from "next-intl";
import React, { useMemo } from "react";
import { useSWRConfig } from "swr";
import { useGroups } from "@/contexts/GroupsProvider";
import { useRoutes } from "@/contexts/RoutesProvider";
import { Route } from "@/interfaces/Route";

type Props = {
  route: Route;
};
export default function PeerRouteActiveCell({ route }: Props) {
  const t = useTranslations("routes");
  const { updateRoute } = useRoutes();
  const { mutate } = useSWRConfig();
  const { groups } = useGroups();

  const peerGroup = useMemo(() => {
    if (!groups) return undefined;
    return groups.find((group) => {
      const id = route.peer_groups && route.peer_groups[0];
      return group.id === id;
    });
  }, [route, groups]);

  const update = async (enabled: boolean) => {
    updateRoute(
      route,
      { enabled },
      () => {
        mutate("/routes");
      },
      enabled ? t("routeEnabledSuccess") : t("routeDisabledSuccess"),
    );
  };

  const isChecked = useMemo(() => {
    return route.enabled;
  }, [route]);

  return (
    <div className={"flex items-center"}>
      {!peerGroup ? (
        <ToggleSwitch
          checked={isChecked}
          size={"small"}
          onClick={() => update(!isChecked)}
        />
      ) : (
        <GroupBadge group={peerGroup} />
      )}
    </div>
  );
}
