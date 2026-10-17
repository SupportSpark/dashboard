import Badge from "@components/Badge";
import FullTooltip from "@components/FullTooltip";
import { ScrollArea } from "@components/ScrollArea";
import { FileKey2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { CertificateCheck } from "@/interfaces/PostureCheck";
import { useCertificateFingerprints } from "@/modules/posture-checks/helper/CertificateHelper";

type Props = {
  check?: CertificateCheck;
  children?: React.ReactNode;
};
export const CertificateTooltip = ({ check, children }: Props) => {
  const t = useTranslations("postureChecks");
  const fingerprints = useCertificateFingerprints(check?.ca_certificates ?? []);

  return check ? (
    <FullTooltip
      className={"w-full min-w-0"}
      interactive={true}
      contentClassName={"p-0"}
      content={
        <div
          className={
            "text-neutral-300 text-sm max-w-xs flex flex-col gap-1 min-w-0"
          }
        >
          <div className={"px-4 pt-3"}>
            <span>
              {t.rich("allowOnlyCaCertificates", {
                allow: (chunks) => (
                  <span className={"text-green-500 font-semibold"}>
                    {chunks}
                  </span>
                ),
              })}
            </span>
          </div>

          <ScrollArea
            className={
              "max-h-[275px] overflow-y-auto flex flex-col px-4 min-w-0"
            }
          >
            <div className={"flex flex-col gap-2 mt-1 text-xs mb-3.5 min-w-0"}>
              {check.ca_certificates.map((_, index) => {
                const fingerprint = fingerprints[index];
                return (
                  <Badge
                    key={index}
                    variant={"gray"}
                    useHover={false}
                    className={"justify-start font-medium text-xs min-w-0"}
                  >
                    <span className={"mr-1.5"}>
                      <FileKey2Icon size={12} />
                    </span>
                    <span
                      className={"truncate inline-block font-mono"}
                      title={fingerprint}
                    >
                      {fingerprint
                        ? `SHA-256 ${fingerprint}`
                        : t("caCertificateIndex", { index: index + 1 })}
                    </span>
                  </Badge>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      }
    >
      {children}
    </FullTooltip>
  ) : (
    children
  );
};
