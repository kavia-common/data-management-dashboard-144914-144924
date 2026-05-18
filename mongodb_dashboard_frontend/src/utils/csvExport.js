function escapeCsvCell(value) {
  if (value === null || value === undefined) return "";

  // Normalize objects to JSON for debuggability rather than "[object Object]"
  const asString =
    typeof value === "object" && !(value instanceof Date) ? JSON.stringify(value) : String(value);

  // CSV quoting rules: wrap in quotes if contains comma, quote, or newline; double any quotes.
  if (/[",\n\r]/.test(asString)) {
    return `"${asString.replace(/"/g, '""')}"`;
  }
  return asString;
}

/**
 * PUBLIC_INTERFACE
 * buildCsvString
 * Build a CSV string from a list of rows and explicit column definitions.
 *
 * Contract:
 * Inputs:
 *  - columns: Array<{ key: string, label: string, getValue?: (row:any)=>any }>
 *      - key: stable identifier
 *      - label: column header label written to CSV
 *      - getValue (optional): extractor for the cell; defaults to row[key]
 *  - rows: Array<any> (already filtered/sorted/paginated as desired by the caller)
 *  - options:
 *      - includeBom?: boolean (default true) - adds UTF-8 BOM for Excel compatibility
 *
 * Output:
 *  - string containing CSV data with CRLF line endings
 *
 * Errors:
 *  - throws Error when columns is empty or not an array
 *
 * Side effects: none
 */
export function buildCsvString(columns, rows, options = {}) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("buildCsvString: columns must be a non-empty array");
  }

  const safeRows = Array.isArray(rows) ? rows : [];
  const includeBom = options?.includeBom !== false;

  const header = columns.map((c) => escapeCsvCell(c?.label ?? c?.key ?? "")).join(",");

  const lines = safeRows.map((row) => {
    const cells = columns.map((c) => {
      const key = c?.key;
      const getter = typeof c?.getValue === "function" ? c.getValue : (r) => (r ? r[key] : undefined);
      return escapeCsvCell(getter(row));
    });
    return cells.join(",");
  });

  // CRLF for best compatibility (Excel, etc.)
  const csvBody = [header, ...lines].join("\r\n");
  return includeBom ? `\uFEFF${csvBody}` : csvBody;
}

/**
 * PUBLIC_INTERFACE
 * downloadTextFile
 * Browser download helper that triggers saving a text file.
 *
 * Contract:
 * Inputs:
 *  - filename: string (required)
 *  - content: string (required)
 *  - mimeType: string (default "text/plain;charset=utf-8")
 *
 * Output: void
 *
 * Errors:
 *  - throws Error if filename/content missing
 *
 * Side effects:
 *  - creates an object URL and clicks an <a> element to trigger download
 */
export function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  if (!filename) throw new Error("downloadTextFile: filename is required");
  if (content === null || content === undefined) throw new Error("downloadTextFile: content is required");

  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);

  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    window.URL.revokeObjectURL(url);
  }
}

/**
 * PUBLIC_INTERFACE
 * exportRowsToCsvFlow
 * Reusable flow entrypoint for exporting a set of rows as CSV.
 *
 * Flow name: ExportRowsToCsvFlow
 * Entrypoint: exportRowsToCsvFlow()
 *
 * Contract:
 * Inputs:
 *  - filename: string
 *  - columns: Array<{ key, label, getValue? }>
 *  - rows: Array<any> (the exact dataset to export; caller decides whether it's "current page" or "all filtered")
 *
 * Output:
 *  - { filename, rowCount, byteLength }
 *
 * Errors:
 *  - throws Error with contextual message on build/download failure
 *
 * Side effects:
 *  - triggers a browser file download
 *
 * Observability:
 *  - dev console logs include flow name + rowCount for debug
 */
export function exportRowsToCsvFlow({ filename, columns, rows }) {
  const flowName = "ExportRowsToCsvFlow";
  const safeFilename = filename || "export.csv";

  try {
    const csv = buildCsvString(columns, rows, { includeBom: true });
    downloadTextFile(safeFilename, csv, "text/csv;charset=utf-8");

    const result = { filename: safeFilename, rowCount: Array.isArray(rows) ? rows.length : 0, byteLength: csv.length };

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(`[${flowName}] exported`, result);
    }

    return result;
  } catch (e) {
    const msg = e?.message ? `${flowName} failed: ${e.message}` : `${flowName} failed`;
    const err = new Error(msg);
    err.cause = e;
    throw err;
  }
}
