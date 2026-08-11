"use strict";
// Minimal dependency-free CSV writer.
// - RFC-4180 style quoting: every value is quoted and embedded quotes doubled.
// - \r\n line endings + UTF-8 BOM so Excel renders headers/values correctly.
Object.defineProperty(exports, "__esModule", { value: true });
exports.csvEscape = csvEscape;
exports.toCsv = toCsv;
function csvEscape(value) {
    if (value === null || value === undefined)
        return '""';
    const str = typeof value === "object" ? JSON.stringify(value) : String(value);
    return `"${str.replace(/"/g, '""')}"`;
}
function toCsv(rows, columnOrder) {
    const header = columnOrder.join(",") + "\r\n";
    const body = rows
        .map((row) => columnOrder.map((col) => csvEscape(row[col])).join(","))
        .join("\r\n");
    return "\uFEFF" + header + body;
}
