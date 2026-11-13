import { useCallback, useEffect, useState } from "react";
import { setWindowTheme } from "../lib/backend";

export type ColorMode = "light" | "dark";

/** Also read by the inline script in index.html, which applies the mode before the first paint. */
const STORAGE_KEY = "lote.colorMode";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function savedMode(): ColorMode | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

function systemMode(): ColorMode {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** Latte (light) or Frappé (dark): the system's preference until the user picks one. */
export function useColorMode() {
  const [chosen, setChosen] = useState(savedMode);
  const [system, setSystem] = useState(systemMode);
  const mode = chosen ?? system;

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const sync = () => setSystem(systemMode());
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
    root.classList.toggle("light", mode === "light");
    root.style.colorScheme = mode;
  }, [mode]);

  useEffect(() => {
    // The native title bar follows the chosen mode, or the system while none is chosen.
    setWindowTheme(chosen).catch(() => {});
  }, [chosen]);

  const toggle = useCallback(() => {
    const next = mode === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Without storage the choice still holds for this session.
    }
    setChosen(next);
  }, [mode]);

  return { mode, toggle };
}
