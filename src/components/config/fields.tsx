import { useRef, type ReactNode } from "react";
import { Box, Field, Flex, SegmentGroup, Text, Textarea, type SystemStyleObject } from "@chakra-ui/react";
import { EraserIcon } from "@phosphor-icons/react";
import { KEY_TOKEN, N_TOKEN } from "../../lib/templates";
import { Btn, inputStyles, Mono, monoStyles, TokenButton } from "../ui";

export const labelStyles: SystemStyleObject = {
  display: "block",
  fontSize: "12px",
  lineHeight: "1.55",
  mb: "5px",
  color: "fg/70",
};

export const fieldStyles: SystemStyleObject = { display: "flex", flexDirection: "column" };

export function Hint({ children, icon, mt = "6px" }: { children: ReactNode; icon?: ReactNode; mt?: string }) {
  return (
    <Flex gap="6px" align="center" mt={mt} fontSize="12px" lineHeight="1.45" color="fg.muted" textWrap="pretty">
      {icon}
      <Text>{children}</Text>
    </Flex>
  );
}

export function Token({ children }: { children: ReactNode }) {
  return <Mono color="fg.soft">{children}</Mono>;
}

export function Preview({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="4px" mt="10px" py="8px" px="10px" borderRadius="md" bg="bg.inset" fontSize="12px">
      <Text color="fg.muted">{label}</Text>
      {children}
    </Flex>
  );
}

export function TokenInserts({ disabled, onInsert }: { disabled: boolean; onInsert: (token: string) => void }) {
  return (
    <Flex gap="6px" align="center" mt="8px" wrap="wrap">
      <Text fontSize="12px" color="fg.muted">
        Insertar
      </Text>
      {[KEY_TOKEN, N_TOKEN].map((token) => (
        <TokenButton key={token} type="button" disabled={disabled} onClick={() => onInsert(token)}>
          {token}
        </TokenButton>
      ))}
    </Flex>
  );
}

interface PasteFieldProps {
  label: ReactNode;
  /** What the pasted text amounts to, shown opposite the label. */
  tally: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
  /** Keeps each pasted row on its own line, scrolling sideways instead of wrapping. */
  rows?: boolean;
  /** A remark about the pasted text, shown beside the clear button. */
  notice?: ReactNode;
}

/** A text area for pasted lists, with a tally of what was read and a button to empty it. */
export function PasteField({ label, tally, value, onChange, placeholder, disabled, rows, notice }: PasteFieldProps) {
  const input = useRef<HTMLTextAreaElement>(null);

  const clear = () => {
    onChange("");
    input.current?.focus();
  };

  return (
    <Field.Root unstyled disabled={disabled} css={fieldStyles}>
      <Field.Label css={{ ...labelStyles, display: "flex", justifyContent: "space-between", gap: "8px" }}>
        <span>{label}</span>
        <Box as="span" color="accent" whiteSpace="nowrap">
          {tally}
        </Box>
      </Field.Label>
      <Textarea
        ref={input}
        unstyled
        rows={rows ? 7 : 5}
        wrap={rows ? "off" : undefined}
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        css={{
          ...inputStyles,
          ...monoStyles,
          minHeight: "90px",
          resize: "vertical",
          lineHeight: "1.5",
          ...(rows && { whiteSpace: "pre", overflowX: "auto" }),
        }}
      />
      <Flex align="center" gap="8px" mt="6px">
        {notice}
        <Box flex="1" />
        <Btn type="button" variant="ghost" fontSize="12px" disabled={disabled || !value} onClick={clear}>
          <EraserIcon />
          Limpiar
        </Btn>
      </Flex>
    </Field.Root>
  );
}

interface SegmentedProps<T extends string | number> {
  /** Id of the text that names the control. */
  labelledBy: string;
  options: { value: T; label: string }[];
  /** The chosen option; none is shown as chosen when it matches no option. */
  value: T | null;
  onChange: (value: T) => void;
  disabled: boolean;
}

/** A row of mutually exclusive options. */
export function Segmented<T extends string | number>({
  labelledBy,
  options,
  value,
  onChange,
  disabled,
}: SegmentedProps<T>) {
  const chosen = options.find((option) => option.value === value);
  return (
    <SegmentGroup.Root
      unstyled
      aria-labelledby={labelledBy}
      value={chosen ? String(chosen.value) : null}
      onValueChange={(e) => {
        const picked = options.find((option) => String(option.value) === e.value);
        if (picked) onChange(picked.value);
      }}
      disabled={disabled}
      css={{
        display: "inline-flex",
        flex: "none",
        alignSelf: "flex-start",
        overflow: "hidden",
        borderWidth: "1px",
        borderColor: "border",
        borderRadius: "md",
        _disabled: { opacity: 0.6 },
      }}
    >
      {options.map((option, index) => (
        <SegmentGroup.Item
          key={option.value}
          value={String(option.value)}
          css={{
            display: "inline-flex",
            alignItems: "center",
            py: "7px",
            px: "12px",
            fontSize: "13px",
            lineHeight: "1.55",
            cursor: "pointer",
            borderLeftWidth: index > 0 ? "1px" : "0",
            borderColor: "border",
            _hover: { bg: "fg/7" },
            _checked: {
              color: "accent",
              bg: "transparent",
              boxShadow: "inset 0 0 0 1px {colors.accent}",
            },
            _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
            _disabled: { cursor: "not-allowed" },
          }}
        >
          <SegmentGroup.ItemText>{option.label}</SegmentGroup.ItemText>
          <SegmentGroup.ItemHiddenInput />
        </SegmentGroup.Item>
      ))}
    </SegmentGroup.Root>
  );
}
