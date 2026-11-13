import type { ReactNode } from "react";
import { Tabs } from "@chakra-ui/react";
import { Tag } from "./ui";

interface TabTriggerProps {
  value: string;
  label: string;
  icon: ReactNode;
  /** Shown as a chip after the label. */
  count?: number;
  disabled?: boolean;
}

/** A tab of an unstyled `Tabs.Root`: muted text that gains an accent underline when selected. */
export function TabTrigger({ value, label, icon, count, disabled }: TabTriggerProps) {
  return (
    <Tabs.Trigger
      value={value}
      disabled={disabled}
      css={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        py: "12px",
        px: "4px",
        mr: "16px",
        fontSize: "13px",
        cursor: "pointer",
        color: "fg.muted",
        _selected: {
          color: "fg",
          boxShadow: "inset 0 -2px 0 {colors.accent}",
          "& .count": { bg: "accent.muted" },
        },
        _disabled: { opacity: 0.6, cursor: "not-allowed" },
      }}
    >
      {icon}
      {label}
      {count !== undefined && (
        <Tag className="count" py="1px" px="7px">
          {count}
        </Tag>
      )}
    </Tabs.Trigger>
  );
}
