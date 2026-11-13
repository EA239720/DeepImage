import { useCallback, useEffect, useState } from "react";
import { defaultOutDir, type Fit } from "../lib/backend";
import { OCR_FILTERS, type OcrFilter } from "../lib/ocr";
import { readWholeNumber, type Reading } from "../lib/validation";

/**
 * Where the list of images comes from: keys typed in, or read from images, run through a URL
 * template; or a pasted table of keys and URLs.
 */
export type SourceMode = "keys" | "table" | "images";

const SOURCE_MODES: SourceMode[] = ["keys", "table", "images"];

/** Whether saved images keep the size they came in, or are cropped or resized to a given one. */
export type SizeMode = "original" | Fit["mode"];

const SIZE_MODES: SizeMode[] = ["original", "crop", "resize"];

/** The largest width or height that can be asked for. */
export const MAX_SIDE = 10_000;

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
  sizeMode: SizeMode;
  /** Width and height as typed: they only take effect once they are valid. */
  sizeWidth: string;
  sizeHeight: string;
}

/** Quick picks for the images per key; any whole number up to MAX_LIMIT can be typed instead. */
export const MAX_OPTIONS = [1, 2, 3, 5, 10];

/** The most images a key can be asked for: every one of them is a request to the server. */
export const MAX_LIMIT = 100;

function isValidMax(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_LIMIT;
}

/** Reads a typed number of images per key. An empty field is neither a value nor an error. */
export function readMax(text: string) {
  return readWholeNumber(text, 1, MAX_LIMIT);
}

/** Reads a typed width or height, which is required once the size is not the original. */
function readSide(text: string, name: string): Reading {
  const reading = readWholeNumber(text, 1, MAX_SIDE);
  return reading.value === null && reading.error === null
    ? { value: null, error: `Escribe el ${name} en píxeles.` }
    : reading;
}

/** The size saved images must have, or why the typed one is not valid. */
export function readFit({ sizeMode, sizeWidth, sizeHeight }: Settings) {
  if (sizeMode === "original") return { fit: null, width: null, height: null };
  const width = readSide(sizeWidth, "ancho");
  const height = readSide(sizeHeight, "alto");
  const fit: Fit | null =
    width.value !== null && height.value !== null
      ? { mode: sizeMode, width: width.value, height: height.value }
      : null;
  return { fit, width, height };
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
  sizeMode: "original",
  sizeWidth: "1000",
  sizeHeight: "1000",
};

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const settings: Settings = { ...DEFAULTS, ...saved };
    if (!isValidMax(settings.max)) settings.max = DEFAULTS.max;
    if (!SOURCE_MODES.includes(settings.mode)) settings.mode = DEFAULTS.mode;
    if (!OCR_FILTERS.includes(settings.ocrFilter)) settings.ocrFilter = DEFAULTS.ocrFilter;
    if (!SIZE_MODES.includes(settings.sizeMode)) settings.sizeMode = DEFAULTS.sizeMode;
    if (typeof settings.sizeWidth !== "string") settings.sizeWidth = DEFAULTS.sizeWidth;
    if (typeof settings.sizeHeight !== "string") settings.sizeHeight = DEFAULTS.sizeHeight;
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
