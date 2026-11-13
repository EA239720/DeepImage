import { Box, Flex } from "@chakra-ui/react";
import { InfoIcon } from "@phosphor-icons/react";
import type { Settings, UpdateSettings } from "../../hooks/useSettings";
import type { Source } from "../../hooks/useSource";
import { count } from "../../lib/templates";
import { Mono } from "../ui";
import { Hint, PasteField, Preview } from "./fields";

const PLACEHOLDER = ["Clave Producto\turl", "ES-91456-1\thttps://servidor.com/img/87120VVTG_0.jpg"].join("\n");

/** "2 filas sin clave o URL se omitirán". */
function left(rows: number, reason: string) {
  const plural = rows > 1;
  return `${count(rows, "fila", "filas")} ${reason} se omitirá${plural ? "n" : ""}`;
}

interface TableSourceProps {
  settings: Settings;
  update: UpdateSettings;
  source: Source;
  locked: boolean;
}

/** A pasted table that lists, row by row, the URL of each image and the key to name it with. */
export function TableSource({ settings, update, source, locked }: TableSourceProps) {
  const { groups, images, skipped, dupes } = source.table;
  const sample = groups[0];
  const remarks = [
    skipped > 0 && left(skipped, "sin clave o URL"),
    dupes > 0 && left(dupes, dupes > 1 ? "repetidas" : "repetida"),
  ].filter(Boolean);

  return (
    <Flex direction="column">
      <PasteField
        rows
        label={
          <>
            Tabla <Box as="span" color="fg.subtle">· clave y URL por fila</Box>
          </>
        }
        tally={`${count(images, "imagen", "imágenes")} · ${count(groups.length, "clave", "claves")}`}
        value={settings.tableText}
        onChange={(text) => update({ tableText: text })}
        placeholder={PLACEHOLDER}
        disabled={locked}
        notice={
          remarks.length > 0 && (
            <Hint mt="0" icon={<InfoIcon />}>
              {remarks.join(" · ")}
            </Hint>
          )
        }
      />
      <Hint>
        Pega las dos columnas desde tu hoja de cálculo. Cada imagen se guarda con el nombre de su clave; repite la
        clave en varias filas para darle más de una imagen.
      </Hint>
      <Preview label={sample ? `Primera clave · ${sample.key}` : "Primera clave"}>
        {sample ? (
          sample.urls.slice(0, 3).map((url) => (
            <Mono key={url} color="accent" wordBreak="break-all">
              {url}
            </Mono>
          ))
        ) : (
          <Mono color="fg.subtle">—</Mono>
        )}
        {sample && sample.urls.length > 3 && <Mono color="fg.muted">y {sample.urls.length - 3} más</Mono>}
      </Preview>
    </Flex>
  );
}
