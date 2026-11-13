import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const inter = '"Inter Variable", "Inter", system-ui, sans-serif';

// Catppuccin palettes: Latte is the light mode, Frappé the dark one.
const latte = {
  rosewater: "#dc8a78",
  flamingo: "#dd7878",
  pink: "#ea76cb",
  mauve: "#8839ef",
  red: "#d20f39",
  maroon: "#e64553",
  peach: "#fe640b",
  yellow: "#df8e1d",
  green: "#40a02b",
  teal: "#179299",
  sky: "#04a5e5",
  sapphire: "#209fb5",
  blue: "#1e66f5",
  lavender: "#7287fd",
  text: "#4c4f69",
  subtext1: "#5c5f77",
  subtext0: "#6c6f85",
  overlay2: "#7c7f93",
  overlay1: "#8c8fa1",
  overlay0: "#9ca0b0",
  surface2: "#acb0be",
  surface1: "#bcc0cc",
  surface0: "#ccd0da",
  base: "#eff1f5",
  mantle: "#e6e9ef",
  crust: "#dce0e8",
};

const frappe: typeof latte = {
  rosewater: "#f2d5cf",
  flamingo: "#eebebe",
  pink: "#f4b8e4",
  mauve: "#ca9ee6",
  red: "#e78284",
  maroon: "#ea999c",
  peach: "#ef9f76",
  yellow: "#e5c890",
  green: "#a6d189",
  teal: "#81c8be",
  sky: "#99d1db",
  sapphire: "#85c1dc",
  blue: "#8caaee",
  lavender: "#babbf1",
  text: "#c6d0f5",
  subtext1: "#b5bfe2",
  subtext0: "#a5adce",
  overlay2: "#949cbb",
  overlay1: "#838ba7",
  overlay0: "#737994",
  surface2: "#626880",
  surface1: "#51576d",
  surface0: "#414559",
  base: "#303446",
  mantle: "#292c3c",
  crust: "#232634",
};

type ColorName = keyof typeof latte;

/**
 * A token value per color mode, following the `light` / `dark` class on <html>.
 * `_light` is spelled out so it also replaces the light value of the Chakra tokens it overrides.
 */
const modes = (light: string, dark: string) => ({ value: { base: light, _light: light, _dark: dark } });

const flavored = (name: ColorName) => modes(latte[name], frappe[name]);

// Every Catppuccin color as `ctp.<name>`. Catppuccin's `base` is the exception: Chakra reserves
// that word in token paths, so it lives only as the `bg` token.
const ctp = Object.fromEntries(
  (Object.keys(latte) as ColorName[]).filter((name) => name !== "base").map((name) => [name, flavored(name)]),
);

// Layout, type and component shapes come from the Nocturne design system; colors from Catppuccin.
const config = defineConfig({
  globalCss: {
    "html, body, #root": { height: "100%" },
    html: { colorPalette: "accent" },
    body: {
      margin: 0,
      bg: "bg",
      color: "fg",
      fontFamily: "body",
      fontSize: "15px",
      lineHeight: "1.55",
      overflow: "hidden",
    },
    ":focus": { outline: "none" },
    ":focus-visible": {
      outline: "2px solid",
      outlineColor: "accent",
      outlineOffset: "2px",
    },
    "::selection": { bg: "accent/30" },
    "::-webkit-scrollbar": { width: "10px", height: "10px" },
    "::-webkit-scrollbar-thumb": {
      bg: "ctp.surface1",
      borderRadius: "8px",
      border: "2px solid transparent",
      backgroundClip: "padding-box",
    },
  },
  theme: {
    keyframes: {
      statusPulse: {
        "0%, 100%": { opacity: 1 },
        "50%": { opacity: 0.35 },
      },
    },
    tokens: {
      fonts: {
        heading: { value: inter },
        body: { value: inter },
        mono: { value: "ui-monospace, Menlo, monospace" },
      },
      // Chakra's scale at Nocturne's 0.7× density.
      spacing: {
        1: { value: "2.8px" },
        2: { value: "5.6px" },
        3: { value: "8.4px" },
        4: { value: "11.2px" },
        6: { value: "16.8px" },
        8: { value: "22.4px" },
      },
      radii: {
        sm: { value: "4px" },
        md: { value: "8px" },
        lg: { value: "14px" },
      },
    },
    semanticTokens: {
      colors: {
        ctp,
        bg: {
          // The main pane; side panes and cards step down to mantle, wells to crust.
          DEFAULT: flavored("base"),
          panel: { value: "{colors.ctp.mantle}" },
          inset: { value: "{colors.ctp.crust}" },
          surface: { value: "{colors.ctp.surface0}" },
          muted: { value: "{colors.ctp.surface0}" },
        },
        fg: {
          DEFAULT: { value: "{colors.ctp.text}" },
          // Latte sits one step darker than Frappé: its lighter tones are too faint for small text.
          soft: modes("{colors.ctp.text}", "{colors.ctp.subtext1}"),
          muted: modes("{colors.ctp.subtext1}", "{colors.ctp.subtext0}"),
          subtle: modes("{colors.ctp.subtext0}", "{colors.ctp.overlay2}"),
        },
        border: {
          DEFAULT: { value: "{colors.ctp.surface1}" },
          subtle: { value: "{colors.ctp.surface0}" },
        },
        accent: {
          // Frappé keeps Catppuccin's mauve. Latte's is too loud on its pale ground, so the light mode
          // uses a muted slate indigo in the ground's own blue family.
          DEFAULT: modes("#4d5fa6", "{colors.ctp.mauve}"),
          solid: { value: "{colors.accent}" },
          contrast: { value: "{colors.bg}" },
          fg: { value: "{colors.accent}" },
          muted: { value: "{colors.accent/30}" },
          subtle: { value: "{colors.accent/16}" },
          // The lighter tone the progress bar fades in from.
          emphasized: modes("#8a99cf", "{colors.ctp.lavender}"),
          focusRing: { value: "{colors.accent}" },
        },
        success: { value: "{colors.ctp.green}" },
        warning: { value: "{colors.ctp.yellow}" },
        danger: { value: "{colors.ctp.red}" },
        // What dims the window behind a dialog.
        scrim: modes("rgba(76, 79, 105, 0.38)", "rgba(35, 38, 52, 0.62)"),
      },
      // Soft ink-tinted shadows on the light ground; a hairline edge plus ambient darkness on the dark one.
      shadows: {
        sm: modes(
          "0 0 0 1px {colors.ctp.surface0}, 0 1px 2px rgba(76, 79, 105, 0.08)",
          "0 0 0 1px {colors.ctp.surface1}",
        ),
        md: modes(
          "0 0 0 1px {colors.ctp.surface0}, 0 6px 18px rgba(76, 79, 105, 0.16)",
          "0 0 0 1px {colors.ctp.surface1}, 0 6px 18px rgba(0, 0, 0, 0.4)",
        ),
        lg: modes(
          "0 0 0 1px {colors.ctp.surface1}, 0 16px 40px rgba(76, 79, 105, 0.24)",
          "0 0 0 1px {colors.ctp.surface2}, 0 16px 40px rgba(0, 0, 0, 0.5)",
        ),
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
