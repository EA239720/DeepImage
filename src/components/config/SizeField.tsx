import { useId } from "react";
import { Flex, Input, Text } from "@chakra-ui/react";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { readFit, type Settings, type SizeMode, type UpdateSettings } from "../../hooks/useSettings";
import type { Reading } from "../../lib/validation";
import { inputStyles } from "../ui";
import { Hint, labelStyles, Segmented } from "./fields";

const MODES: { value: SizeMode; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "crop", label: "Recortar" },
  { value: "resize", label: "Redimensionar" },
];

function SideInput({
  label,
  text,
  reading,
  errorId,
  onChange,
  disabled,
}: {
  label: string;
  text: string;
  reading: Reading;
  errorId: string;
  onChange: (text: string) => void;
  disabled: boolean;
}) {
  const invalid = reading.error !== null;
  return (
    <Input
      unstyled
      inputMode="numeric"
      autoComplete="off"
      aria-label={`${label} en píxeles`}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
      placeholder={label}
      value={text}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      css={{
        ...inputStyles,
        width: "84px",
        textAlign: "center",
        fontSize: "13px",
        fontVariantNumeric: "tabular-nums",
        _invalid: { borderColor: "danger", boxShadow: "inset 0 0 0 1px {colors.danger}" },
      }}
    />
  );
}

/** Says which field a complaint is about, unless it already does. */
function naming(field: string, error: string) {
  return error.startsWith("Escribe el") ? error : `${field}: ${error[0].toLowerCase()}${error.slice(1)}`;
}

/** Whether saved images keep their size, or are cropped or resized to the one typed here. */
export function SizeField({ settings, update, locked }: { settings: Settings; update: UpdateSettings; locked: boolean }) {
  const labelId = useId();
  const widthErrorId = useId();
  const heightErrorId = useId();
  const { sizeMode, sizeWidth, sizeHeight } = settings;
  const { fit, width, height } = readFit(settings);
  const shown = [
    width?.error && { id: widthErrorId, text: naming("Ancho", width.error) },
    height?.error && { id: heightErrorId, text: naming("Alto", height.error) },
  ].filter((error) => !!error);

  return (
    <Flex direction="column">
      <Text id={labelId} css={labelStyles}>
        Tamaño de la imagen
      </Text>
      <Segmented
        labelledBy={labelId}
        options={MODES}
        value={sizeMode}
        onChange={(mode) => update({ sizeMode: mode })}
        disabled={locked}
      />

      {sizeMode === "original" ? (
        <Hint>Cada imagen se guarda con el tamaño con que la entrega el servidor.</Hint>
      ) : (
        <>
          <Flex align="center" gap="8px" mt="8px" fontSize="13px" color="fg.muted">
            {width && height && (
              <>
                <SideInput
                  label="Ancho"
                  text={sizeWidth}
                  reading={width}
                  errorId={widthErrorId}
                  onChange={(text) => update({ sizeWidth: text })}
                  disabled={locked}
                />
                <span aria-hidden>×</span>
                <SideInput
                  label="Alto"
                  text={sizeHeight}
                  reading={height}
                  errorId={heightErrorId}
                  onChange={(text) => update({ sizeHeight: text })}
                  disabled={locked}
                />
                <span>px</span>
              </>
            )}
          </Flex>
          {shown.length > 0 ? (
            shown.map((error) => (
              <Flex
                key={error.id}
                id={error.id}
                align="center"
                gap="6px"
                mt="6px"
                fontSize="12px"
                lineHeight="1.45"
                color="danger"
              >
                <WarningCircleIcon />
                {error.text}
              </Flex>
            ))
          ) : fit?.mode === "crop" ? (
            <Hint>
              Se recorta desde las orillas hacia el centro, sin cambiar la escala, hasta quedar en {fit.width} ×{" "}
              {fit.height} px. Si la imagen es más pequeña, solo se recorta lo que sobra.
            </Hint>
          ) : (
            fit && (
              <Hint>
                La imagen completa se escala a {fit.width} × {fit.height} px; si sus proporciones son otras, se
                deforma.
              </Hint>
            )
          )}
        </>
      )}
    </Flex>
  );
}
