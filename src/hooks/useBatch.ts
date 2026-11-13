import { useCallback, useEffect, useRef, useState } from "react";
import {
  downloadImage,
  toDownloadError,
  type DownloadError,
  type FailedResponse,
} from "../lib/backend";
import type { Task } from "../lib/tasks";
import { buildStem, FIRST_N } from "../lib/templates";

export type Status = "idle" | "running" | "paused" | "done" | "cancelled";

export interface Download {
  id: string;
  key: string;
  /** Position of the image within its key, from 1. */
  position: number;
  /** Images the key has; 0 while a key whose images are being guessed is still in progress. */
  of: number;
  file: string;
  url: string;
  bytes: number;
}

export type IssueKind = "notfound" | "xml" | "notimage" | "http" | DownloadError["kind"];

export interface Issue {
  id: string;
  key: string;
  /** Position within the key of the image that failed, from 1. */
  position: number;
  /** Images listed for the key; 0 when they were being guessed from a template. */
  of: number;
  kind: IssueKind;
  url: string;
  type: string;
  detail: string;
  body: string;
}

/** How the images of a run are saved. */
export interface Job {
  nameTpl: string;
  outDir: string;
}

interface BatchState {
  status: Status;
  total: number;
  processed: number;
  current: string;
  /** Why the batch stopped on its own, when it did. */
  notice: string | null;
  downloads: Download[];
  issues: Issue[];
}

const NO_KEY = "—";

const IDLE: BatchState = {
  status: "idle",
  total: 0,
  processed: 0,
  current: NO_KEY,
  notice: null,
  downloads: [],
  issues: [],
};

/** The fields every issue of `task` at `position` shares. */
function locate(task: Task, position: number) {
  return {
    id: `${task.key}:${position}`,
    key: task.key,
    position,
    of: task.probing ? 0 : task.urls.length,
    url: task.urls[position - 1],
  };
}

function describeResponse(task: Task, position: number, response: FailedResponse): Issue {
  const at = locate(task, position);
  const statusLine = `${response.status} ${response.statusText}`.trim();
  if (response.kind === "httpError") {
    const notFound = response.status === 404;
    const reason = notFound
      ? task.probing && task.urls.length > 1
        ? "ninguna variante [n] devolvió imagen"
        : "el servidor no tiene esa imagen"
      : "el servidor rechazó la solicitud";
    return {
      ...at,
      kind: notFound ? "notfound" : "http",
      type: notFound ? "No encontrado" : `Error HTTP ${response.status}`,
      detail: `${statusLine} · ${reason}`,
      body: [`GET ${at.url}\n→ ${statusLine}`, response.body].filter(Boolean).join("\n\n"),
    };
  }
  const xml = response.contentType.includes("xml");
  return {
    ...at,
    kind: xml ? "xml" : "notimage",
    type: xml ? "Respuesta XML" : "No es imagen",
    detail: `${statusLine} · Content-Type: ${response.contentType || "sin declarar"} — se esperaba image/*`,
    body: response.body || "(la respuesta no contiene texto)",
  };
}

function describeError(task: Task, position: number, error: DownloadError): Issue {
  const at = locate(task, position);
  const n = FIRST_N + position - 1;
  const earlier = task.probing && position > 1 ? ` en [n] = ${n}; las imágenes anteriores se guardaron` : "";
  const text = {
    url: ["URL no válida", "La URL generada no se puede solicitar"],
    network: ["Error de red", `No se pudo completar la solicitud${earlier}`],
    io: ["Error al guardar", "La imagen se descargó pero no se pudo escribir en la carpeta de destino"],
  }[error.kind];
  return {
    ...at,
    kind: error.kind,
    type: text[0],
    detail: text[1],
    body: `GET ${at.url}\n→ ${error.message}`,
  };
}

