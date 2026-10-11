import Badge from "@components/Badge";
import Button from "@components/Button";
import CopyToClipboardText from "@components/CopyToClipboardText";
import FullTooltip from "@components/FullTooltip";
import InlineLink from "@components/InlineLink";
import SquareIcon from "@components/SquareIcon";
import { DataTable } from "@components/table/DataTable";
import DataTableHeader from "@components/table/DataTableHeader";
import DataTableRefreshButton from "@components/table/DataTableRefreshButton";
import DataTableResetFilterButton from "@components/table/DataTableResetFilterButton";
import {
  formatRadioChip,
  RadioOption,
  RadioPicker,
} from "@components/table/filters/RadioPicker";
import {
  TableFilterChips,
  TableFilterDef,
  TableFiltersButton,
} from "@components/table/TableFilters";
import GetStartedTest from "@components/ui/GetStartedTest";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { cn } from "@utils/helpers";
import {
  ExternalLinkIcon,
  GlobeIcon,
  HelpCircle,
  PlusCircle,
  ShieldCheckIcon,
  Trash2,
} from "lucide-react";
import { usePathname } from "next/navigation";
import React, { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { usePermissions } from "@/contexts/PermissionsProvider";
import { useReverseProxies } from "@/contexts/ReverseProxiesProvider";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  REVERSE_PROXY_DOCS_LINK,
  ReverseProxyDomain,
  ReverseProxyDomainType,
} from "@/interfaces/ReverseProxy";
import CustomDomainClusterCell from "@/modules/reverse-proxy/domain/CustomDomainClusterCell";
import { CustomDomainModal } from "./CustomDomainModal";
import { CustomDomainVerificationModal } from "./CustomDomainVerificationModal";
import { useTranslations } from "next-intl";

/** Column headers; the definitions take `t` so the labels stay translatable. */
const customDomainsColumns = (
  t: ReturnType<typeof useTranslations<"reverseProxy">>,
  tCommon: ReturnType<typeof useTranslations<"common">>,
): ColumnDef<ReverseProxyDomain>[] => [
  {
    accessorKey: "domain",
    header: ({ column }) => {
      return (
        <DataTableHeader column={column}>{t("domain")}</DataTableHeader>
      );
    },
    sortingFn: "text",
    cell: ({ row }) => <CustomDomainNameCell domain={row.original} />,
  },
  {
    accessorKey: "validated",
    header: ({ column }) => {
      return (
        <DataTableHeader column={column}>{tCommon("status")}</DataTableHeader>
      );
    },
    filterFn: "exactMatch",
    cell: ({ row }) => <CustomDomainStatusCell domain={row.original} />,
  },
  {
    accessorKey: "target_cluster",
    header: ({ column }) => {
      return (
        <DataTableHeader column={column}>{t("clusterColumn")}</DataTableHeader>
      );
    },
    cell: ({ row }) => <CustomDomainClusterCell domain={row.original} />,
  },
  {
    accessorKey: "id",
    header: "",
    cell: ({ row }) => <CustomDomainActionCell domain={row.original} />,
  },
  {
    id: "searchString",
    accessorFn: (row) => row.domain,
  },
];

type Props = {
  headingTarget?: HTMLHeadingElement | null;
};

