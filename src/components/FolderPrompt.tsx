import { useRef, useState } from "react";
import { Dialog, Flex, Portal, Text } from "@chakra-ui/react";
import { TrashIcon } from "@phosphor-icons/react";
import { clearFolder, type FolderSummary } from "../lib/backend";
import { count } from "../lib/templates";
import { Btn, Mono } from "./ui";

function describe({ files, folders }: FolderSummary) {
  return [files > 0 && count(files, "archivo", "archivos"), folders > 0 && count(folders, "carpeta", "carpetas")]
    .filter(Boolean)
    .join(" y ");
}

interface FolderPromptProps {
  dir: string;
  /** What the destination folder already holds. */
  summary: FolderSummary;
  /** The folder is ready, emptied or left as it was: start downloading. */
  onProceed: () => void;
  onCancel: () => void;
}

/** Asks what to do with a destination folder that is not empty before a batch starts. */
export function FolderPrompt({ dir, summary, onProceed, onCancel }: FolderPromptProps) {
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keepButton = useRef<HTMLButtonElement>(null);

  const clearThenProceed = async () => {
    setClearing(true);
    setError(null);
    try {
      await clearFolder(dir);
      onProceed();
    } catch (failure) {
      setError(typeof failure === "string" ? failure : "No se pudo vaciar la carpeta.");
      setClearing(false);
    }
  };

  return (
    <Dialog.Root
      open
      unstyled
      role="alertdialog"
      closeOnInteractOutside={false}
      closeOnEscape={!clearing}
      // Keeping is the choice that loses nothing.
      initialFocusEl={() => keepButton.current}
      onOpenChange={(event) => {
        if (!event.open && !clearing) onCancel();
      }}
    >
      <Portal>
        <Dialog.Backdrop css={{ position: "fixed", inset: "0", zIndex: "modal", bg: "scrim" }} />
        <Dialog.Positioner
          css={{ position: "fixed", inset: "0", zIndex: "modal", display: "grid", placeItems: "center", p: "8" }}
        >
          <Dialog.Content
            css={{
              width: "min(460px, 100%)",
              display: "flex",
              flexDirection: "column",
              gap: "4",
              p: "8",
              borderRadius: "lg",
              bg: "bg",
              boxShadow: "lg",
            }}
          >
            <Dialog.Title css={{ fontFamily: "heading", fontWeight: "500", fontSize: "20px", lineHeight: "1.2" }}>
              La carpeta de destino no está vacía
            </Dialog.Title>
            <Dialog.Description css={{ fontSize: "14px", color: "fg.soft", textWrap: "pretty" }}>
              Ya contiene {describe(summary)}. ¿Quieres mantener ese contenido o borrarlo antes de descargar?
            </Dialog.Description>
            <Mono py="8px" px="10px" borderRadius="md" bg="bg.inset" fontSize="12.5px" color="accent" wordBreak="break-all">
              {dir}
            </Mono>
            <Text fontSize="12px" lineHeight="1.5" color="fg.muted" textWrap="pretty">
              Si lo mantienes, las imágenes con el mismo nombre se sobrescriben. Si lo borras, todo lo que hay en la
              carpeta se mueve a la papelera.
            </Text>
            {error && (
              <Text role="alert" fontSize="12px" lineHeight="1.5" color="danger" wordBreak="break-word">
                {error}
              </Text>
            )}
            <Flex justify="flex-end" gap="8px" mt="2">
              <Btn type="button" variant="ghost" mr="auto" disabled={clearing} onClick={onCancel}>
                Cancelar
              </Btn>
              <Btn ref={keepButton} type="button" variant="secondary" disabled={clearing} onClick={onProceed}>
                Mantener
              </Btn>
              <Btn type="button" variant="danger" disabled={clearing} onClick={clearThenProceed}>
                <TrashIcon />
                {clearing ? "Borrando…" : "Borrar contenido"}
              </Btn>
            </Flex>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
