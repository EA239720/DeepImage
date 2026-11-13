export const KEY_TOKEN = "[clave]";
export const N_TOKEN = "[n]";
/** Value of [n] for the first image of a key. */
export const FIRST_N = 0;

/** Splits the pasted keys on commas or line breaks, dropping blanks and repeats. */
export function parseKeys(text: string) {
  const all = text
    .split(/[,\n]/)
    .map((key) => key.trim())
    .filter(Boolean);
  const list = [...new Set(all)];
  return { list, dupes: all.length - list.length };
}

export interface TableGroup {
  key: string;
  /** The key's image URLs, in the order their rows appear. */
  urls: string[];
}

export interface ParsedTable {
  /** One group per key, in order of first appearance. */
  groups: TableGroup[];
  images: number;
  /** Rows left out for lacking a key or a URL; a header row is not one of them. */
  skipped: number;
  /** Rows left out for repeating a key and URL already listed. */
  dupes: number;
}

const URL_CELL = /^https?:\/\//i;
const URL_IN_TEXT = /https?:\/\/\S+/i;

function cell(text: string) {
  return text.trim().replace(/^"(.*)"$/, "$1").trim();
}

/** Reads the key and the URL of one pasted row, whichever separator and column order it uses. */
function parseRow(line: string) {
  if (line.includes("\t")) {
    // Pasted from a spreadsheet: the URL is whichever cell holds one, the key the first cell left.
    const cells = line.split("\t").map(cell);
    const url = cells.find((text) => URL_CELL.test(text)) ?? "";
    return { key: cells.find((text) => text && text !== url) ?? "", url };
  }
  const found = URL_IN_TEXT.exec(line);
  if (!found) return { key: "", url: "" };
  const around = `${line.slice(0, found.index)},${line.slice(found.index + found[0].length)}`;
  return {
    key: around.split(/[;,]/).map(cell).find(Boolean) ?? "",
    url: found[0].replace(/[",;]+$/, ""),
  };
}

/** Reads a pasted table of keys and image URLs, one image per row, grouping the rows by key. */
export function parseTable(text: string): ParsedTable {
  const urlsByKey = new Map<string, string[]>();
  let images = 0;
  let skipped = 0;
  let dupes = 0;
  let first = true;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const { key, url } = parseRow(line);
    // A first row without a URL holds the column titles.
    const header = first && !url;
    first = false;
    if (header) continue;
    if (!key || !url) {
      skipped++;
      continue;
    }
    const urls = urlsByKey.get(key) ?? [];
    if (urls.includes(url)) {
      dupes++;
      continue;
    }
    urlsByKey.set(key, [...urls, url]);
    images++;
  }

  return { groups: [...urlsByKey].map(([key, urls]) => ({ key, urls })), images, skipped, dupes };
}

function fill(template: string, key: string, n: number) {
  return template.split(KEY_TOKEN).join(key).split(N_TOKEN).join(String(n));
}

export function buildUrl(template: string, key: string, n: number) {
  return fill(template.trim(), key, n);
}

/** File name without extension; the extension comes from the downloaded image. */
export function buildStem(template: string, key: string, n: number) {
  const stem = fill(template, key, n);
  const position = n - FIRST_N + 1;
  return !template.includes(N_TOKEN) && position > 1 ? `${stem}_${position}` : stem;
}

/** Mirrors the backend's file name clean-up, for the live preview. */
export function sanitizeStem(stem: string) {
  const cleaned = stem
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f]/g, "_")
    .trim()
    .replace(/[. ]+$/, "");
  return cleaned || "imagen";
}

/** "1 clave", "3 claves". */
export function count(amount: number, singular: string, plural: string) {
  return `${amount} ${amount === 1 ? singular : plural}`;
}

export function formatBytes(bytes: number) {
  const kb = bytes / 1024;
  if (kb < 1024) return `${bytes > 0 ? Math.max(1, Math.round(kb)) : 0} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function hash(text: string) {
  let h = 7;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h;
}
