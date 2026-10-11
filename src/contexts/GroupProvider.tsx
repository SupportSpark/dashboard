import { notify } from "@components/Notification";
import { useApiCall } from "@utils/api";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { useDialog } from "@/contexts/DialogProvider";
import { useGroups } from "@/contexts/GroupsProvider";
import { usePermissions } from "@/contexts/PermissionsProvider";
import { Group } from "@/interfaces/Group";
import { Peer } from "@/interfaces/Peer";
import { User } from "@/interfaces/User";
import { EditGroupNameModal } from "@/modules/groups/EditGroupNameModal";
import { useGroupIdentification } from "@/modules/groups/useGroupIdentification";

type Props = {
  group: Group;
  children?: React.ReactNode;
  isDetailPage?: boolean;
};

const GroupContext = React.createContext(
  {} as {
    group: Group;
    deleteGroup: () => Promise<void>;
    renameGroup: (name: string) => Promise<void>;
    isRegularGroup: boolean;
    isIntegrationGroup: boolean;
    isJWTGroup: boolean;
    isAllowedToDelete: boolean;
    isAllowedToRename: boolean;
    openGroupRenameModal?: () => void;
    addPeersToGroup: (peers: Peer[]) => Promise<void>;
    removePeersFromGroup: (peer: Peer[]) => Promise<void>;
    addUsersToGroup: (users: User[]) => Promise<void>;
    removeUsersFromGroup: (users: User[]) => Promise<void>;
  },
);

