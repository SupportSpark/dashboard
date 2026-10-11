import React, { useEffect, useMemo, useState } from "react";
import Button from "@components/Button";
import { Input } from "@components/Input";
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalFooter,
} from "@components/modal/Modal";
import ModalHeader from "@components/modal/ModalHeader";
import { trim } from "lodash";
import { useTranslations } from "next-intl";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (name: string) => void;
  currentName: string;
  // Group names, placeholder peer names on the canvas, …
  takenNames: string[];
  duplicateError?: string;
  title?: string;
  description?: string;
  inputPlaceholder?: string;
};

export const GroupRenameModal = ({
  open,
  onOpenChange,
  onRename,
  currentName,
  takenNames,
  duplicateError,
  title,
  description,
  inputPlaceholder,
}: Props) => {
  const t = useTranslations("controlCenter");
  const tCommon = useTranslations("common");

  // These defaults cannot live in the destructuring above: a default parameter
  // is evaluated before `t` exists, so `title = t("renameGroup")` is an illegal
  // reference to an uninitialised binding.
  const resolvedTitle = title ?? t("renameGroup");
  const resolvedDescription = description ?? t("renameGroupDescription");
  const resolvedDuplicateError =
    duplicateError ?? t("groupAlreadyExists");
  const resolvedPlaceholder = inputPlaceholder ?? t("groupNamePlaceholder");
  const [name, setName] = useState(currentName);
  const [error, setError] = useState("");

  const isDisabled = useMemo(() => {
    if (error !== "") return true;
    const trimmed = trim(name);
    return trimmed.length === 0 || trimmed === currentName;
  }, [name, error, currentName]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    const exists =
      newName !== currentName && takenNames.includes(trim(newName));
    setError(exists ? resolvedDuplicateError : "");
    setName(newName);
  };

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError("");
    }
  }, [open, currentName]);

  const submit = () => {
    if (isDisabled) return;
    onOpenChange(false);
    onRename(trim(name));
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent maxWidthClass={"max-w-md"}>
        <ModalHeader
          title={resolvedTitle}
          description={resolvedDescription}
          color={"blue"}
        />
        <div className={"p-default flex flex-col"}>
          <Input
            placeholder={resolvedPlaceholder}
            value={name}
            onChange={handleNameChange}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            error={error}
            autoFocus
            data-testid="cc-rename-input"
          />
        </div>
        <ModalFooter className={"items-center"} separator={false}>
          <div className={"flex gap-3 w-full justify-end"}>
            <ModalClose asChild={true}>
              <Button variant={"secondary"} className={"w-full"}>
                {tCommon("cancel")}
              </Button>
            </ModalClose>
            <Button
              variant={"primary"}
              className={"w-full"}
              disabled={isDisabled}
              onClick={submit}
              data-testid="cc-rename-submit"
            >
              {t("rename")}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
