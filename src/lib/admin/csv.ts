import "server-only";

/**
 * Minimal, dependency-free CSV parser for the student bulk import
 * (src/lib/actions/admin/import.ts).
 *
 * Why no library: the project has no CSV dependency today, and the
 * import format we accept is deliberately narrow (a fixed header
 * allow-list — see src/lib/validation/admin/import.ts) so a small
 * RFC4180-subset parser is easier to reason about for security than
 * pulling in a general-purpose parser mid-phase. If a richer CSV
 * feature set is ever needed (multi-line quoted fields with embedded
 * newlines beyond what's implemented here, alternate delimiters, BOM
 * variants, etc.), reconsider a vetted dependency at that point.
 *
 * Security-relevant behavior:
 *  - Values are returned as plain strings only. Nothing is evaluated,
 *    interpreted, or executed — a cell that looks like a formula
 *    (`=SUM(...)`) is stored as the literal text "=SUM(...)". Formula
 *    injection is only a risk at EXPORT time, when a spreadsheet
 *    program interprets a leading =/+/-/@ as a formula; see the
 *    neutralizeForExport() note below for the documented (not yet
 *    built, since Phase 10 has no export UI) mitigation.
 *  - No macro/formula execution of any kind is possible in a parser
 *    that only produces strings.
 */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export type ParseCsvResult = { ok: true; data: ParsedCsv } | { ok: false; error: string };

const MAX_FIELD_LENGTH = 2000;

export function parseCsv(text: string, maxRows: number): ParseCsvResult {
  // Strip a UTF-8 BOM if present.
  const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  const len = normalized.length;

  while (i < len) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === ",") {
      record.push(field.slice(0, MAX_FIELD_LENGTH));
      field = "";
      i += 1;
      continue;
    }

    if (char === "\n") {
      record.push(field.slice(0, MAX_FIELD_LENGTH));
      field = "";
      records.push(record);
      record = [];
      i += 1;
      if (records.length > maxRows + 1) {
        return { ok: false, error: `File exceeds the maximum of ${maxRows} data rows.` };
      }
      continue;
    }

    field += char;
    i += 1;
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field.slice(0, MAX_FIELD_LENGTH));
    records.push(record);
  }

  const nonEmpty = records.filter((r) => !(r.length === 1 && r[0].trim() === ""));
  if (nonEmpty.length === 0) {
    return { ok: false, error: "The file is empty." };
  }

  const [headerRow, ...dataRows] = nonEmpty;
  const headers = headerRow.map((h) => h.trim());

  if (dataRows.length > maxRows) {
    return { ok: false, error: `File exceeds the maximum of ${maxRows} data rows.` };
  }

  return { ok: true, data: { headers, rows: dataRows } };
}

/**
 * Documented but intentionally unused in Phase 10 (no export UI exists
 * yet). Kept here so a future export feature has a ready-made, reviewed
 * mitigation instead of re-deriving one under time pressure: prefixing
 * a formula-injection-risk value with a leading apostrophe neutralizes
 * it in Excel/Sheets without altering the visible text. Deliberately
 * excludes phone/WhatsApp-shaped values (a leading "+" there is a real
 * country code, not a formula) — field-aware, not blanket sanitization.
 */
export function neutralizeForExport(value: string, fieldIsPhoneLike: boolean): string {
  if (fieldIsPhoneLike) return value;
  if (/^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}
