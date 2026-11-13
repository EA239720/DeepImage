import { useState } from "react";
import { Box, Field, Flex, Input, Tabs, Text } from "@chakra-ui/react";
import {
  DownloadSimpleIcon,
  FileImageIcon,
  FolderOpenIcon,
  InfoIcon,
  ImagesIcon,
  ListBulletsIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  TableIcon,
} from "@phosphor-icons/react";
import type { Batch } from "../hooks/useBatch";
import {
  MAX_OPTIONS,
  readFit,
  readMax,
  type Settings,
  type SourceMode,
  type UpdateSettings,
} from "../hooks/useSettings";
import type { Source } from "../hooks/useSource";
import { pickFolder } from "../lib/backend";
import { buildStem, count, FIRST_N, KEY_TOKEN, N_TOKEN, sanitizeStem } from "../lib/templates";
import { ColorModeButton } from "./ColorModeButton";
import { fieldStyles, Hint, labelStyles, Preview, Token, TokenInserts } from "./config/fields";
import { ImagesSource } from "./config/ImagesSource";
import { KeysSource } from "./config/KeysSource";
import { SizeField } from "./config/SizeField";
import { TableSource } from "./config/TableSource";
import { TabTrigger } from "./TabTrigger";
import { Btn, inputStyles, Mono, monoStyles } from "./ui";

interface ConfigPanelProps {
  settings: Settings;
  update: UpdateSettings;
  source: Source;
  batch: Batch;
  /** A start is already under way: the destination folder is being checked or asked about. */
  starting: boolean;
  onStart: () => void;
}

