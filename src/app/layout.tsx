import { globalMetaTitle } from "@utils/meta";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import AppLayout from "@/layouts/AppLayout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    title: `${globalMetaTitle}`,
    description: t("metaDescription"),
  };
}

export default AppLayout;
