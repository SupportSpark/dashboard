import Card from "@components/Card";
import { DataTable } from "@components/table/DataTable";
import DataTableHeader from "@components/table/DataTableHeader";
import NoResults from "@components/ui/NoResults";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useMemo, useState } from "react";
import Skeleton from "react-loading-skeleton";
import DomainActionCell from "@/cloud/sign-in-domains/table/DomainActionCell";
import DomainStatusCell from "@/cloud/sign-in-domains/table/DomainStatusCell";
import { DomainValidationStatus, SignInDomain } from "@/interfaces/Account";

type Props = {
  domains?: SignInDomain[];
  isLoading?: boolean;
};

const PLACEHOLDER_ID = "__loading__";

const placeholderRow: SignInDomain = {
  id: PLACEHOLDER_ID,
  name: "",
  is_primary: false,
  validation_token: "",
  validation_status: DomainValidationStatus.PENDING,
  validation_last_updated: null,
};

const isPlaceholder = (domain: SignInDomain) => domain.id === PLACEHOLDER_ID;

// Factory rather than a module-scope array: the headers are translated, and
// `t` is a React hook, so it can only be called while rendering.
const SignInDomainsColumns = (
  t: (key: string) => string,
  tCommon: (key: string) => string,
): ColumnDef<SignInDomain>[] => [
  {
    header: ({ column }) => {
      return (
        <DataTableHeader column={column}>{t("domainColumn")}</DataTableHeader>
      );
    },
    accessorKey: "name",
    sortingFn: "text",
    cell: ({ row }) =>
      isPlaceholder(row.original) ? (
        <Skeleton height={10} width={"60%"} />
      ) : (
        <div className={"text-sm text-nb-gray-100"}>{row.original.name}</div>
      ),
  },
  {
    header: ({ column }) => {
      return (
        <DataTableHeader column={column}>{tCommon("status")}</DataTableHeader>
      );
    },
    accessorKey: "validation_status",
    sortingFn: "text",
    cell: ({ row }) =>
      isPlaceholder(row.original) ? (
        <Skeleton height={10} width={"50%"} />
      ) : (
        <DomainStatusCell domain={row.original} />
      ),
  },
  {
    accessorKey: "id",
    header: () => null,
    enableSorting: false,
    cell: ({ row }) =>
      isPlaceholder(row.original) ? (
        <div className={"flex items-center justify-end ml-auto min-h-[34px]"} />
      ) : (
        <DomainActionCell domain={row.original} />
      ),
  },
];

export default function SignInDomainsTable({
  domains,
  isLoading,
}: Readonly<Props>) {
  const t = useTranslations("signInDomains");
  const tCommon = useTranslations("common");
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "name",
      desc: false,
    },
  ]);

  const columns = useMemo(
    () => SignInDomainsColumns(t, tCommon),
    [t, tCommon],
  );

  return (
    <DataTable
      wrapperComponent={Card}
      wrapperProps={{ className: "w-full pb-1" }}
      useRowId={true}
      sorting={sorting}
      setSorting={setSorting}
      minimal={true}
      showSearchAndFilters={false}
      inset={false}
      tableClassName={"mt-0"}
      text={t("domainsTableTitle")}
      columns={columns}
      keepStateInLocalStorage={false}
      data={isLoading ? [placeholderRow] : domains}
      getStartedCard={
        <NoResults
          className={"py-4"}
          hideIcon
          title={t("noSignInDomainsYet")}
          description={t("noDomainsDescription")}
        />
      }
      paginationPaddingClassName={"px-0 pt-8"}
    />
  );
}
