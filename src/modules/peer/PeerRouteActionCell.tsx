import Button from "@components/Button";
import { notify } from "@components/Notification";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/Tooltip";
import { useApiCall } from "@utils/api";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useMemo } from "react";
import { useSWRConfig } from "swr";
import { useDialog } from "@/contexts/DialogProvider";
import { useGroups } from "@/contexts/GroupsProvider";
import { usePeer } from "@/contexts/PeerProvider";
import { Route } from "@/interfaces/Route";

type Props = {
  route: Route;
};
export default function PeerRouteActionCell({ route }: Props) {
  const tpeer = useTranslations("peers");
  const troutes = useTranslations("routes");
  const tCommon = useTranslations("common");
  const { confirm } = useDialog();
  const routeRequest = useApiCall<Route>("/routes");
  const { mutate } = useSWRConfig();
  const { peer } = usePeer();
  const { groups } = useGroups();

  const peerGroup = useMemo(() => {
    if (!groups) return undefined;
    return groups.find((group) => {
      const id = route.peer_groups && route.peer_groups[0];
      return group.id === id;
    });
  }, [route, groups]);

  const handleRevoke = async () => {
    notify({
      title: troutes("deleteRouteNotify", { network_id: route.network_id }),
      description: troutes("routeRemoved"),
      promise: routeRequest.del("", `/${route.id}`).then(() => {
        mutate("/routes");
      }),
      loadingMessage: troutes("deletingRoute"),
    });
  };

  const handleConfirm = async () => {
    const choice = await confirm({
      title: tpeer("deletePeerFromRouteTitle", {
        name: peer.name,
        network_id: route.network_id,
      }),
      description: tpeer("removePeerFromRouteConfirm"),
      confirmText: tCommon("delete"),
      cancelText: tCommon("cancel"),
      type: "danger",
    });
    if (!choice) return;
    handleRevoke().then();
  };

  return (
    <div className={"flex justify-end pr-4"}>
      <TooltipProvider delayDuration={0} disableHoverableContent={true}>
        <Tooltip>
          <TooltipTrigger asChild={true}>
            <Button
              variant={"danger-outline"}
              size={"sm"}
              onClick={handleConfirm}
              disabled={!!peerGroup}
            >
              <Trash2 size={16} />
              Delete
            </Button>
          </TooltipTrigger>
          {peerGroup && (
            <TooltipContent>
              <div className={"max-w-xs text-sm"}>
                <span className={"text-netbird"}>{peer.name}</span> is a part of
                a group used in a network route. To remove this peer from the
                network route, you need to disassociate this peer from the group
                used in this route.
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
