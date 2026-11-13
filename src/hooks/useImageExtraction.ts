import { useCallback, useEffect, useRef, useState } from "react";
import { checkImage } from "../lib/images";
import { pickKeys, readText, type OcrFilter, type Region } from "../lib/ocr";
import { parseKeys } from "../lib/templates";
import type { UpdateSettings } from "./useSettings";

export interface SourceImage {
  id: string;
  file: File;
  /** Object URL for the previews; revoked when the image is removed. */
  url: string;
  width: number;
  height: number;
  /** The part to read, or `null` for the whole image. */
  region: Region | null;
  status: "queued" | "reading" | "done" | "error";
  /** Share of the reading done, from 0 to 1. */
  progress: number;
  /** All the text read in the region. */
  text: string;
  /** The keys this image put in the list. */
  keys: string[];
  error: string | null;
  /** Counts readings, so that a superseded one is ignored when it ends. */
  attempt: number;
}

/** Takes `removed` out of a key list and appends whichever of `added` it lacks. */
function swapKeys(text: string, removed: string[], added: string[]) {
  const gone = new Set(removed.filter((key) => !added.includes(key)));
  const current = parseKeys(text).list;
  const kept = current.filter((key) => !gone.has(key));
  const fresh = added.filter((key) => !kept.includes(key));
  if (kept.length === current.length && fresh.length === 0) return text;
  return [...kept, ...fresh].join(", ");
}

function sameFile(a: File, b: File) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

let nextId = 0;

/**
 * Images whose text becomes keys: each is read as soon as it is added, and again when its
 * region changes. The keys it yields replace the ones it gave before in `imageKeysText`.
 */
export function useImageExtraction(filter: OcrFilter, update: UpdateSettings) {
  const [images, setImages] = useState<SourceImage[]>([]);
  /** Why the files left out of the last addition were left out. */
  const [rejected, setRejected] = useState<{ name: string; problem: string }[]>([]);
  // The same list, readable without waiting for a render by the readings that end meanwhile.
  const current = useRef<SourceImage[]>([]);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const mutate = useCallback((change: (list: SourceImage[]) => SourceImage[]) => {
    current.current = change(current.current);
    setImages(current.current);
  }, []);

  const patch = useCallback(
    (id: string, fields: Partial<SourceImage>) => {
      mutate((list) => list.map((image) => (image.id === id ? { ...image, ...fields } : image)));
    },
    [mutate],
  );

  /** Puts `next` in the list in place of the keys `id` gave before, keeping those another image also gave. */
  const replaceKeys = useCallback(
    (id: string, next: string[]) => {
      const previous = current.current.find((image) => image.id === id)?.keys ?? [];
      const others = new Set(current.current.filter((image) => image.id !== id).flatMap((image) => image.keys));
      const removed = previous.filter((key) => !others.has(key));
      update((settings) => ({ imageKeysText: swapKeys(settings.imageKeysText, removed, next) }));
      patch(id, { keys: next });
    },
    [patch, update],
  );

  const read = useCallback(
    async (id: string) => {
      const image = current.current.find((candidate) => candidate.id === id);
      if (!image) return;
      const attempt = image.attempt + 1;
      patch(id, { status: "queued", progress: 0, error: null, attempt });
      const latest = () => current.current.find((candidate) => candidate.id === id)?.attempt === attempt;
      try {
        const text = await readText(image.file, image.region, (progress) => {
          if (latest()) patch(id, { status: "reading", progress });
        });
        if (!latest()) return;
        patch(id, { status: "done", progress: 1, text });
        replaceKeys(id, pickKeys(text, filterRef.current));
      } catch (error) {
        if (!latest()) return;
        patch(id, { status: "error", error: error instanceof Error ? error.message : String(error) });
      }
    },
    [patch, replaceKeys],
  );

  const add = useCallback(
    async (files: File[]) => {
      const accepted: SourceImage[] = [];
      const problems: { name: string; problem: string }[] = [];
      for (const file of files) {
        if ([...current.current, ...accepted].some((image) => sameFile(image.file, file))) {
          problems.push({ name: file.name, problem: "ya está en la lista" });
          continue;
        }
        const check = await checkImage(file);
        if ("problem" in check) {
          problems.push({ name: file.name, problem: check.problem });
          continue;
        }
        accepted.push({
          id: `image-${++nextId}`,
          file,
          url: URL.createObjectURL(file),
          ...check,
          region: null,
          status: "queued",
          progress: 0,
          text: "",
          keys: [],
          error: null,
          attempt: 0,
        });
      }
      setRejected(problems);
      if (accepted.length === 0) return;
      mutate((list) => [...list, ...accepted]);
      for (const image of accepted) void read(image.id);
    },
    [mutate, read],
  );

  /** Reads `region` of the image (all of it when `null`) in place of what was read before. */
  const setRegion = useCallback(
    (id: string, region: Region | null) => {
      patch(id, { region });
      void read(id);
    },
    [patch, read],
  );

  /** Drops the image and the keys only it gave. */
  const remove = useCallback(
    (id: string) => {
      const image = current.current.find((candidate) => candidate.id === id);
      if (!image) return;
      replaceKeys(id, []);
      mutate((list) => list.filter((candidate) => candidate.id !== id));
      URL.revokeObjectURL(image.url);
    },
    [mutate, replaceKeys],
  );

  // Choosing other words to keep re-filters what was already read, without reading again.
  const appliedFilter = useRef(filter);
  useEffect(() => {
    if (appliedFilter.current === filter) return;
    appliedFilter.current = filter;
    for (const image of current.current) {
      if (image.status === "done") replaceKeys(image.id, pickKeys(image.text, filter));
    }
  }, [filter, replaceKeys]);

  useEffect(
    () => () => {
      for (const image of current.current) URL.revokeObjectURL(image.url);
    },
    [],
  );

  return { images, rejected, add, setRegion, remove, dismissRejected: () => setRejected([]) };
}
