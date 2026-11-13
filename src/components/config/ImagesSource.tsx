import { useRef, useState, type DragEvent } from "react";
import { Box, chakra, Flex, Image, Text } from "@chakra-ui/react";
import { ImageSquareIcon, SelectionIcon, UploadSimpleIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import { useImageExtraction, type SourceImage } from "../../hooks/useImageExtraction";
import type { Settings, UpdateSettings } from "../../hooks/useSettings";
import { IMAGE_ACCEPT, IMAGE_EXTENSIONS } from "../../lib/images";
import type { OcrFilter } from "../../lib/ocr";
import { count } from "../../lib/templates";
import { Btn } from "../ui";
import { Hint, labelStyles, Segmented } from "./fields";
import { KeysSource } from "./KeysSource";
import { RegionDialog } from "./RegionDialog";

const FORMATS = IMAGE_EXTENSIONS.filter((extension) => extension !== "jpeg").map((extension) => extension.toUpperCase());

const FILTERS: { value: OcrFilter; label: string; hint: string }[] = [
  { value: "codes", label: "Códigos", hint: "Palabras con letras y números, como CA-100 o 87120VVTG." },
  { value: "numbers", label: "Con números", hint: "Cualquier palabra con números, también las que solo tienen cifras." },
  { value: "words", label: "Todo", hint: "Cada palabra leída se vuelve una clave." },
];

const DropArea = chakra("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    width: "100%",
    py: "16px",
    px: "12px",
    borderWidth: "1px",
    borderStyle: "dashed",
    borderColor: "border",
    borderRadius: "md",
    bg: "bg",
    color: "fg.muted",
    fontSize: "13px",
    lineHeight: "1.45",
    textAlign: "center",
    cursor: "pointer",
    _hover: { borderColor: "accent", color: "fg" },
    "&[data-over]": { borderColor: "accent", bg: "accent/8", color: "fg" },
    _disabled: { opacity: 0.6, cursor: "not-allowed" },
  },
});

function statusLine(image: SourceImage) {
  const area = image.region ? "zona elegida" : "imagen completa";
  switch (image.status) {
    case "queued":
      return "En espera…";
    case "reading":
      return `Leyendo texto… ${Math.round(image.progress * 100)}%`;
    case "error":
      return "No se pudo leer el texto";
    case "done":
      return `${image.keys.length > 0 ? count(image.keys.length, "clave", "claves") : "Sin claves"} · ${area}`;
  }
}

function ImageCard({
  image,
  locked,
  onRegion,
  onRemove,
}: {
  image: SourceImage;
  locked: boolean;
  onRegion: () => void;
  onRemove: () => void;
}) {
  const busy = image.status === "queued" || image.status === "reading";
  return (
    <Flex align="center" gap="10px" p="6px" pr="4px" borderRadius="md" bg="bg" boxShadow="sm">
      <Image src={image.url} alt="" boxSize="40px" objectFit="cover" borderRadius="sm" flex="none" />
      <Flex direction="column" minW="0" flex="1" gap="2px">
        <Text fontSize="13px" lineHeight="1.3" truncate title={image.file.name}>
          {image.file.name}
        </Text>
        <Text
          fontSize="12px"
          lineHeight="1.3"
          color={image.status === "error" ? "danger" : "fg.muted"}
          truncate
          title={image.status === "error" ? (image.error ?? undefined) : image.keys.join(", ") || undefined}
        >
          {statusLine(image)}
        </Text>
        {busy && (
          <Box height="3px" borderRadius="full" bg="bg.surface" overflow="hidden">
            <Box height="100%" width={`${image.progress * 100}%`} bg="accent" transition="width .2s ease" />
          </Box>
        )}
      </Flex>
      <Btn type="button" variant="ghost" fontSize="12px" disabled={locked || busy} onClick={onRegion}>
        <SelectionIcon />
        {image.status === "error" ? "Reintentar" : "Zona"}
      </Btn>
      <Btn
        type="button"
        variant="ghost"
        color="fg.muted"
        boxSize="28px"
        p="0"
        flex="none"
        aria-label={`Quitar ${image.file.name}`}
        title="Quitar imagen"
        disabled={locked}
        onClick={onRemove}
      >
        <XIcon />
      </Btn>
    </Flex>
  );
}

