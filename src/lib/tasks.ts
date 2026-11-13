import { buildUrl, FIRST_N, N_TOKEN, type TableGroup } from "./templates";

/** The images to fetch for one key. */
export interface Task {
  key: string;
  /** URLs to request in order; each one that answers with an image is saved under the key. */
  urls: string[];
  /**
   * The URLs are guesses built from a template: the first one that is not an image ends the key,
   * and only a miss on the very first is a problem. Otherwise every URL is expected to work.
   */
  probing: boolean;
}

/** One task per key, trying [n] from its first value for up to `max` images. */
export function keyTasks(keys: string[], urlTpl: string, max: number): Task[] {
  // Without [n] every attempt would fetch the same URL.
  const tries = urlTpl.includes(N_TOKEN) ? max : 1;
  return keys.map((key) => ({
    key,
    urls: Array.from({ length: tries }, (_, offset) => buildUrl(urlTpl, key, FIRST_N + offset)),
    probing: true,
  }));
}

/** One task per key of a pasted table, with exactly the URLs listed for it. */
export function tableTasks(groups: TableGroup[]): Task[] {
  return groups.map(({ key, urls }) => ({ key, urls, probing: false }));
}
