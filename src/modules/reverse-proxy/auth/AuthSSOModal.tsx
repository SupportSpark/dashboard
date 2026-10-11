import Button from "@components/Button";
import { Modal, ModalClose, ModalContent } from "@components/modal/Modal";
import ModalHeader from "@components/modal/ModalHeader";
import { PeerGroupSelector } from "@components/PeerGroupSelector";
import { GradientFadedBackground } from "@components/ui/GradientFadedBackground";
import React, { useState } from "react";
import { Group } from "@/interfaces/Group";
import { useUsers } from "@/contexts/UsersProvider";
import Badge from "@components/Badge";
import { CircleUser } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentGroups: Group[];
  isEnabled: boolean;
  onSave: (groups: Group[]) => void;
  onRemove: () => void;
};

export default function AuthSSOModal({
  open,
  onOpenChange,
  currentGroups,
  isEnabled,
  onSave,
  onRemove,
}: Readonly<Props>) {
  const t = useTranslations("common");
  const tr = useTranslations("reverseProxy");
  const { users } = useUsers();
  const [groups, setGroups] = useState<Group[]>(currentGroups);
  const isEditing = isEnabled;

  const handleSave = () => {
    onOpenChange(false);
    onSave(groups);
  };

  const handleRemove = () => {
    onOpenChange(false);
    setGroups([]);
    onRemove();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent maxWidthClass="max-w-xl">
        <ModalHeader
          title={tr("sso")}
          description={tr("ssoDescription")}
        />

        <GradientFadedBackground />

        <div className="px-8">
          <PeerGroupSelector
            values={groups}
            onChange={setGroups}
            placeholder={
              <div className={"flex items-center gap-2"}>
                <Badge className={"py-[3px]"} variant={"gray-ghost"}>
                  <CircleUser size={12} />
                  {tr("allUsers")}
                </Badge>
                {tr("selectUserGroups")}
              </div>
            }
            users={users}
            hideAllGroup={true}
          />
          <div className="flex gap-3 w-full justify-between mt-6">
            {isEditing ? (
              <>
                <Button variant="danger-text" data-testid="remove-sso" onClick={handleRemove}>
                  {tr("removeBtn")}
                </Button>
                <div className="flex gap-3">
                  <ModalClose asChild>
                    <Button variant="secondary">{t("cancel")}</Button>
                  </ModalClose>
                  <Button variant="primary" onClick={handleSave}>
                    {t("save")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div />
                <div className="flex gap-3">
                  <ModalClose asChild>
                    <Button variant="secondary">{t("cancel")}</Button>
                  </ModalClose>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    data-testid="submit-sso"
                  >
                    {tr("addSsoBtn")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
