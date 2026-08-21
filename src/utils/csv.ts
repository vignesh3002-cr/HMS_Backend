// Minimal dependency-free CSV writer.
// - RFC-4180 style quoting: every value is quoted and embedded quotes doubled.
// - \r\n line endings + UTF-8 BOM so Excel renders headers/values correctly.

export function csvEscape(value: unknown): string {
    if (value === null || value === undefined) return '""';
    const str =
        typeof value === "object" ? JSON.stringify(value) : String(value);
    return `"${str.replace(/"/g, '""')}"`;
}

export function toCsv(
    rows: Array<Record<string, unknown>>,
    columnOrder: string[]
): string {
    const header = columnOrder.join(",") + "\r\n";
    const body = rows
        .map((row) => columnOrder.map((col) => csvEscape(row[col])).join(","))
        .join("\r\n");
    return "\uFEFF" + header + body;
}
