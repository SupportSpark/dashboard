import Button from "@components/Button";
import { Callout } from "@components/Callout";
import HelpText from "@components/HelpText";
import { Input } from "@components/Input";
import { Label } from "@components/Label";
import { Modal, ModalContent, ModalFooter } from "@components/modal/Modal";
import ModalHeader from "@components/modal/ModalHeader";
import Separator from "@components/Separator";
import { KeyRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useState } from "react";

type Props = {
  open: boolean;
  peerName: string;
  port: number;
  // rejected is true when this prompt is reopening because the last password
  // was refused, rather than because a server asked for the first time.
  rejected?: boolean;
  // onSubmit hands the password to the waiting handshake. It reports false
  // when no request is outstanding any more, which happens when the server
  // gave up while the prompt was open.
  onSubmit: (password: string) => boolean;
  onCancel: () => void;
};

/**
 * Asks for the password a third-party VNC server requested.
 *
 * Shaped like RDPCertificateModal rather than RDPCredentialsModal because it
 * is the same kind of ask: something the server raised partway through a
 * connection that is already open and waiting on an answer. RDP credentials
 * can be collected up front since RDP always authenticates, whereas a VNC
 * server only names its security types during the RFB handshake and plenty
 * ask for nothing at all, so whether a password is needed is not known until
 * it is needed.
 */
export const VNCPasswordModal = ({
  open,
  peerName,
  port,
  rejected,
  onSubmit,
  onCancel,
}: Props) => {
  const t = useTranslations("vnc");
  const tRemote = useTranslations("remoteAccess");
  const tCommon = useTranslations("common");
  const [password, setPassword] = useState("");
  const [stale, setStale] = useState(false);

  const submit = () => {
    // An empty password is a valid answer: VNCAuth servers can be set up with one.
    if (stale) return;
    if (!onSubmit(password)) {
      setStale(true);
    }
  };

  return (
    <Modal open={open} onOpenChange={undefined}>
      <ModalContent maxWidthClass={"max-w-lg"} showClose={false}>
        <ModalHeader
          icon={<KeyRoundIcon className={"text-netbird"} size={18} />}
          title={t("passwordTitle")}
          description={t("passwordDescription", { peer: peerName, port })}
          color={"netbird"}
        />
        <Separator />

        <form
          className={"px-8 py-6 flex flex-col gap-6"}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {rejected && !stale && (
            <Callout variant={"error"}>{t("passwordRejected")}</Callout>
          )}

          {stale && <Callout variant={"warning"}>{t("passwordStale")}</Callout>}

          <div>
            <Label>{t("password")}</Label>
            <HelpText>{t("passwordHelp")}</HelpText>
            <Input
              value={password}
              placeholder={tRemote("enterPasswordPlaceholder")}
              type={"password"}
              onChange={(e) => setPassword(e.target.value)}
              name="password"
              autoComplete={"current-password"}
              autoFocus={true}
              customPrefix={
                <KeyRoundIcon size={16} className={"text-nb-gray-300"} />
              }
            />
          </div>
        </form>

        <ModalFooter className={"items-center"}>
          <div className={"flex gap-3 w-full justify-end"}>
            <Button variant={"secondary"} onClick={onCancel}>
              {tCommon("cancel")}
            </Button>
            <Button variant={"primary"} disabled={stale} onClick={submit}>
              {tRemote("connect")}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
