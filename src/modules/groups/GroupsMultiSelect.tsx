import Button from "@components/Button";
import { useTranslations } from "next-intl";
import FullTooltip from "@components/FullTooltip";
import { notify } from "@components/Notification";
import { DataTableMultiSelectPopup } from "@components/table/DataTableMultiSelectPopup";
import { ErrorResponse, useApiCall } from "@utils/api";
import { FolderGit2, Trash2 } from "lucide-react";
import { useSWRConfig } from "swr";
import { useDialog } from "@/contexts/DialogProvider";
import { useGroups } from "@/contexts/GroupsProvider";
import { usePermissions } from "@/contexts/PermissionsProvider";
import { Group } from "@/interfaces/Group";
import { GroupUsage } from "@/modules/groups/useGroupsUsage";

type Props = {
  selectedGroups?: GroupUsage[];
  onCanceled?: () => void;
};

export const GroupsMultiSelect = ({

  selectedGroups = [],
  onCanceled,
}: Readonly<Props>) => {
  const tgrp = useTranslations("groups");
  const tCommon = useTranslations("common");
  const { mutate } = useSWRConfig();
  const { confirm } = useDialog();
  const { deleteGroupDropdownOption } = useGroups();
  const { permission } = usePermissions();
  const groupCall = useApiCall<Group>("/groups", true);
  const groupCount = selectedGroups.length;

  const deleteAllGroups = async () => {
    if (!permission.groups.delete || groupCount === 0) return;

    const choice = await confirm({
      title: tgrp("deleteGroupsConfirmTitle", { count: groupCount }),
      description: tgrp("deleteGroupsConfirmDescription", {
        count: groupCount,
      }),
      confirmText: tgrp("deleteAll"),
      cancelText: tCommon("cancel"),
      type: "danger",
    });
    if (!choice) return;

    // Take the batch and drop the selection now rather than when the requests
    // land, so a slow batch cannot wipe a selection the user made in the
    // meantime, and the popup acknowledges the confirmation immediately.
    const groupsToDelete = selectedGroups;
    onCanceled?.();

    // allSettled, not all: the in-use counts driving the checkboxes come from a
    // client-side snapshot, so the server can still reject an individual group.
    // The table has to refresh for the ones that did get deleted either way.
    const promise = Promise.allSettled(
      groupsToDelete.map((group) => groupCall.del({}, `/${group.id}`)),
    ).then((results) => {
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          deleteGroupDropdownOption(groupsToDelete[index].name);
        }
      });
      mutate("/groups");

      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length === 0) return;

      const firstError = failures[0].reason as ErrorResponse | undefined;
      const failureMessage =
        firstError?.message ?? tCommon("somethingWentWrong");
      return Promise.reject({
        code: firstError?.code ?? 418,
        requestId: firstError?.requestId,
        message:
          failures.length === groupCount
            ? failureMessage
            : tgrp("groupsCouldNotBeDeleted", {
                failed: failures.length,
                total: groupCount,
                message: failureMessage,
              }),
      } satisfies ErrorResponse);
    });

    notify({
      title: tgrp("deleteGroupsTitle"),
      description:
        groupCount > 1 ? tgrp("groupsDeleted") : tgrp("groupDeleted"),
      promise,
      loadingMessage:
        groupCount > 1
          ? tgrp("deletingSelectedGroups")
          : tgrp("deletingSelectedGroup"),
    });
  };

  return (
    <DataTableMultiSelectPopup
      selectedItems={selectedGroups}
      label={
        groupCount === 1
          ? tgrp("groupSelected")
          : tgrp("groupsSelected")
      }
      onCanceled={onCanceled}
      icon={<FolderGit2 size={16} />}
      rightSide={
        <FullTooltip
          content={<span className={"text-xs"}>{tgrp("deleteAll")}</span>}
        >
          <Button
            variant={"danger-outline"}
            size={"xs"}
            className={"!h-9 !w-9"}
            onClick={deleteAllGroups}
            disabled={!permission.groups.delete}
            aria-label={tgrp("deleteSelectedGroups")}
          >
            <Trash2 size={16} className={"shrink-0"} />
          </Button>
        </FullTooltip>
      }
    />
  );
};
