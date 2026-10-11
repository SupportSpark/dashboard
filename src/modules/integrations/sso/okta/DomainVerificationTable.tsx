import Card from "@components/Card";
import { DataTable } from "@components/table/DataTable";
import DataTableHeader from "@components/table/DataTableHeader";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useState } from "react";
import { EnterpriseConnectionDomain } from "@/interfaces/IdentityProvider";
import LastTimeRow from "@/modules/common-table-rows/LastTimeRow";

export const DomainTableColumns = (
  t: (key: string, values?: any) => string,
  tCommon: (key: string, values?: any) => string,
  tPeers: (key: string, values?: any) => string,
): ColumnDef<EnterpriseConnectionDomain>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <DataTableHeader column={column}>{tPeers("domain")}</DataTableHeader>
      );
    },
    sortingFn: "text",
  },
  {
    accessorKey: "validation_status",
    header: ({ column }) => {
      return (
        <DataTableHeader column={column}>{tCommon("status")}</DataTableHeader>
      );
    },
    sortingFn: "text",
  },
  {
    accessorKey: "validation_last_updated",
    header: ({ column }) => {
      return (
        <DataTableHeader column={column}>{t("lastCheck")}</DataTableHeader>
      );
    },
    sortingFn: "text",
    cell: ({ row }) => (
      <LastTimeRow
        date={dayjs(row.original.validation_last_updated).toDate()}
        text={t("lastCheckedOn")}
      />
    ),
  },
];

type Props = {
  domains: EnterpriseConnectionDomain[];
};
export const DomainVerificationTable = ({ domains }: Props) => {
  const t = useTranslations("idpSync");
  const tCommon = useTranslations("common");
  const tPeers = useTranslations("peers");
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "is_current",
      desc: true,
    },
    {
      id: "name",
      desc: true,
    },
  ]);

  return (
    <Card className={"w-full"}>
      <DataTable
        showHeader={false}
        tableClassName={"w-full mt-0"}
        minimal={true}
        showSearchAndFilters={false}
        text={t("domainsTitle")}
        sorting={sorting}
        setSorting={setSorting}
        columns={DomainTableColumns(t, tCommon, tPeers)}
        data={domains}
      />
    </Card>
  );
};
