import Button from "@components/Button";
import { Callout } from "@components/Callout";
import HelpText from "@components/HelpText";
import { Input } from "@components/Input";
import { Label } from "@components/Label";
import { Modal, ModalContent, ModalFooter } from "@components/modal/Modal";
import ModalHeader from "@components/modal/ModalHeader";
import { SegmentedTabs } from "@components/SegmentedTabs";
import { SelectDropdown } from "@components/select/SelectDropdown";
import Separator from "@components/Separator";
import { useTranslations } from "next-intl";
import { getOperatingSystem } from "@hooks/useOperatingSystem";
import { IconLoader2 } from "@tabler/icons-react";
import {
  ChevronsLeftRightEllipsis,
  MonitorIcon,
  ScreenShareIcon,
  ServerIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  User2,
  UserIcon,
} from "lucide-react";
import * as React from "react";
import { useMemo, useState } from "react";
import { OperatingSystem } from "@/interfaces/OperatingSystem";
import { Peer } from "@/interfaces/Peer";
import {
  DEFAULT_EXTERNAL_VNC_PORT,
  type VNCMode,
  type VNCTarget,
} from "@/modules/remote-access/vnc/useVNC";

// VNCConnectChoice is everything the viewer needs decided before it dials.
export type VNCConnectChoice = {
  target: VNCTarget;
  port: number;
  mode: VNCMode;
  username: string;
  // ipVersion is "4", "6", or "" to let the dialer pick.
  ipVersion: string;
};

type Props = {
  open: boolean;
  peer: Peer;
  // netbirdSupported is whether the client ships a screen capturer for the
  // peer's operating system; netbirdEnabled whether the peer switched the
  // server on. Both are needed, and they are separate because the remedy is.
  netbirdSupported: boolean;
  netbirdEnabled: boolean;
  initial: VNCConnectChoice;
  error?: string;
  loading?: boolean;
  onConnect: (choice: VNCConnectChoice) => void;
};