export const GroupProvider = ({
  group,
  children,
  isDetailPage = true,
}: Props) => {
  const t = useTranslations("groups");
  const tCommon = useTranslations("common");
  const { permission } = usePermissions();
  const [groupNameModal, setGroupNameModal] = useState(false);
  const { mutate } = useSWRConfig();
  const { deleteGroupDropdownOption, updateGroupDropdown } = useGroups();
  const groupRequest = useApiCall<Group>("/groups/" + group.id);
  const userRequest = useApiCall<User>("/users");
  const { confirm } = useDialog();
  const { isRegularGroup, isIntegrationGroup, isJWTGroup } =
    useGroupIdentification({
      id: group?.id,
      issued: group?.issued,
    });

  const isAllowedToRename = isRegularGroup && permission?.groups?.update;
  const isAllowedToDelete = !isIntegrationGroup && permission?.groups?.delete;

  const handleDelete = async () => {
    if (!isAllowedToDelete) return Promise.reject("Not allowed to delete");

    const promise = groupRequest.del().then(() => {
      deleteGroupDropdownOption(group.name);
      if (isDetailPage) mutate(`/groups/${group.id}`);
      mutate("/groups");
    });

    notify({
      title: t("deleteGroupTitle", { name: group.name }),
      description: t("groupDeleted"),
      promise,
      loadingMessage: t("deletingGroup"),
    });

    return promise;
  };

  const deleteGroup = async () => {
    const choice = await confirm({
      title: t("confirmDeleteGroupTitle", { name: group.name }),
      description: t("confirmDeleteGroupDescription"),
      confirmText: tCommon("delete"),
      cancelText: tCommon("cancel"),
      type: "danger",
    });
    if (!choice) return;
    handleDelete().then();
  };

  const renameGroup = (name: string) => {
    if (!isAllowedToRename) return Promise.reject("Not allowed to rename");

    const currentPeerIds =
      group.peers?.map((p) => (typeof p === "string" ? p : p.id)) || [];
    const promise = groupRequest
      .put({ ...group, peers: currentPeerIds, name })
      .then(() => {
        updateGroupDropdown(group.name, { ...group, name });
        if (isDetailPage) mutate(`/groups/${group.id}`);
        mutate("/groups");
      });

    notify({
      title: t("renameGroupTitle", { name: group.name }),
      description: t("groupRenamed", { name }),
      promise,
      loadingMessage: t("renamingGroup"),
    });

    return promise;
  };

  const removePeersFromGroup = async (peers: Peer[]) => {
    if (!permission?.groups?.update) return Promise.reject();
    const peer = peers.length === 1 ? peers[0] : undefined;

    const choice = await confirm({
      title: peer
        ? t("confirmRemovePeerFromGroupTitle", { peer: peer.name, group: group.name })
        : t("confirmRemovePeersFromGroupTitle", { group: group.name }),
      description: peer
        ? t("confirmRemovePeerFromGroupDescription")
        : t("confirmRemovePeersFromGroupDescription"),
      confirmText: tCommon("remove"),
      cancelText: tCommon("cancel"),
      type: "warning",
      maxWidthClass: "max-w-lg",
    });

    if (!choice) return Promise.resolve();

    const currentPeerIds =
      group.peers?.map((p) => (typeof p === "string" ? p : p.id)) || [];
    const newPeerIds = currentPeerIds.filter((pid) => {
      return !peers.find((peer) => peer.id === pid);
    });
    const promise = groupRequest
      .put({ ...group, peers: newPeerIds })
      .then(() => {
        if (isDetailPage) mutate(`/groups/${group.id}`);
        mutate("/groups");
      });

    notify({
      title: t("removePeerFromGroupTitle"),
      description: peer
        ? t("peerRemovedFromGroup", { peer: peer.name, group: group.name })
        : t("peersRemovedFromGroup", { group: group.name }),
      promise,
      loadingMessage: peer
        ? t("removingPeerFromGroup")
        : t("removingPeersFromGroup"),
    });

    return promise;
  };

  const addPeersToGroup = async (peers: Peer[]) => {
    if (!permission?.groups?.update) return Promise.reject();

    const currentPeerIds =
      group.peers?.map((p) => (typeof p === "string" ? p : p.id)) || [];
    const newPeerIds = [...currentPeerIds, ...peers.map((peer) => peer.id)];

    const uniquePeerIds = Array.from(new Set(newPeerIds));

    const promise = groupRequest
      .put({ ...group, peers: uniquePeerIds })
      .then(() => {
        if (isDetailPage) mutate(`/groups/${group.id}`);
        mutate("/groups");
      });

    notify({
      title: t("addingPeersToGroupTitle"),
      description: t("peersAddedToGroup", { group: group.name }),
      promise,
      loadingMessage: t("addingPeersToGroup"),
    });

    return promise;
  };

  const removeUserFromGroup = async (
    user: User,
    returnOnlyPromise?: boolean,
  ) => {
    if (!permission?.groups?.update) return Promise.reject();
    if (!permission?.users?.update) return Promise.reject();

    const currentGroupIds = user.auto_groups?.map((g) => g) || [];
    const newGroupIds = currentGroupIds.filter((gid) => gid !== group.id);
    const promise = userRequest
      .put({ ...user, auto_groups: newGroupIds }, `/${user.id}`)
      .then(() => {
        if (returnOnlyPromise) return;
        if (isDetailPage) mutate(`/groups/${group.id}`);
        mutate("/groups");
        mutate("/users?service_user=false");
      });

    if (!returnOnlyPromise) {
      notify({
        title: t("removeUserFromGroupTitle", { group: group.name }),
        description: t("userRemovedFromGroup", { user: user.name, group: group.name }),
        promise,
        loadingMessage: t("removingUserFromGroup"),
      });
    }

    return promise;
  };

  const removeUsersFromGroup = async (users: User[]) => {
    if (!permission?.groups?.update) return Promise.reject();
    if (!permission?.users?.update) return Promise.reject();
    let promises = users.map((user) => removeUserFromGroup(user, true));

    const user = users.length === 1 ? users[0] : undefined;

    const choice = await confirm({
      title: user
        ? t("confirmRemoveUserFromGroupTitle", {
            user: user?.name ?? user?.id,
            group: group.name,
          })
        : t("confirmRemoveUsersFromGroupTitle", { group: group.name }),
      description: user
        ? t("confirmRemoveUserFromGroupDescription")
        : t("confirmRemoveUsersFromGroupDescription"),
      confirmText: tCommon("remove"),
      cancelText: tCommon("cancel"),
      type: "warning",
      maxWidthClass: "max-w-lg",
    });
    if (!choice) return Promise.resolve();

    const promise = Promise.all(promises).then(() => {
      if (isDetailPage) mutate(`/groups/${group.id}`);
      mutate("/groups");
      mutate("/users?service_user=false");
    });
    notify({
      title: t("removeUsersFromGroupTitle", { group: group.name }),
      description: t("usersRemovedFromGroup", { group: group.name }),
      promise,
      loadingMessage: t("removingUsersFromGroup"),
    });
    return promise;
  };

  const addUserToGroup = async (user: User, returnOnlyPromise?: boolean) => {
    if (!permission?.groups?.update) return Promise.reject();
    if (!permission?.users?.update) return Promise.reject();
    const currentGroupIds = user.auto_groups?.map((g) => g) || [];
    const newGroupIds = Array.from(new Set([...currentGroupIds, group.id]));
    const promise = userRequest
      .put({ ...user, auto_groups: newGroupIds }, `/${user.id}`)
      .then(() => {
        if (returnOnlyPromise) return;
        if (isDetailPage) mutate(`/groups/${group.id}`);
        mutate("/groups");
        mutate("/users?service_user=false");
      });
    if (!returnOnlyPromise) {
      notify({
        title: t("addUserToGroupTitle", { group: group.name }),
        description: t("userAddedToGroup", { user: user.name, group: group.name }),
        promise,
        loadingMessage: t("addingUserToGroup"),
      });
    }
    return promise;
  };

  const addUsersToGroup = async (users: User[]) => {
    let promises = users.map((user) => addUserToGroup(user, true));
    const promise = Promise.all(promises).then(() => {
      if (isDetailPage) mutate(`/groups/${group.id}`);
      mutate("/groups");
      mutate("/users?service_user=false");
    });
    notify({
      title: t("addUsersToGroupTitle", { group: group.name }),
      description: t("usersAddedToGroup", { group: group.name }),
      promise,
      loadingMessage: t("addingUsersToGroup"),
    });
    return promise;
  };

  const openGroupRenameModal = () => {
    if (!isAllowedToRename) return;
    setGroupNameModal(true);
  };

  return (
    <GroupContext.Provider
      value={{
        group,
        deleteGroup,
        renameGroup,
        isRegularGroup,
        isIntegrationGroup,
        isJWTGroup,
        isAllowedToDelete,
        isAllowedToRename,
        openGroupRenameModal,
        addPeersToGroup,
        removePeersFromGroup,
        addUsersToGroup,
        removeUsersFromGroup,
      }}
    >
      <EditGroupNameModal
        initialName={group.name}
        open={groupNameModal}
        onOpenChange={setGroupNameModal}
        onSuccess={(newName) =>
          renameGroup(newName).then(() => {
            setGroupNameModal(false);
          })
        }
      />
      {children}
    </GroupContext.Provider>
  );
};

export const useGroupContext = () => {
  const context = React.useContext(GroupContext);
  if (!context) {
    throw new Error("useGroup must be used within a GroupProvider");
  }
  return context;
};
