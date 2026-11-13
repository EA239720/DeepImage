import { useCallback, useEffect, useState } from "react";
import { defaultOutDir } from "../lib/backend";
import { OCR_FILTERS, type OcrFilter } from "../lib/ocr";

/**
 * Where the list of images comes from: keys typed in, or read from images, run through a URL
 * template; or a pasted table of keys and URLs.
 */
export type SourceMode = "keys" | "table" | "images";

const SOURCE_MODES: SourceMode[] = ["keys", "table", "images"];

export interface Settings {
  mode: SourceMode;
  keysText: string;
  /** The pasted table: a key and an image URL per row. */
  tableText: string;
  /** Keys read from images, still open to corrections. */
  imageKeysText: string;
  /** Which words read from images become keys. */
  ocrFilter: OcrFilter;
  urlTpl: string;
  nameTpl: string;
  max: number;
  outDir: string;
}

/** Quick picks for the images per key; any whole number up to MAX_LIMIT can be typed instead. */
export const MAX_OPTIONS = [1, 2, 3, 5, 10];

/** The most images a key can be asked for: every one of them is a request to the server. */
export const MAX_LIMIT = 100;

function isValidMax(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_LIMIT;
}

/** Reads a typed number of images per key. An empty field is neither a value nor an error. */
export function readMax(text: string): { value: number | null; error: string | null } {
  const typed = text.trim();
  if (!typed) return { value: null, error: null };
  if (/\p{L}/u.test(typed)) return { value: null, error: "Solo se admiten números: quita las letras." };
  if (/\D/.test(typed)) {
    return { value: null, error: "Escribe un número entero, sin espacios, signos ni decimales." };
  }
  const value = Number(typed);
  if (!isValidMax(value)) return { value: null, error: `Elige un número entre 1 y ${MAX_LIMIT}.` };
  return { value, error: null };
}

const STORAGE_KEY = "lote.settings.v1";

const DEFAULTS: Settings = {
  mode: "keys",
  keysText: "",
  tableText: "",
  imageKeysText: "",
  ocrFilter: "codes",
  urlTpl: "",
  nameTpl: "[clave].MAIN",
  max: 3,
  outDir: "",
};

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const settings: Settings = { ...DEFAULTS, ...saved };
    if (!isValidMax(settings.max)) settings.max = DEFAULTS.max;
    if (!SOURCE_MODES.includes(settings.mode)) settings.mode = DEFAULTS.mode;
    if (!OCR_FILTERS.includes(settings.ocrFilter)) settings.ocrFilter = DEFAULTS.ocrFilter;
    return settings;
  } catch {
    return DEFAULTS;
  }
}

/** Changes some settings; a function receives the latest ones, for changes that build on them. */
export type UpdateSettings = (change: Partial<Settings> | ((settings: Settings) => Partial<Settings>)) => void;

/** The batch configuration, remembered between sessions. */
export function useSettings() {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage is a convenience; the form works without it.
    }
  }, [settings]);

  useEffect(() => {
    if (settings.outDir) return;
    let stale = false;
    defaultOutDir()
      .then((dir) => {
        if (!stale && dir) setSettings((s) => (s.outDir ? s : { ...s, outDir: dir }));
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [settings.outDir]);

  const update: UpdateSettings = useCallback((change) => {
    setSettings((s) => ({ ...s, ...(typeof change === "function" ? change(s) : change) }));
  }, []);

  return [settings, update] as const;
}
