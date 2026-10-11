import Badge from "@components/Badge";
import { useTranslations } from "next-intl";
import * as React from "react";
import {
  TrafficEvent,
  TrafficEventDirection,
} from "@/cloud/traffic-events/interfaces/TrafficEvent";

type Props = {
  event: TrafficEvent;
};

export const TrafficEventsDirectionCell = ({ event }: Props) => {
  const t = useTranslations("trafficEvents");
  const tCommon = useTranslations("common");
  const direction = event.direction;
  const isInbound = direction === TrafficEventDirection.INGRESS;

  return direction === TrafficEventDirection.UNKNOWN ? (
    <Badge variant={"gray"} className={"py-1 w-[80px]"}>
      {tCommon("unknown")}
    </Badge>
  ) : (
    <Badge variant={"gray"} className={"py-1 w-[80px]"}>
      {isInbound ? t("inbound") : t("outbound")}
    </Badge>
  );
};