export function ConfigPanel({ settings, update, source, batch, starting, onStart }: ConfigPanelProps) {
  const { mode, nameTpl, outDir } = settings;
  const locked = batch.status === "running" || batch.status === "paused";
  const finished = batch.status === "done" || batch.status === "cancelled";
  const previewName = (n: number) => `${sanitizeStem(buildStem(nameTpl, source.sampleKey, n))}.jpg`;
  // The free field for the images per key starts out showing a saved value that is not a quick pick.
  const [maxText, setMaxText] = useState(() => (MAX_OPTIONS.includes(settings.max) ? "" : String(settings.max)));
  // A batch of keys does not start while that field holds something that is not a valid number.
  const maxInvalid = mode !== "table" && readMax(maxText).error !== null;
  // Nor while a size to crop or resize to is asked for but not valid.
  const sizeInvalid = settings.sizeMode !== "original" && readFit(settings).fit === null;

  const chooseFolder = async () => {
    const dir = await pickFolder(outDir).catch(() => null);
    if (dir) update({ outDir: dir });
  };

  return (
    <Flex direction="column" minH="0" bg="bg.panel" boxShadow="inset -1px 0 0 {colors.border.subtle}">
      <Flex flex="1" overflow="auto" direction="column" gap="8" pt="8" px="8" pb="6">
        <Flex align="flex-start" justify="space-between" gap="8px">
          <Flex direction="column" gap="4px">
            <Text fontSize="30px" letterSpacing="0.1em" textTransform="uppercase" color="accent">
              deepimage
            </Text>
          </Flex>
          <ColorModeButton />
        </Flex>

        {/* Where the images come from; naming and destination below apply to every tab. */}
        <Tabs.Root unstyled value={mode} onValueChange={(e) => update({ mode: e.value as SourceMode })}>
          <Tabs.List css={{ display: "flex", mb: "6", boxShadow: "inset 0 -1px 0 {colors.border.subtle}" }}>
            <TabTrigger value="keys" label="Claves" icon={<ListBulletsIcon />} disabled={locked} />
            <TabTrigger value="table" label="Tabla" icon={<TableIcon />} disabled={locked} />
            <TabTrigger value="images" label="Imágenes" icon={<ImagesIcon />} disabled={locked} />
          </Tabs.List>
          <Tabs.Content value="keys">
            <KeysSource
              label={
                <>
                  Claves <Box as="span" color="fg.subtle">· separadas por comas</Box>
                </>
              }
              text={settings.keysText}
              onText={(text) => update({ keysText: text })}
              placeholder="CA-100, CA-101, CA-102…"
              settings={settings}
              update={update}
              locked={locked}
              maxText={maxText}
              onMaxText={setMaxText}
            />
          </Tabs.Content>
          <Tabs.Content value="table">
            <TableSource settings={settings} update={update} source={source} locked={locked} />
          </Tabs.Content>
          <Tabs.Content value="images">
            <ImagesSource
              settings={settings}
              update={update}
              locked={locked}
              maxText={maxText}
              onMaxText={setMaxText}
            />
          </Tabs.Content>
        </Tabs.Root>

        <Field.Root unstyled disabled={locked} css={fieldStyles}>
          <Field.Label css={labelStyles}>Nombre al guardar</Field.Label>
          <Flex align="stretch">
            <Input
              unstyled
              spellCheck={false}
              value={nameTpl}
              onChange={(e) => update({ nameTpl: e.target.value })}
              css={{ ...inputStyles, ...monoStyles, borderRightRadius: "0" }}
            />
            <Mono display="grid" placeItems="center" px="10px" fontSize="12px" color="fg.muted" bg="bg.surface" borderRightRadius="md">
              .ext
            </Mono>
          </Flex>
          <TokenInserts disabled={locked} onInsert={(token) => update({ nameTpl: nameTpl + token })} />
          <Preview label="Resultado · la extensión depende de la imagen">
            {(source.several ? [FIRST_N, FIRST_N + 1] : [FIRST_N]).map((n) => (
              <Mono key={n} display="flex" gap="8px" alignItems="center" color="accent" wordBreak="break-all">
                <Box color="fg.muted" flex="none">
                  <FileImageIcon />
                </Box>
                {previewName(n)}
              </Mono>
            ))}
          </Preview>
          {source.several && !nameTpl.includes(N_TOKEN) && (
            <Hint>
              Sin <Token>{N_TOKEN}</Token> en el nombre: de la 2.ª imagen en adelante se añade <Token>_2</Token>,{" "}
              <Token>_3</Token>…
            </Hint>
          )}
          {!nameTpl.includes(KEY_TOKEN) && source.keyCount > 1 && (
            <Hint icon={<InfoIcon />}>
              Sin <Token>{KEY_TOKEN}</Token> en el nombre, cada clave sobrescribe las imágenes de la anterior.
            </Hint>
          )}
        </Field.Root>

        <SizeField settings={settings} update={update} locked={locked} />

        <Field.Root unstyled disabled={locked} css={fieldStyles}>
          <Field.Label css={labelStyles}>Carpeta de destino</Field.Label>
          <Flex gap="8px">
            <Input
              unstyled
              readOnly
              placeholder="Elige dónde guardar las imágenes"
              value={outDir}
              css={{ ...inputStyles, fontSize: "13px" }}
            />
            <Btn type="button" variant="secondary" flex="none" disabled={locked} onClick={chooseFolder}>
              <FolderOpenIcon />
              Elegir
            </Btn>
          </Flex>
        </Field.Root>
      </Flex>

      <Flex flex="none" gap="8px" py="6" px="8" boxShadow="inset 0 1px 0 {colors.border.subtle}">
        {!locked && (
          <Btn
            variant="primary"
            flex="1"
            height="40px"
            disabled={starting || !source.ready || !outDir || maxInvalid || sizeInvalid}
            onClick={onStart}
          >
            <DownloadSimpleIcon />
            {finished ? "Descargar de nuevo" : `Descargar ${count(source.keyCount, "clave", "claves")}`}
          </Btn>
        )}
        {batch.status === "running" && (
          <Btn variant="primary" flex="1" height="40px" onClick={batch.pause}>
            <PauseIcon />
            Pausar
          </Btn>
        )}
        {batch.status === "paused" && (
          <Btn variant="primary" flex="1" height="40px" onClick={batch.resume}>
            <PlayIcon />
            Reanudar
          </Btn>
        )}
        {locked && (
          <Btn variant="secondary" height="40px" onClick={batch.cancel}>
            <StopIcon />
            Cancelar
          </Btn>
        )}
      </Flex>
    </Flex>
  );
}
