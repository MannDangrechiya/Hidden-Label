import type { ReactNode } from "react";

/**
 * Admin data table primitive (added for `apps/admin` — DESIGN_TOKENS.md §7 rule 5: admin tables
 * get horizontal scroll with a sticky first column rather than silently collapsing to cards).
 * Flat surface, 1px borders, zebra rows from the documented `surface-low` token. No new colours
 * or radii are introduced — every class here maps to an existing token.
 */
export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Keeps this column visible while the table scrolls horizontally on narrow admin tables. */
  sticky?: boolean;
  align?: "left" | "right";
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export function Table<T>({ columns, rows, rowKey, onRowClick }: TableProps<T>) {
  return (
    <div className="w-full overflow-x-auto border border-line">
      <table className="w-full min-w-[640px] border-collapse font-sans text-body-sm">
        <thead>
          <tr className="border-b border-line bg-surface-low">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={[
                  "whitespace-nowrap px-4 py-3 text-left font-mono text-label-caps uppercase text-on-surface-variant",
                  col.align === "right" ? "text-right" : "text-left",
                  col.sticky ? "sticky left-0 z-10 bg-surface-low" : "",
                ].join(" ")}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={[
                "border-b border-line last:border-b-0",
                index % 2 === 1 ? "bg-surface-low" : "bg-surface",
                onRowClick ? "cursor-pointer hover:bg-surface-high" : "",
              ].join(" ")}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={[
                    "whitespace-nowrap px-4 py-3 text-on-surface",
                    col.align === "right" ? "text-right" : "text-left",
                    col.sticky ? "sticky left-0 z-10 bg-inherit" : "",
                  ].join(" ")}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