interface ImagesSourceProps {
  settings: Settings;
  update: UpdateSettings;
  locked: boolean;
  maxText: string;
  onMaxText: (text: string) => void;
}

/** Images whose text, read on this computer, becomes the list of keys. */
export function ImagesSource({ settings, update, locked, maxText, onMaxText }: ImagesSourceProps) {
  const { images, rejected, add, setRegion, remove, dismissRejected } = useImageExtraction(settings.ocrFilter, update);
  const [editing, setEditing] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const filter = FILTERS.find((option) => option.value === settings.ocrFilter) ?? FILTERS[0];
  const edited = images.find((image) => image.id === editing);

  const dragOver = (event: DragEvent) => {
    if (locked || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setOver(true);
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (!locked) void add([...event.dataTransfer.files]);
  };

  return (
    <Flex direction="column" gap="8">
      <Flex direction="column">
        <Text css={labelStyles}>Imágenes con claves</Text>
        <DropArea
          type="button"
          disabled={locked}
          data-over={over || undefined}
          onClick={() => picker.current?.click()}
          onDragOver={dragOver}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
        >
          <Box color="accent">
            <UploadSimpleIcon size={22} />
          </Box>
          <span>Arrastra imágenes aquí o haz clic para elegirlas</span>
          <Text as="span" fontSize="11px" color="fg.subtle">
            {FORMATS.join(", ")} · el texto se lee en este equipo, sin conexión
          </Text>
        </DropArea>
        <input
          ref={picker}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          hidden
          onChange={(event) => {
            void add([...(event.target.files ?? [])]);
            // Lets the same file be chosen again after it is removed.
            event.target.value = "";
          }}
        />

        {rejected.length > 0 && (
          <Flex
            role="alert"
            direction="column"
            gap="4px"
            mt="8px"
            py="8px"
            px="10px"
            borderRadius="md"
            bg="danger/10"
            fontSize="12px"
            lineHeight="1.45"
          >
            <Flex align="center" gap="6px" color="danger">
              <WarningCircleIcon />
              <Text flex="1">
                {rejected.length === 1 ? "Un archivo no se agregó" : `${rejected.length} archivos no se agregaron`}
              </Text>
              <Btn type="button" variant="ghost" fontSize="12px" color="danger" onClick={dismissRejected}>
                Cerrar
              </Btn>
            </Flex>
            {rejected.map(({ name, problem }) => (
              <Text key={name} color="fg.soft" wordBreak="break-word">
                <b>{name}</b>: {problem}.
              </Text>
            ))}
            <Text color="fg.muted">Solo se aceptan imágenes {FORMATS.join(", ")}.</Text>
          </Flex>
        )}

        {images.length > 0 ? (
          <Flex direction="column" gap="6px" mt="8px">
            {images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                locked={locked}
                onRegion={() => setEditing(image.id)}
                onRemove={() => remove(image.id)}
              />
            ))}
          </Flex>
        ) : (
          <Hint icon={<ImageSquareIcon />}>
            Cada imagen se lee completa al agregarla; usa «Zona» para leer solo la parte con las claves.
          </Hint>
        )}
      </Flex>

      <Flex direction="column">
        <Text id="ocr-filter-label" css={labelStyles}>
          Qué extraer
        </Text>
        <Segmented
          labelledBy="ocr-filter-label"
          options={FILTERS}
          value={settings.ocrFilter}
          onChange={(value) => update({ ocrFilter: value })}
          disabled={locked}
        />
        <Hint>{filter.hint}</Hint>
      </Flex>

      <KeysSource
        label="Claves extraídas"
        text={settings.imageKeysText}
        onText={(text) => update({ imageKeysText: text })}
        placeholder="Las claves leídas aparecen aquí; puedes corregirlas."
        settings={settings}
        update={update}
        locked={locked}
        maxText={maxText}
        onMaxText={onMaxText}
      />

      {edited && (
        <RegionDialog
          image={edited}
          onCancel={() => setEditing(null)}
          onConfirm={(region) => {
            setEditing(null);
            setRegion(edited.id, region);
          }}
        />
      )}
    </Flex>
  );
}
