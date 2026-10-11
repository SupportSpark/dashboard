import Button from "@components/Button";
import { Table } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";

interface Props<TData> {
  table: Table<TData>;
}
// NOT rendered anywhere — neither in this branch nor upstream: nothing imports
// it. Its "Revoke {n} Key(s)" is left as-is on purpose rather than translated,
// because localizing copy that cannot reach a screen would inflate the
// translation surface and imply the component is live. Remove it, or wire it up
// and translate it then.
export default function DataTableMultiSelectActions<TData>({
  table,
}: Props<TData>) {
  return table.getFilteredSelectedRowModel().rows.length > 0 ? (
    <div>
      <Button variant={"danger-outline"}>
        <Trash2 size={16} />
        Revoke {table.getFilteredSelectedRowModel().rows.length} Key(s)
      </Button>
    </div>
  ) : null;
}
