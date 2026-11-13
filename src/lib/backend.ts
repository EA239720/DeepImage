import { invoke, isTauri } from "@tauri-apps/api/core";
import { join, pictureDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";

interface ResponseInfo {
  status: number;
  statusText: string;
  contentType: string;
  /** Text of the response, or empty when it was binary. */
  body: string;
}

export type Outcome =
  | { kind: "saved"; file: string; bytes: number; contentType: string }
  | ({ kind: "notImage" } & ResponseInfo)
  | ({ kind: "httpError" } & ResponseInfo);

export type FailedResponse = Exclude<Outcome, { kind: "saved" }>;

export interface DownloadError {
  kind: "url" | "network" | "io";
  message: string;
}

/** Requests `url` and saves it in `dir` as `stem` plus the image's extension. */
export function downloadImage(url: string, dir: string, stem: string) {
  return invoke<Outcome>("download_image", { url, dir, stem });
}

export function toDownloadError(error: unknown): DownloadError {
  if (typeof error === "object" && error !== null && "kind" in error && "message" in error) {
    return error as DownloadError;
  }
  return { kind: "network", message: error instanceof Error ? error.message : String(error) };
}

export function openFolder(dir: string) {
  return invoke<void>("open_folder", { dir });
}

/** Top-level entries a folder already holds; a folder that does not exist yet has none. */
export interface FolderSummary {
  files: number;
  folders: number;
}

export function folderSummary(dir: string) {
  return invoke<FolderSummary>("folder_summary", { dir });
}

/** Moves everything inside `dir` to the system trash; rejects with a message for the user. */
export function clearFolder(dir: string) {
  return invoke<number>("clear_folder", { dir });
}

export async function pickFolder(current: string) {
  const picked = await open({
    directory: true,
    multiple: false,
    defaultPath: current || undefined,
    title: "Carpeta de destino",
  });
  return typeof picked === "string" ? picked : null;
}

/** Themes the native window chrome; `null` returns it to the system's preference. */
export async function setWindowTheme(theme: "light" | "dark" | null) {
  if (isTauri()) await getCurrentWindow().setTheme(theme);
}

export async function defaultOutDir() {
  if (!isTauri()) return "";
  return join(await pictureDir(), "Lote");
}
