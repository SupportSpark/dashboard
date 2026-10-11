import { Node } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { Policy } from "@/interfaces/Policy";
import { useDraftChangeset } from "@/modules/control-center/draft/DraftChangesetContext";
import { useDraftGroupActions } from "@/modules/control-center/hooks/useDraftGroupActions";
import { NodeType } from "@/modules/control-center/utils/nodes";

const GROUP_NODE_TYPES = new Set<string>([
  NodeType.GroupNode,
  NodeType.SourceGroupNode,
  NodeType.DestinationGroupNode,
]);

// Remove never confirms, but it still keeps the changeset honest — React Flow's
// raw node deletion would skip the policy strips.
export function useNodeRemoval() {
  const t = useTranslations("controlCenter");
  const { removeGroups, removeNodeWithEdges } = useDraftGroupActions();
  const { trackDeletePolicy, trackDeleteProvider, trackDeleteAgentPolicy } =
    useDraftChangeset();

  const removeAgentNodeFromCanvas = useCallback(
    (node: Node) => {
      const data = node.data as { id?: string; name?: string };
      const recordId = data?.id;
      if (recordId?.startsWith("new-")) {
        if (node.type === NodeType.ProviderNode) {
          trackDeleteProvider({
            providerId: recordId,
            name: data?.name ?? t("provider"),
          });
        } else {
          trackDeleteAgentPolicy({
            agentPolicyId: recordId,
            name: data?.name ?? t("agentPolicyLabel"),
          });
        }
      }
      removeNodeWithEdges(node.id);
    },
    [trackDeleteProvider, trackDeleteAgentPolicy, removeNodeWithEdges, t],
  );

  // Off the canvas a policy authorizes nothing, so it deploys as a deletion.
  const removePolicyFromCanvas = useCallback(
    (node: Node) => {
      const nodePolicy = node.data?.policy as Policy | undefined;
      if (!nodePolicy) return;

      trackDeletePolicy({
        policyId: node.id.replace("policy-", ""),
        name: nodePolicy.name ?? t("policy"),
      });
      removeNodeWithEdges(node.id);
    },
    [trackDeletePolicy, removeNodeWithEdges, t],
  );

  // Remove is withheld where taking the node off the canvas amounts to deleting
  // the entity itself — those get Delete, which confirms.
  const canRemoveNode = useCallback((node: Node) => {
    if (
      node.type === NodeType.SelectPeerNode ||
      node.type === NodeType.SelectGroupNode ||
      node.type === NodeType.SelectUserNode
    ) {
      return false;
    }
    if (node.type === NodeType.PolicyNode) {
      return node.id.startsWith("policy-new-");
    }
    if (node.type === NodeType.ResourceNode) {
      const isDraftResource = node.id.startsWith("resource-new-");
      const isFramed = !!node.parentId;
      return isDraftResource || !isFramed;
    }
    if (
      node.type === NodeType.ProviderNode ||
      node.type === NodeType.AgentPolicyNode
    ) {
      const recordId = (node.data as { id?: string })?.id ?? "";
      return recordId.startsWith("new-");
    }
    return true;
  }, []);

  // Group nodes go through removeGroups as ONE batch: per-node calls each read the
  // same pre-removal store, so only the last policy strip would survive.
  const removeNodes = useCallback(
    (nodes: Node[]) => {
      const removable = nodes.filter(canRemoveNode);
      removeGroups(removable.filter((n) => GROUP_NODE_TYPES.has(n.type ?? "")));
      removable.forEach((node) => {
        if (GROUP_NODE_TYPES.has(node.type ?? "")) return;
        if (node.type === NodeType.PolicyNode) {
          removePolicyFromCanvas(node);
          return;
        }
        if (
          node.type === NodeType.ProviderNode ||
          node.type === NodeType.AgentPolicyNode
        ) {
          removeAgentNodeFromCanvas(node);
          return;
        }
        removeNodeWithEdges(node.id);
      });
    },
    [
      canRemoveNode,
      removeGroups,
      removePolicyFromCanvas,
      removeAgentNodeFromCanvas,
      removeNodeWithEdges,
    ],
  );

  const removeNode = useCallback(
    (node: Node) => removeNodes([node]),
    [removeNodes],
  );

  return { removeNode, removeNodes, canRemoveNode, removePolicyFromCanvas };
}