/** Runs a queue of tasks one request at a time, with pause, resume and cancel. */
export function useBatch() {
  const [state, setState] = useState(IDLE);
  // What the last batch was asked to do, so that a retry repeats exactly that.
  const plan = useRef<{ tasks: Map<string, Task>; job: Job } | null>(null);
  // Starting a run takes a new id, which orphans the loop of any earlier run.
  const runId = useRef(0);
  const cancelledId = useRef(0);
  const paused = useRef(false);
  const wake = useRef<(() => void) | null>(null);

  const release = useCallback(() => {
    paused.current = false;
    wake.current?.();
    wake.current = null;
  }, []);

  useEffect(
    () => () => {
      runId.current++;
      release();
    },
    [release],
  );

  const execute = useCallback(
    async (tasks: Task[], job: Job, reset: boolean) => {
      const id = ++runId.current;
      release();
      const live = () => runId.current === id;
      const cancelled = () => cancelledId.current === id;
      const gate = () =>
        paused.current
          ? new Promise<void>((resolve) => {
              wake.current = resolve;
            })
          : Promise.resolve();

      const queued = new Set(tasks.map((task) => task.key));
      setState((s) => ({
        status: "running",
        total: tasks.length,
        processed: 0,
        current: NO_KEY,
        notice: null,
        downloads: reset ? [] : s.downloads.filter((d) => !queued.has(d.key)),
        issues: reset ? [] : s.issues.filter((i) => !queued.has(i.key)),
      }));

      for (const [index, task] of tasks.entries()) {
        const { key, probing } = task;
        await gate();
        if (!live() || cancelled()) return;
        setState((s) => ({ ...s, current: key }));

        let saved = 0;
        const failed: Issue[] = [];
        let fatal = false;
        let interrupted = false;

        for (const [offset, url] of task.urls.entries()) {
          const position = offset + 1;
          if (position > 1) await gate();
          if (!live()) return;
          if (cancelled()) {
            interrupted = true;
            break;
          }

          try {
            const stem = buildStem(job.nameTpl, key, FIRST_N + offset);
            const outcome = await downloadImage(url, job.outDir, stem);
            if (!live()) return;
            if (outcome.kind === "saved") {
              saved++;
              const entry: Download = {
                id: `${id}:${key}:${position}`,
                key,
                position,
                of: probing ? 0 : task.urls.length,
                file: outcome.file,
                url,
                bytes: outcome.bytes,
              };
              setState((s) => ({ ...s, downloads: [entry, ...s.downloads] }));
              continue;
            }
            // While probing, a non-image answer after the first image just means there are no more.
            if (!probing || position === 1) failed.push(describeResponse(task, position, outcome));
            if (probing) break;
          } catch (error) {
            if (!live()) return;
            const failure = toDownloadError(error);
            failed.push(describeError(task, position, failure));
            fatal = failure.kind === "io";
            if (fatal || probing) break;
          }
        }

        // A request in flight when the user cancels still lands; what it saved stays listed.
        setState((s) => ({
          ...s,
          processed: interrupted ? s.processed : index + 1,
          downloads:
            probing && saved > 0 ? s.downloads.map((d) => (d.key === key ? { ...d, of: saved } : d)) : s.downloads,
          issues: failed.length > 0 ? [...failed, ...s.issues] : s.issues,
        }));
        if (cancelled()) return;
        if (fatal) {
          // An unwritable folder fails every key the same way.
          setState((s) => ({
            ...s,
            status: "cancelled",
            current: NO_KEY,
            notice: "Detenido: no se pudo guardar en la carpeta",
          }));
          return;
        }
      }

      setState((s) => ({ ...s, status: "done", current: NO_KEY }));
    },
    [release],
  );

  const start = useCallback(
    (tasks: Task[], job: Job) => {
      plan.current = { tasks: new Map(tasks.map((task) => [task.key, task])), job };
      void execute(tasks, job, true);
    },
    [execute],
  );

  /** Runs the given keys of the last batch again, as they were requested then. */
  const retry = useCallback(
    (keys: string[]) => {
      const last = plan.current;
      if (!last) return;
      const tasks = keys.flatMap((key) => last.tasks.get(key) ?? []);
      if (tasks.length > 0) void execute(tasks, last.job, false);
    },
    [execute],
  );

  const pause = useCallback(() => {
    paused.current = true;
    setState((s) => (s.status === "running" ? { ...s, status: "paused" } : s));
  }, []);

  const resume = useCallback(() => {
    release();
    setState((s) => (s.status === "paused" ? { ...s, status: "running" } : s));
  }, [release]);

  const cancel = useCallback(() => {
    cancelledId.current = runId.current;
    release();
    setState((s) => ({ ...s, status: "cancelled", current: NO_KEY }));
  }, [release]);

  return { ...state, start, retry, pause, resume, cancel };
}

export type Batch = ReturnType<typeof useBatch>;
