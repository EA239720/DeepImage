import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useColorMode } from "../hooks/useColorMode";
import { Btn } from "./ui";

/** Switches between the light (Latte) and dark (Frappé) modes. */
export function ColorModeButton() {
  const { mode, toggle } = useColorMode();
  const label = mode === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <Btn type="button" variant="secondary" boxSize="32px" p="0" flex="none" aria-label={label} title={label} onClick={toggle}>
      {mode === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
    </Btn>
  );
}
