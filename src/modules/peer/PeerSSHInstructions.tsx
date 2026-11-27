import Button from "@components/Button";
import Code from "@components/Code";
import InlineLink from "@components/InlineLink";
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalFooter,
} from "@components/modal/Modal";
import ModalHeader from "@components/modal/ModalHeader";
import Paragraph from "@components/Paragraph";
import Separator from "@components/Separator";
import Steps from "@components/Steps";
import { Mark } from "@components/ui/Mark";
import { cn } from "@utils/helpers";
import { ExternalLinkIcon, PlusCircle, TerminalSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useState } from "react";
import { SegmentedTabs } from "@components/SegmentedTabs";
import AndroidIcon from "@/assets/icons/AndroidIcon";
import NetBirdIcon from "@/assets/icons/NetBirdIcon";
import { getOperatingSystem } from "@hooks/useOperatingSystem";
import { isNetbirdSSHProtocolSupported } from "@utils/version";
import { OperatingSystem } from "@/interfaces/OperatingSystem";
import { Peer } from "@/interfaces/Peer";
import { PeerSSHPolicyModal } from "@/modules/peer/PeerSSHPolicyModal";

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  peer?: Peer;
};

export const PeerSSHInstructions = ({
  open,
  onOpenChange,
  onSuccess,
  peer,
}: Props) => {
  const t = useTranslations("common");
  const tPeers = useTranslations("peers");
  const tSsh = useTranslations("peerSsh");
  const tReverseProxy = useTranslations("reverseProxy");
  const [client, setClient] = useState("cli");
  // Peers already on v0.61.0+ don't need to be told which release started
  // requiring a policy.
  const peerRequiresSSHPolicy = isNetbirdSSHProtocolSupported(
    peer?.version ?? "",
  );
  const [policyModal, setPolicyModal] = useState(false);

  // Enabling the SSH server and root login require root, or an administrator on
  // Windows, since they decide who may obtain a shell on that machine.
  const isWindows =
    !!peer?.os && getOperatingSystem(peer.os) === OperatingSystem.WINDOWS;
  const prefix = isWindows ? "" : "sudo ";

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        maxWidthClass={cn("relative", "max-w-2xl")}
        showClose={true}
      >
        <ModalHeader
          icon={<TerminalSquare size={16} />}
          title={"Enable SSH Access"}
          description={
            "Allow remote SSH access from other connected network participants."
          }
          color={"netbird"}
        />

        <Separator />

        <div className={"px-8 py-3 flex flex-col gap-0 z-0 mt-1"}>
          <SegmentedTabs value={client} onChange={setClient}>
            <SegmentedTabs.List className={"rounded-lg border"}>
              <SegmentedTabs.Trigger value={"cli"}>
                <TerminalSquare size={16} />
                CLI
              </SegmentedTabs.Trigger>
              <SegmentedTabs.Trigger value={"gui"}>
                <NetBirdIcon size={16} />
                Desktop Client
              </SegmentedTabs.Trigger>
              <SegmentedTabs.Trigger value={"android"}>
                <AndroidIcon size={16} className={"fill-nb-gray-400"} />
                Android
              </SegmentedTabs.Trigger>
            </SegmentedTabs.List>
          </SegmentedTabs>

          <Steps>
            <Steps.Step step={1}>
              {client === "cli" && (
                <>
                  <p className={"font-normal"}>
                    {tSsh("sshCliStep", {
                      scope: isWindows
                        ? tSsh("elevatedPrompt")
                        : tSsh("asRoot"),
                    })}
                  </p>
                  <Code codeToCopy={`${prefix}netbird down`}>
                    <Code.Line>{`${prefix}netbird down`}</Code.Line>
                  </Code>
                  <Code>
                    <Code.Line>{`${prefix}netbird up --allow-server-ssh --enable-ssh-root`}</Code.Line>
                  </Code>
                </>
              )}

              {client === "gui" && (
                <p className={"font-normal"}>
                  {tSsh.rich("sshDesktopStep", {
                    settings: (chunks) => <Mark>{chunks}</Mark>,
                    allowSsh: (chunks) => <Mark>{chunks}</Mark>,
                    ssh: (chunks) => <Mark>{chunks}</Mark>,
                    allowRoot: (chunks) => <Mark>{chunks}</Mark>,
                    who: isWindows
                      ? tSsh("asAdministrator")
                      : tSsh("asRootLogin"),
                  })}
                </p>
              )}

              {client === "android" && (
                <p className={"font-normal"}>
                  {tSsh.rich("sshAndroidStep", {
                    settings: (chunks) => <Mark>{chunks}</Mark>,
                    advanced: (chunks) => <Mark>{chunks}</Mark>,
                    enableSsh: (chunks) => <Mark>{chunks}</Mark>,
                  })}
                </p>
              )}
            </Steps.Step>

            <Steps.Step step={2}>
              <p className={"font-normal"}>
                {tPeers(
                  peerRequiresSSHPolicy
                    ? "sshPolicyRequiredNow"
                    : "sshPolicyRequired",
                )}
              </p>
              <div className={"mt-2"}>
                <Button
                  variant={"secondary"}
                  onClick={() => setPolicyModal(true)}
                >
                  <PlusCircle size={16} />
                  {tPeers("createSSHPolicy")}
                </Button>
              </div>
            </Steps.Step>
            <Steps.Step step={3} line={false}>
              <p className={"font-normal"}>
                {tSsh.rich("sshConfirmStep", {
                  confirm: (chunks) => <Mark>{chunks}</Mark>,
                })}
              </p>
            </Steps.Step>
          </Steps>
        </div>

        <ModalFooter className={"items-center"}>
          <div className={"w-full"}>
            <Paragraph className={"text-sm mt-auto"}>
              {t("learnMoreAbout")}
              <InlineLink
                href={"https://docs.netbird.io/how-to/ssh"}
                target={"_blank"}
              >
                SSH
                <ExternalLinkIcon size={12} />
              </InlineLink>
            </Paragraph>
          </div>
          <div className={"flex gap-3 w-full justify-end"}>
            <ModalClose asChild={true}>
              <Button variant={"secondary"}>{t("cancel")}</Button>
            </ModalClose>

            <Button variant={"primary"} onClick={onSuccess}>
              {tReverseProxy("finishSetupBtn")}
            </Button>
          </div>
        </ModalFooter>

        <PeerSSHPolicyModal
          open={policyModal}
          onOpenChange={setPolicyModal}
          peer={peer}
        />
      </ModalContent>
    </Modal>
  );
};
