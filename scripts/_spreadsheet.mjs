// Minimal .xlsx / .csv reader for the CLI scripts.
//
// The app has no spreadsheet dependency and doesn't need one at runtime — this
// is a build-free reader for one-off admin imports. It handles the shape
// exporters actually emit (a single sheet, shared strings, inline strings) and
// deliberately ignores formatting, formulas, and multi-sheet workbooks.

import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

// ── zip ──────────────────────────────────────────────────────────
// An .xlsx is a zip of XML parts. Read the central directory rather than the
// local headers: local headers may carry zeroed sizes when the writer used a
// trailing data descriptor, the central directory never does.
function unzip(buf) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65557; i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file (no end-of-central-directory record)");

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("corrupt zip central directory");
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);

    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compressedSize);
    files.set(name, method === 0 ? raw : inflateRawSync(raw));

    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// ── xml ──────────────────────────────────────────────────────────
function decode(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

/** Concatenated <t> text of one element — how Excel stores a run-formatted string. */
function textOf(xml) {
  let out = "";
  for (const m of xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) out += decode(m[1]);
  return out;
}

/** "BC12" → 54 (0-based column index). */
function colIndex(ref) {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

function readXlsx(buf) {
  const files = unzip(buf);

  const sharedXml = files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));

  // First sheet by part name — exporters emit sheet1.xml, and a workbook with
  // several sheets isn't a shape this reader claims to support.
  const sheetName = [...files.keys()]
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort()[0];
  if (!sheetName) throw new Error("no worksheet found in workbook");
  const sheet = files.get(sheetName).toString("utf8");

  const rows = [];
  for (const rowMatch of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cell of rowMatch[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const body = cell[2] ?? "";
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      const i = ref ? colIndex(ref) : cells.length;

      let value = "";
      if (type === "inlineStr") value = textOf(body);
      else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (v !== undefined) value = type === "s" ? (shared[Number(v)] ?? "") : decode(v);
      }
      cells[i] = value;
    }
    rows.push(cells);
  }
  return rows;
}

// ── csv ──────────────────────────────────────────────────────────
function readCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Read a spreadsheet into `{ headers, rows }`, where each row is an object
 * keyed by the lower-cased header text. Blank rows are dropped.
 */
export function readSheet(path) {
  const buf = readFileSync(path);
  const grid = path.toLowerCase().endsWith(".csv")
    ? readCsv(buf.toString("utf8").replace(/^﻿/, ""))
    : readXlsx(buf);

  const headerRow = grid.find((r) => r.some((c) => (c ?? "").trim() !== ""));
  if (!headerRow) return { headers: [], rows: [] };

  const headers = headerRow.map((h) => (h ?? "").trim());
  const rows = [];
  for (const cells of grid.slice(grid.indexOf(headerRow) + 1)) {
    if (!cells.some((c) => (c ?? "").trim() !== "")) continue;
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h.toLowerCase()] = (cells[i] ?? "").trim();
    });
    rows.push(obj);
  }
  return { headers, rows };
}
