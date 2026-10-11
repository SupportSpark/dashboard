import { cn } from "@utils/helpers";
import { useTranslations } from "next-intl";
import React from "react";
import { Job } from "@/interfaces/Job";

type Props = {
  job: Job;
};

export default function JobStatusCell({ job }: Readonly<Props>) {
  const t = useTranslations("common");
  const tJobs = useTranslations("jobs");
  const status = job.status;

  return (
    <div
      className={cn("flex gap-2.5 items-center text-nb-gray-300 text-sm")}
      data-testid={"job-status-cell"}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status == "pending" && "bg-yellow-400",
          status == "failed" && "bg-red-500",
          status == "succeeded" && "bg-green-500",
        )}
      ></span>
      {status == "pending" && tJobs("statusPending")}
      {status == "failed" && t("failed")}
      {status == "succeeded" && tJobs("statusCompleted")}
    </div>
  );
}