export const VNCConnectModal = ({
  open,
  peer,
  netbirdSupported,
  netbirdEnabled,
  initial,
  error,
  loading,
  onConnect,
}: Props) => {
  const t = useTranslations("vnc");
  const tRemote = useTranslations("remoteAccess");
  const netbirdAvailable = netbirdSupported && netbirdEnabled;
  const [target, setTarget] = useState<VNCTarget>(
    netbirdAvailable ? initial.target : "external",
  );
  const [port, setPort] = useState(String(initial.port));
  const [mode, setMode] = useState<VNCMode>(initial.mode);
  const [username, setUsername] = useState(initial.username);
  const [ipVersion, setIpVersion] = useState(initial.ipVersion);

  const isExternal = target === "external";
  const peerOS = getOperatingSystem(peer?.os);
  // Only NetBird's server can start a second desktop, and only where the
  // client can bring one up.
  const supportsSessionMode =
    !isExternal &&
    (peerOS === OperatingSystem.LINUX || peerOS === OperatingSystem.FREEBSD);
  const effectiveMode: VNCMode = supportsSessionMode ? mode : "attach";

  const portError = useMemo(() => {
    if (!isExternal) return undefined;
    const parsed = Number(port);
    const valid = Number.isInteger(parsed) && parsed > 0 && parsed <= 65535;
    if (!valid) return tRemote("portRangeError");
  }, [isExternal, port, tRemote]);

  const usernameError = useMemo(() => {
    if (effectiveMode !== "session") return undefined;
    if (!username.trim()) return tRemote("usernameCannotBeEmpty");
  }, [effectiveMode, username, tRemote]);

  const hasError = portError !== undefined || usernameError !== undefined;

  const handleConnect = () => {
    if (hasError || loading) return;
    onConnect({
      target,
      // The port field is only validated while it is on screen, so whatever
      // was typed before switching to NetBird is not necessarily a number.
      // Committing NaN would put it back in the field on the way out again.
      port: isExternal ? Number(port) : DEFAULT_EXTERNAL_VNC_PORT,
      mode: effectiveMode,
      username,
      ipVersion,
    });
  };

  return (
    <Modal open={open} onOpenChange={undefined}>
      <ModalContent maxWidthClass={"max-w-xl"} showClose={false}>
        <ModalHeader
          icon={<ScreenShareIcon className={"text-netbird"} size={18} />}
          title={peer.name}
          description={t("connectToPeerViaVnc", { ip: peer.ip })}
          color={"netbird"}
        />
        <Separator />

        <form
          className={"px-8 py-6 flex flex-col gap-8"}
          onSubmit={(e) => {
            e.preventDefault();
            handleConnect();
          }}
        >
          {error && (
            <Callout variant={"error"} icon={<TriangleAlertIcon size={14} />}>
              {error}
            </Callout>
          )}

          <div>
            <Label>{t("server")}</Label>
            <HelpText>
              {isExternal ? t("serverExternalHelp") : t("serverNetBirdHelp")}
            </HelpText>
            <SegmentedTabs
              value={target}
              onChange={(value) => setTarget(value as VNCTarget)}
            >
              <SegmentedTabs.List className="rounded-lg border">
                <SegmentedTabs.Trigger
                  value="netbird"
                  disabled={!netbirdAvailable}
                >
                  <ShieldCheckIcon size={16} />
                  NetBird
                </SegmentedTabs.Trigger>
                <SegmentedTabs.Trigger value="external">
                  <ServerIcon size={16} />
                  {t("external")}
                </SegmentedTabs.Trigger>
              </SegmentedTabs.List>
            </SegmentedTabs>
            {!netbirdAvailable && (
              <HelpText className={"mt-3"}>
                {netbirdSupported
                  ? t("serverNotEnabledHelp")
                  : t("serverUnsupportedHelp")}
              </HelpText>
            )}
          </div>

          {isExternal && (
            <div>
              <Label>{tRemote("port")}</Label>
              <HelpText>{t("portHelp")}</HelpText>
              <Input
                maxWidthClass={""}
                placeholder={String(DEFAULT_EXTERNAL_VNC_PORT)}
                min={1}
                max={65535}
                value={port}
                type={"number"}
                error={portError}
                errorTooltip={true}
                errorTooltipPosition={"top-right"}
                onChange={(e) => setPort(e.target.value)}
                customPrefix={
                  <ChevronsLeftRightEllipsis
                    size={16}
                    className={"text-nb-gray-300"}
                  />
                }
              />
            </div>
          )}

          {supportsSessionMode && (
            <div>
              <Label>{t("session")}</Label>
              <HelpText>{t("sessionHelp")}</HelpText>
              <SegmentedTabs
                value={mode}
                onChange={(value) => setMode(value as VNCMode)}
              >
                <SegmentedTabs.List className="rounded-lg border">
                  <SegmentedTabs.Trigger value="attach">
                    <MonitorIcon size={16} />
                    {t("currentScreen")}
                  </SegmentedTabs.Trigger>
                  <SegmentedTabs.Trigger value="session">
                    <UserIcon size={16} />
                    {t("newDesktop")}
                  </SegmentedTabs.Trigger>
                </SegmentedTabs.List>
              </SegmentedTabs>
            </div>
          )}

          {effectiveMode === "session" && (
            <div>
              <Label>{t("user")}</Label>
              <HelpText>{t("userHelp")}</HelpText>
              <Input
                placeholder={"root"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                name="username"
                autoComplete={"username"}
                error={usernameError}
                errorTooltip={true}
                errorTooltipPosition={"top-right"}
                customPrefix={
                  <User2 size={16} className={"text-nb-gray-300"} />
                }
              />
            </div>
          )}

          <div>
            <Label>{t("ipVersion")}</Label>
            <HelpText>{t("ipVersionHelp")}</HelpText>
            <SelectDropdown
              value={ipVersion}
              onChange={setIpVersion}
              options={[
                { value: "", label: t("ipVersionAutomatic") },
                { value: "4", label: "IPv4" },
                { value: "6", label: "IPv6", disabled: !peer.ipv6 },
              ]}
            />
          </div>
        </form>

        <ModalFooter className={"items-center"}>
          <div className={"flex gap-3 w-full justify-end"}>
            <Button
              type="submit"
              variant={"primary"}
              disabled={hasError || loading}
              onClick={handleConnect}
            >
              {loading && <IconLoader2 size={16} className={"animate-spin"} />}
              {tRemote("connect")}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