export default function CustomDomainsTable({ headingTarget }: Readonly<Props>) {
  const t = useTranslations("reverseProxy");
  const tCommon = useTranslations("common");
  const { mutate } = useSWRConfig();
  const path = usePathname();
  const { permission } = usePermissions();
  const { domains, isLoadingDomains, createDomain, validateDomain } =
    useReverseProxies();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] =
    useState<ReverseProxyDomain | null>(null);
  const [selectedTargetCluster, setSelectedTargetCluster] = useState("");

  const [sorting, setSorting] = useLocalStorage<SortingState>(
    "netbird-table-sort" + path,
    [
      {
        id: "domain",
        desc: false,
      },
    ],
  );

  // Filter out free domains - only show custom domains
  const data = useMemo(() => {
    if (!domains) return [];
    return domains.filter((d) => d.type !== ReverseProxyDomainType.FREE);
  }, [domains]);

  const statusOptions = useMemo<RadioOption<boolean | undefined>[]>(
    () => [
      { value: undefined, label: tCommon("all"), dotClass: "bg-nb-gray-500" },
      { value: true, label: tCommon("active"), dotClass: "bg-green-500" },
      {
        value: false,
        label: t("customDomainStatusPending"),
        dotClass: "bg-yellow-400",
      },
    ],
    [t, tCommon],
  );

  const filterDefs = useMemo<TableFilterDef[]>(
    () => [
      {
        id: "validated",
        label: tCommon("status"),
        renderPicker: (p) => (
          <RadioPicker
            value={p.value as boolean | undefined}
            onChange={p.onChange}
            close={p.close}
            options={statusOptions}
          />
        ),
        formatChip: (v) =>
          formatRadioChip(v as boolean | undefined, statusOptions),
      },
    ],
    [statusOptions, tCommon],
  );

  return (
    <>
      <CustomDomainModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onDomainSubmit={async (domainName, targetCluster) => {
          createDomain(domainName, targetCluster).then((d) => {
            setSelectedDomain(d);
            setSelectedTargetCluster(targetCluster);
            setAddModalOpen(false);
            setVerificationModalOpen(true);
          });
        }}
        key={addModalOpen ? 1 : 0}
      />

      {selectedDomain && (
        <CustomDomainVerificationModal
          open={verificationModalOpen}
          onOpenChange={setVerificationModalOpen}
          domain={selectedDomain}
          onStartVerification={(d) => validateDomain(d.id)}
          targetCluster={selectedTargetCluster}
        />
      )}

      <DataTable
        headingTarget={headingTarget}
        isLoading={isLoadingDomains}
        inset={false}
        initialPageSize={10000}
        showResetFilterButton={false}
        keepStateInLocalStorage={false}
        text={t("domainsTableTitle")}
        sorting={sorting}
        setSorting={setSorting}
        columns={customDomainsColumns(t, tCommon)}
        data={data}
        useRowId={true}
        searchPlaceholder={t("searchDomainsTablePlaceholder")}
        aboveTable={(table) => (
          <TableFilterChips table={table} filters={filterDefs} />
        )}
        columnVisibility={{ searchString: false }}
        getStartedCard={
          <GetStartedTest
            icon={
              <SquareIcon
                icon={<GlobeIcon className={"text-nb-gray-200"} size={20} />}
                color={"gray"}
                size={"large"}
              />
            }
            title={t("addCustomDomainsTitle")}
            description={t("addCustomDomainsDescription")}
            button={
              <Button
                variant={"primary"}
                className={""}
                onClick={() => setAddModalOpen(true)}
                disabled={!permission?.services?.create}
                data-testid={"add-custom-domain"}
              >
                <PlusCircle size={16} />
                {t("addDomainBtn")}
              </Button>
            }
            learnMore={
              <>
                {tCommon("learnMoreAbout")}
                <InlineLink href={REVERSE_PROXY_DOCS_LINK} target={"_blank"}>
                  {t("customDomains")}
                  <ExternalLinkIcon size={12} />
                </InlineLink>
              </>
            }
          />
        }
        rightSide={() => (
          <>
            {data && data?.length > 0 && (
              <Button
                variant={"primary"}
                className={"ml-auto"}
                onClick={() => setAddModalOpen(true)}
                disabled={!permission?.services?.create}
                data-testid={"add-custom-domain"}
              >
                <PlusCircle size={16} />
                {t("addDomainBtn")}
              </Button>
            )}
          </>
        )}
      >
        {(table) => (
          <>
            <TableFiltersButton
              table={table}
              filters={filterDefs}
              disabled={data?.length == 0}
            />
            <DataTableResetFilterButton
              table={table}
              onClick={() => {
                table.setPageIndex(0);
                table.resetColumnFilters();
                table.resetGlobalFilter();
              }}
            />
            <DataTableRefreshButton
              isDisabled={data?.length == 0}
              onClick={() => {
                mutate("/reverse-proxies/domains").then();
              }}
            />
          </>
        )}
      </DataTable>
    </>
  );
}

// Cell Components

type CellProps = {
  domain: ReverseProxyDomain;
};

function CustomDomainNameCell({ domain }: Readonly<CellProps>) {
  return (
    <div className="flex items-center gap-2 ml-2">
      <GlobeIcon size={14} className="text-nb-gray-200" />
      <CopyToClipboardText>
        <span className="font-medium">{domain.domain}</span>
      </CopyToClipboardText>
    </div>
  );
}

function CustomDomainStatusCell({ domain }: Readonly<CellProps>) {
  const t = useTranslations("reverseProxy");
  const tCommon = useTranslations("common");
  const { permission } = usePermissions();
  const { validateDomain } = useReverseProxies();
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const isValidated = domain.validated;

  if (isValidated) {
    return (
      <div className={cn("flex gap-2.5 items-center text-nb-gray-300 text-sm")}>
        <span className="h-2 w-2 rounded-full bg-green-500"></span>
        {tCommon("active")}
      </div>
    );
  }

  return (
    <>
      <div
        className={cn("flex gap-4 items-center text-sm")}
        onClick={(e) => e.stopPropagation()}
      >
        <FullTooltip
          content={
            <div className={"text-xs max-w-xs"}>
              {t("dnsPropagationNotice")}
            </div>
          }
          interactive={false}
        >
          <Badge variant={"yellow"} className={"cursor-help"}>
            {t("pendingVerification")}
            <HelpCircle size={12} />
          </Badge>
        </FullTooltip>
        <Button
          variant={"secondary"}
          size={"xs"}
          className={"!px-3"}
          onClick={() => setVerificationModalOpen(true)}
          disabled={!permission?.services?.update}
        >
          <ShieldCheckIcon size={14} />
          {t("verifyDomain")}
        </Button>
      </div>

      <CustomDomainVerificationModal
        open={verificationModalOpen}
        onOpenChange={setVerificationModalOpen}
        domain={domain}
        onStartVerification={(d) => validateDomain(d.id)}
        targetCluster={domain.target_cluster}
      />
    </>
  );
}

function CustomDomainActionCell({ domain }: Readonly<CellProps>) {
  const tCommon = useTranslations("common");
  const { permission } = usePermissions();
  const { deleteDomain } = useReverseProxies();

  return (
    <div
      className={"flex justify-end pr-4"}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant={"danger-outline"}
        size={"sm"}
        onClick={() => deleteDomain(domain)}
        disabled={!permission?.services?.delete}
        data-testid={"delete-custom-domain"}
      >
        <Trash2 size={16} />
        {tCommon("delete")}
      </Button>
    </div>
  );
}
