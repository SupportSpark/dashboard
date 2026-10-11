import CopyToClipboardText from "@components/CopyToClipboardText";
import CircleIcon from "@/assets/icons/CircleIcon";
import { ReverseProxyCluster } from "@/interfaces/ReverseProxy";
import { ClusterTypeIndicator } from "@/modules/reverse-proxy/clusters/ClusterTypeIndicator";
import { useTranslations } from "next-intl";

type Props = {
  cluster: ReverseProxyCluster;
};

export default function ClustersNameCell({ cluster }: Readonly<Props>) {
  const t = useTranslations("reverseProxy");
  return (
    <div className="flex items-center gap-2.5 ml-2">
      <CircleIcon active={cluster.online} size={8} inactiveDot={"gray"} />
      <CopyToClipboardText
        message={t("addressCopied", { address: cluster.address })}
      >
        <span className="font-medium">{cluster.address}</span>
      </CopyToClipboardText>
      <ClusterTypeIndicator cluster={cluster} />
    </div>
  );
}
