import { createWorker, OEM, PSM, type Worker } from "tesseract.js";

/** A part of an image, in the image's own pixels. */
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Which words read from an image become keys. */
export type OcrFilter = "codes" | "numbers" | "words";

export const OCR_FILTERS: OcrFilter[] = ["codes", "numbers", "words"];

/** Small regions are enlarged until their longer side reaches this: Tesseract misreads small print. */
const TARGET_SIDE = 1600;
const MAX_ENLARGEMENT = 3;

// vite.config.ts copies these files into the app, so nothing is fetched from the internet.
const asset = (path: string) => new URL(`ocr/${path}`, document.baseURI).href;

let worker: Promise<Worker> | null = null;
let reportProgress: ((share: number) => void) | null = null;

function getWorker() {
  worker ??= createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: asset("worker.min.js"),
    corePath: asset("core"),
    langPath: asset("lang"),
    workerBlobURL: false,
    cacheMethod: "none",
    logger: ({ status, progress }) => {
      if (status === "recognizing text") reportProgress?.(progress);
    },
  })
    .then(async (created) => {
      // Codes sit anywhere on a screenshot or a label rather than in paragraphs.
      await created.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      return created;
    })
    .catch((error) => {
      worker = null;
      throw error;
    });
  return worker;
}

/** Copies `region` of the image onto a white canvas, enlarging it when it is small. */
async function prepare(image: Blob, region: Region | null) {
  const bitmap = await createImageBitmap(image);
  const area = region ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const scale = Math.min(MAX_ENLARGEMENT, Math.max(1, TARGET_SIDE / Math.max(area.width, area.height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la imagen.");
  // Transparent pixels would otherwise read as black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

let queue: Promise<unknown> = Promise.resolve();

/** Reads the text in `region` of `image`, or in all of it. Images are read one at a time. */
export function readText(image: Blob, region: Region | null, onProgress: (share: number) => void) {
  const run = async () => {
    const reader = await getWorker();
    const canvas = await prepare(image, region);
    reportProgress = onProgress;
    try {
      const { data } = await reader.recognize(canvas);
      return data.text;
    } finally {
      reportProgress = null;
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

const SEPARATORS = /[\s,;:|]+/;
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

const KEEPS: Record<OcrFilter, (word: string) => boolean> = {
  // Letters and digits together, like CA-100 or 87120VVTG: leaves out dates, prices and plain words.
  codes: (word) => word.length >= 3 && /\d/.test(word) && /\p{L}/u.test(word),
  numbers: (word) => word.length >= 3 && /\d/.test(word),
  words: (word) => word.length >= 2,
};

/** The distinct words of `text` that `filter` keeps, in reading order. */
export function pickKeys(text: string, filter: OcrFilter) {
  const words = text
    .split(SEPARATORS)
    .map((word) => word.replace(EDGE_PUNCTUATION, ""))
    .filter(KEEPS[filter]);
  return [...new Set(words)];
}
