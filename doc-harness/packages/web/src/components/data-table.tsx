"use client";

import { useState } from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  onRowClick?: (item: T) => void;
  searchFields?: (keyof T)[];
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  searchPlaceholder = "Search...",
  onRowClick,
  searchFields = [],
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");

  const filtered = search && searchFields.length > 0
    ? data.filter((item) =>
        searchFields.some((field) =>
          String(item[field] ?? "").toLowerCase().includes(search.toLowerCase())
        )
      )
    : data;

  return (
    <div>
      {searchFields.length > 0 && (
        <div className="p-4 border-b border-border">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full max-w-xs px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th key={col.key} className={`text-left p-3 text-xs text-text-muted uppercase tracking-wider font-medium ${col.className ?? ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-text-muted text-sm">
                  No results found
                </td>
              </tr>
            ) : (
              filtered.map((item, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(item)}
                  className={`border-b border-border/50 ${onRowClick ? "cursor-pointer hover:bg-surface-hover transition-colors" : ""}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`p-3 text-sm ${col.className ?? ""}`}>
                      {col.render ? col.render(item) : String(item[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
