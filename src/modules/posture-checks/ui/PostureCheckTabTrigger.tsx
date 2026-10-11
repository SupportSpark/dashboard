import { TabsTrigger } from "@components/Tabs";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

type Props = {
  disabled?: boolean;
};

export const PostureCheckTabTrigger = ({ disabled = false }: Props) => {
  const t = useTranslations("postureChecks");
  return (
    <TabsTrigger value={"posture_checks"} disabled={disabled}>
      <ShieldCheck size={16} />
      {t("title")}
    </TabsTrigger>
  );
};
