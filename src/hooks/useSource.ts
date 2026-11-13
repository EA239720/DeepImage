import { useMemo } from "react";
import { keyTasks, tableTasks } from "../lib/tasks";
import { KEY_TOKEN, N_TOKEN, parseKeys, parseTable } from "../lib/templates";
import type { Settings } from "./useSettings";

/** Stands in for a key in previews while none has been entered. */
const SAMPLE_KEY = "CLAVE";

/** What the active source tab would download, plus what the form shows about it. */
export function useSource({ mode, keysText, imageKeysText, tableText, urlTpl, max }: Settings) {
  // Keys read from images run exactly like typed ones.
  const keysSource = mode === "images" ? imageKeysText : keysText;
  const keys = useMemo(() => parseKeys(keysSource), [keysSource]);
  const table = useMemo(() => parseTable(tableText), [tableText]);

  return useMemo(() => {
    if (mode === "table") {
      return {
        keys,
        table,
        tasks: tableTasks(table.groups),
        keyCount: table.groups.length,
        /** Whether there is enough to start a batch. */
        ready: table.groups.length > 0,
        sampleKey: table.groups[0]?.key ?? SAMPLE_KEY,
        /** Whether some key can end up with more than one image. */
        several: table.groups.some((group) => group.urls.length > 1),
      };
    }
    const ready = keys.list.length > 0 && urlTpl.includes(KEY_TOKEN);
    return {
      keys,
      table,
      tasks: ready ? keyTasks(keys.list, urlTpl, max) : [],
      keyCount: keys.list.length,
      ready,
      sampleKey: keys.list[0] ?? SAMPLE_KEY,
      several: max > 1 && urlTpl.includes(N_TOKEN),
    };
  }, [mode, keys, table, urlTpl, max]);
}

export type Source = ReturnType<typeof useSource>;
