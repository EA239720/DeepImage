import { useId, useMemo, type ReactNode } from "react";
import { Field, Flex, Input, Text } from "@chakra-ui/react";
import { InfoIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { MAX_OPTIONS, readMax, type Settings, type UpdateSettings } from "../../hooks/useSettings";
import { buildUrl, FIRST_N, KEY_TOKEN, N_TOKEN, parseKeys } from "../../lib/templates";
import { inputStyles, Mono, monoStyles } from "../ui";
import { fieldStyles, Hint, labelStyles, PasteField, Preview, Segmented, Token, TokenInserts } from "./fields";

/** Stands in for a key in the URL preview while the list is empty. */
const SAMPLE_KEY = "CLAVE";

const QUICK_PICKS = MAX_OPTIONS.map((value) => ({ value, label: String(value) }));

interface KeysSourceProps {
  label: ReactNode;
  /** The list of keys, separated by commas or line breaks. */
  text: string;
  onText: (text: string) => void;
  placeholder: string;
  settings: Settings;
  update: UpdateSettings;
  locked: boolean;
  /** What is typed in the free field for the images per key; it becomes `max` once it is valid. */
  maxText: string;
  onMaxText: (text: string) => void;
}

/** A list of keys, each turned into image URLs by a template. */
export function KeysSource({
  label,
  text,
  onText,
  placeholder,
  settings,
  update,
  locked,
  maxText,
  onMaxText,
}: KeysSourceProps) {
  const { urlTpl, max } = settings;
  const { list, dupes } = useMemo(() => parseKeys(text), [text]);
  const sampleKey = list[0] ?? SAMPLE_KEY;
  const plural = dupes > 1;

  const typed = readMax(maxText);
  const maxLabelId = useId();
  const maxErrorId = useId();
  // While the free field holds text it decides the value; the quick picks only mirror it.
  const chosen = maxText.trim() ? typed.value : max;
  const custom = typed.value !== null && !MAX_OPTIONS.includes(typed.value);

  const pickMax = (value: number) => {
    onMaxText("");
    update({ max: value });
  };

  const typeMax = (text: string) => {
    onMaxText(text);
    const { value } = readMax(text);
    if (value !== null) update({ max: value });
  };

  // Leaving the field empty, or with leading zeros, shows the value in force again.
  const settleMax = () => {
    if (typed.error) return;
    onMaxText(MAX_OPTIONS.includes(max) && !custom ? "" : String(max));
  };

  return (
    <Flex direction="column" gap="8">
      <PasteField
        label={label}
        tally={`${list.length} ${list.length === 1 ? "única" : "únicas"}`}
        value={text}
        onChange={onText}
        placeholder={placeholder}
        disabled={locked}
        notice={
          dupes > 0 && (
            <Hint mt="0" icon={<InfoIcon />}>
              {dupes} clave{plural && "s"} duplicada{plural && "s"} se omitirá{plural && "n"}
            </Hint>
          )
        }
      />

      <Field.Root unstyled disabled={locked} css={fieldStyles}>
        <Field.Label css={labelStyles}>URL de origen</Field.Label>
        <Input
          unstyled
          spellCheck={false}
          placeholder="https://servidor.com/[clave]/[clave]_[n]"
          value={urlTpl}
          onChange={(e) => update({ urlTpl: e.target.value })}
          css={{ ...inputStyles, ...monoStyles }}
        />
        <TokenInserts disabled={locked} onInsert={(token) => update({ urlTpl: urlTpl + token })} />
        <Preview label={`Vista previa · ${sampleKey}`}>
          <Mono color={urlTpl ? "accent" : "fg.subtle"} wordBreak="break-all">
            {urlTpl ? buildUrl(urlTpl, sampleKey, FIRST_N) : "—"}
          </Mono>
        </Preview>
        {urlTpl && !urlTpl.includes(KEY_TOKEN) && (
          <Hint icon={<InfoIcon />}>
            Incluye <Token>{KEY_TOKEN}</Token> para que cada clave tenga su propia URL.
          </Hint>
        )}
      </Field.Root>

      <Field.Root unstyled invalid={typed.error !== null} disabled={locked} css={fieldStyles}>
        <Text id={maxLabelId} css={labelStyles}>
          Imágenes por clave
        </Text>
        <Flex gap="8px" align="stretch">
          <Segmented labelledBy={maxLabelId} options={QUICK_PICKS} value={chosen} onChange={pickMax} disabled={locked} />
          <Input
            unstyled
            inputMode="numeric"
            autoComplete="off"
            aria-label="Otra cantidad de imágenes por clave"
            aria-describedby={typed.error ? maxErrorId : undefined}
            placeholder="Otro"
            value={maxText}
            onChange={(e) => typeMax(e.target.value)}
            onBlur={settleMax}
            css={{
              ...inputStyles,
              width: "64px",
              minHeight: "0",
              textAlign: "center",
              fontSize: "13px",
              ...(custom && { color: "accent", borderColor: "accent", boxShadow: "inset 0 0 0 1px {colors.accent}" }),
              _invalid: { borderColor: "danger", boxShadow: "inset 0 0 0 1px {colors.danger}" },
            }}
          />
        </Flex>
        {typed.error ? (
          <Field.ErrorText
            id={maxErrorId}
            css={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              mt: "6px",
              fontSize: "12px",
              lineHeight: "1.45",
              color: "danger",
            }}
          >
            <WarningCircleIcon />
            {typed.error}
          </Field.ErrorText>
        ) : urlTpl.includes(N_TOKEN) || !urlTpl ? (
          <Hint>
            Se prueba <Token>{N_TOKEN}</Token> = {FIRST_N}…{FIRST_N + max - 1} hasta que el servidor deje de responder
            con imagen.
          </Hint>
        ) : (
          <Hint>
            La URL no incluye <Token>{N_TOKEN}</Token>: se descarga una sola imagen por clave.
          </Hint>
        )}
      </Field.Root>
    </Flex>
  );
}
