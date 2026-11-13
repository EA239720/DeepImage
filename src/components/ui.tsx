import { chakra, type SystemStyleObject } from "@chakra-ui/react";

/** Nocturne actions: the primary is an accent outline, never a fill. */
export const Btn = chakra("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    cursor: "pointer",
    fontFamily: "heading",
    fontWeight: "500",
    fontSize: "14px",
    lineHeight: "1.2",
    whiteSpace: "nowrap",
    color: "fg",
    bg: "transparent",
    borderWidth: "1px",
    borderColor: "transparent",
    py: "2",
    px: "calc({spacing.3} * 1.2)",
    borderRadius: "md",
    _disabled: { opacity: 0.45, cursor: "not-allowed" },
  },
  variants: {
    variant: {
      primary: {
        color: "accent",
        borderColor: "accent",
        _hover: { bg: "accent/12" },
        _active: { bg: "accent/22" },
      },
      secondary: {
        borderColor: "border",
        _hover: { bg: "fg/7" },
        _active: { bg: "fg/14" },
      },
      ghost: {
        color: "accent",
        px: "1",
        _hover: { bg: "accent/10" },
        _active: { bg: "accent/18" },
      },
      danger: {
        color: "danger",
        borderColor: "danger",
        _hover: { bg: "danger/12" },
        _active: { bg: "danger/22" },
      },
    },
  },
  defaultVariants: { variant: "secondary" },
});

const tagBase: SystemStyleObject = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: "11px",
  lineHeight: "1.55",
  letterSpacing: "0.02em",
  py: "3px",
  px: "10px",
  borderRadius: "6px",
};

export const Tag = chakra("span", {
  base: tagBase,
  variants: {
    variant: {
      accent: { bg: "accent.muted", color: "fg" },
      neutral: { bg: "bg.surface", color: "fg" },
    },
  },
  defaultVariants: { variant: "neutral" },
});

/** An outlined tag that inserts a template token when pressed. */
export const TokenButton = chakra("button", {
  base: {
    ...tagBase,
    fontFamily: "mono",
    cursor: "pointer",
    bg: "transparent",
    color: "accent",
    borderWidth: "1px",
    borderColor: "accent",
    _hover: { bg: "accent/12" },
    _active: { bg: "accent/22" },
    _disabled: { opacity: 0.45, cursor: "not-allowed" },
  },
});

/** Shared look of text fields; apply to an unstyled Input or Textarea. */
export const inputStyles: SystemStyleObject = {
  width: "100%",
  minHeight: "36px",
  py: "6px",
  px: "10px",
  fontSize: "14px",
  color: "fg",
  caretColor: "accent",
  bg: "bg",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "md",
  _placeholder: { color: "fg.subtle" },
  _hover: { borderColor: "fg/45" },
  _focusVisible: { borderColor: "accent", outlineOffset: "0" },
  _disabled: { opacity: 0.6, cursor: "not-allowed" },
};

export const monoStyles: SystemStyleObject = {
  fontFamily: "mono",
  fontSize: "12.5px",
};

export const Mono = chakra("span", { base: { fontFamily: "mono" } });
