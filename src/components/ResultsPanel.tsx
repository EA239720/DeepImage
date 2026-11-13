import { useEffect, useId, useState, type ReactNode } from "react";
import { Box, Flex, Table, Tabs, Text } from "@chakra-ui/react";
import {
  ArrowClockwiseIcon,
  CaretDownIcon,
  CaretUpIcon,
  CheckCircleIcon,
  CopyIcon,
  DownloadSimpleIcon,
  FileCodeIcon,
  FolderSimpleIcon,
  ImageBrokenIcon,
  ImageIcon,
  TrayArrowDownIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import type { Batch, Download, Issue, Status } from "../hooks/useBatch";
import { openFolder } from "../lib/backend";
import { formatBytes, hash } from "../lib/templates";
import { TabTrigger } from "./TabTrigger";
import { Btn, Mono, Tag } from "./ui";

export type TabId = "downloads" | "issues";

/** Rows kept in the table; a long batch would otherwise bog down the list. */
const VISIBLE_DOWNLOADS = 200;

const STATUS: Record<Status, { text: string; dot: string; pulse?: boolean }> = {
  idle: { text: "Listo para iniciar", dot: "fg.subtle" },
  running: { text: "Descargando…", dot: "accent", pulse: true },
  paused: { text: "En pausa", dot: "warning" },
  done: { text: "Lote completado", dot: "success" },
  cancelled: { text: "Cancelado", dot: "fg.subtle" },
};

// Rules fade to transparent over 48px at each end instead of stopping cleanly.
const fadingRule = (color: string) =>
  `linear-gradient(to right, transparent, ${color} 48px, ${color} calc(100% - 48px), transparent) no-repeat bottom / 100% 1px`;
const rowRule = fadingRule("color-mix(in srgb, var(--chakra-colors-fg) 8%, transparent)");
const rowTint = "color-mix(in srgb, var(--chakra-colors-fg) 4%, transparent)";

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="2px" minW="0">
      <Text>{label}</Text>
      <Box fontSize="15px" color="fg" fontVariantNumeric="tabular-nums" truncate>
        {children}
      </Box>
    </Flex>
  );
}

function Summary({ batch, keyCount }: { batch: Batch; keyCount: number }) {
  const status = STATUS[batch.status];
  const total = batch.total || keyCount;
  const percent = batch.total ? Math.round((batch.processed / batch.total) * 100) : 0;
  const bytes = batch.downloads.reduce((sum, d) => sum + d.bytes, 0);

  return (
    <Flex flex="none" direction="column" gap="4" pt="8" px="8" pb="6">
      <Flex align="flex-end" gap="16px" wrap="wrap">
        <Flex direction="column" gap="4px">
          <Flex align="center" gap="8px" fontSize="12px" color="fg.muted">
            <Box
              boxSize="7px"
              borderRadius="full"
              bg={batch.notice ? "danger" : status.dot}
              animation={status.pulse ? "statusPulse 1.2s ease-in-out infinite" : undefined}
            />
            {batch.notice ?? status.text}
          </Flex>
          <Text fontSize="28px" fontWeight="500" lineHeight="1.1" fontVariantNumeric="tabular-nums" whiteSpace="nowrap">
            {batch.processed} <Box as="span" color="fg.subtle">/ {total}</Box>{" "}
            <Box as="span" fontSize="16px" color="fg.muted">
              {total === 1 ? "clave" : "claves"}
            </Box>
          </Text>
        </Flex>
        <Box flex="1" />
        <Text fontSize="28px" fontWeight="500" lineHeight="1.1" color="accent" fontVariantNumeric="tabular-nums">
          {percent}%
        </Text>
      </Flex>

      <Box
        role="progressbar"
        aria-label="Progreso del lote"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        height="6px"
        borderRadius="6px"
        bg="bg.surface"
        overflow="hidden"
        boxShadow="inset 0 0 0 1px {colors.border}"
      >
        <Box
          height="100%"
          width={`${percent}%`}
          borderRadius="6px"
          bg="linear-gradient(90deg, {colors.accent.emphasized}, {colors.accent})"
          boxShadow="0 0 12px {colors.accent.muted}"
          transition="width .3s ease"
        />
      </Box>

      <Flex gap="28px" wrap="wrap" fontSize="12px" color="fg.muted">
        <Stat label="Imágenes guardadas">{batch.downloads.length}</Stat>
        <Stat label="Incidencias">{batch.issues.length}</Stat>
        <Stat label="Tamaño">{formatBytes(bytes)}</Stat>
        <Stat label="Clave actual">
          <Mono color="accent">{batch.current}</Mono>
        </Stat>
      </Flex>
    </Flex>
  );
}

function Empty({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Flex direction="column" align="flex-start" justify="center" gap="8px" height="100%" minH="240px" maxW="420px" px="4">
      <Box color="fg.subtle">{icon}</Box>
      <Text fontSize="15px" fontWeight="500">
        {title}
      </Text>
      <Text fontSize="13px" color="fg.muted" lineHeight="1.5" textWrap="pretty">
        {children}
      </Text>
    </Flex>
  );
}

function DownloadsTable({ downloads }: { downloads: Download[] }) {
  const hidden = downloads.length - VISIBLE_DOWNLOADS;
  return (
    <>
      <Table.Root
        unstyled
        css={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "13px",
          "& th": {
            textAlign: "left",
            fontWeight: "400",
            fontSize: "11px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "fg/60",
            p: "2",
          },
          "& td": { p: "2" },
          "& thead tr": { background: fadingRule("var(--chakra-colors-border)") },
          "& tbody tr": { background: rowRule },
          "& tbody tr:hover": {
            background: `linear-gradient(${rowTint}, ${rowTint}) no-repeat 0 0 / 100% 100%, ${rowRule}`,
          },
        }}
      >
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader width="44px" />
            <Table.ColumnHeader>Clave</Table.ColumnHeader>
            <Table.ColumnHeader>Guardada como</Table.ColumnHeader>
            <Table.ColumnHeader>Origen</Table.ColumnHeader>
            <Table.ColumnHeader css={{ "&&": { textAlign: "right" } }}>Tamaño</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {downloads.slice(0, VISIBLE_DOWNLOADS).map((d) => (
            <Table.Row key={d.id}>
              <Table.Cell>
                <Box
                  boxSize="32px"
                  borderRadius="sm"
                  display="grid"
                  placeItems="center"
                  color="accent"
                  bg={`color-mix(in srgb, {colors.accent} ${[24, 12, 18][(hash(d.key) + d.position) % 3]}%, {colors.bg.surface})`}
                >
                  <ImageIcon />
                </Box>
              </Table.Cell>
              <Table.Cell fontFamily="mono" fontSize="12.5px" whiteSpace="nowrap">
                {d.key}
                {d.of > 1 && (
                  <Box as="span" color="fg.muted">
                    {" "}
                    · {d.position}/{d.of}
                  </Box>
                )}
              </Table.Cell>
              <Table.Cell fontFamily="mono" fontSize="12.5px" color="accent" whiteSpace="nowrap">
                {d.file}
                {d.note && (
                  <Box as="span" display="inline-flex" verticalAlign="middle" ml="6px" color="warning" title={d.note}>
                    <WarningCircleIcon aria-label={d.note} />
                  </Box>
                )}
              </Table.Cell>
              <Table.Cell fontFamily="mono" fontSize="12px" color="fg.muted" maxW="280px" truncate title={d.url}>
                {d.url}
              </Table.Cell>
              <Table.Cell textAlign="right" color="fg.muted" fontVariantNumeric="tabular-nums" whiteSpace="nowrap">
                {d.width !== null && d.height !== null && (
                  <Box as="span" color="fg.subtle">
                    {d.width} × {d.height} ·{" "}
                  </Box>
                )}
                {formatBytes(d.bytes)}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      {hidden > 0 && (
        <Text fontSize="12px" color="fg.muted" p="2" pt="4">
          Se muestran las {VISIBLE_DOWNLOADS} más recientes; hay {hidden} más en la carpeta.
        </Text>
      )}
    </>
  );
}

function IssueCard({ issue, locked, onRetry }: { issue: Issue; locked: boolean; onRetry: () => void }) {
  const [open, setOpen] = useState(false);
  const xml = issue.kind === "xml";
  const panelId = useId();
  return (
    <Box borderRadius="md" bg="bg.panel" boxShadow="sm" overflow="hidden">
      <Flex align="center" gap="12px" py="10px" px="12px" cursor="pointer" _hover={{ bg: "fg/6" }} onClick={() => setOpen(!open)}>
        <Box color="accent" flex="none">
          {xml ? <FileCodeIcon size={18} /> : <ImageBrokenIcon size={18} />}
        </Box>
        <Mono fontSize="13px" minW="70px" whiteSpace="nowrap">
          {issue.key}
          {issue.of > 1 && (
            <Box as="span" color="fg.muted">
              {" "}
              · {issue.position}/{issue.of}
            </Box>
          )}
        </Mono>
        <Tag variant={xml ? "accent" : "neutral"} flex="none">
          {issue.type}
        </Tag>
        <Mono flex="1" minW="0" fontSize="12px" color="fg.muted" truncate>
          {issue.url}
        </Mono>
        <Btn
          variant="ghost"
          fontSize="12px"
          disabled={locked}
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
        >
          <ArrowClockwiseIcon />
          Reintentar
        </Btn>
        <Box
          as="button"
          aria-label={open ? "Ocultar detalle" : "Ver detalle"}
          aria-expanded={open}
          aria-controls={panelId}
          color="fg.muted"
          cursor="pointer"
          flex="none"
        >
          {open ? <CaretUpIcon /> : <CaretDownIcon />}
        </Box>
      </Flex>
      {open && (
        <Flex id={panelId} direction="column" gap="6px" pt="0" pr="12px" pb="12px" pl="42px">
          <Text fontSize="12px" color="fg.muted">
            {issue.detail}
          </Text>
          <Box
            as="pre"
            m="0"
            py="10px"
            px="12px"
            borderRadius="sm"
            bg="bg.inset"
            fontFamily="mono"
            fontSize="12px"
            lineHeight="1.55"
            color="fg.soft"
            whiteSpace="pre-wrap"
            wordBreak="break-all"
            userSelect="text"
          >
            {issue.body}
          </Box>
        </Flex>
      )}
    </Box>
  );
}

interface ResultsPanelProps {
  batch: Batch;
  keyCount: number;
  outDir: string;
  tab: TabId;
  onTab: (tab: TabId) => void;
  onRetry: (keys: string[]) => void;
}

export function ResultsPanel({ batch, keyCount, outDir, tab, onTab, onRetry }: ResultsPanelProps) {
  const [copied, setCopied] = useState(false);
  const locked = batch.status === "running" || batch.status === "paused";
  const finished = batch.status === "done" || batch.status === "cancelled";
  const { downloads, issues } = batch;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  // A key from a table can have several of its images fail.
  const issueKeys = () => [...new Set(issues.map((issue) => issue.key))];

  const copyKeys = () => {
    navigator.clipboard
      .writeText(issueKeys().join(", "))
      .then(() => setCopied(true))
      .catch(() => {});
  };

  const contentStyles = { flex: "1", minHeight: "0", overflow: "auto", pt: "2", px: "6", pb: "8" };

  return (
    <Flex direction="column" minH="0" minW="0">
      <Summary batch={batch} keyCount={keyCount} />

      <Tabs.Root
        unstyled
        value={tab}
        onValueChange={(e) => onTab(e.value as TabId)}
        css={{ display: "flex", flexDirection: "column", flex: "1", minHeight: "0" }}
      >
        <Flex flex="none" align="center" gap="4px" px="8" boxShadow="inset 0 -1px 0 {colors.border.subtle}">
          <Tabs.List css={{ display: "flex" }}>
            <TabTrigger value="downloads" label="Descargas" icon={<DownloadSimpleIcon />} count={downloads.length} />
            <TabTrigger value="issues" label="Incidencias" icon={<WarningCircleIcon />} count={issues.length} />
          </Tabs.List>
          <Box flex="1" />
          {tab === "issues" && issues.length > 0 && (
            <Flex gap="6px">
              <Btn variant="ghost" fontSize="13px" onClick={copyKeys}>
                <CopyIcon />
                {copied ? "Copiadas" : "Copiar claves"}
              </Btn>
              <Btn variant="ghost" fontSize="13px" disabled={locked} onClick={() => onRetry(issueKeys())}>
                <ArrowClockwiseIcon />
                Reintentar todas
              </Btn>
            </Flex>
          )}
          {tab === "downloads" && downloads.length > 0 && finished && (
            <Btn variant="ghost" fontSize="13px" onClick={() => void openFolder(outDir).catch(() => {})}>
              <FolderSimpleIcon />
              Abrir carpeta
            </Btn>
          )}
        </Flex>

        <Tabs.Content value="downloads" css={contentStyles}>
          {downloads.length === 0 ? (
            <Empty icon={<TrayArrowDownIcon size={28} />} title="Aún no hay descargas">
              Pega tus claves y define su URL con [clave], o pega una tabla de claves y URLs. Las imágenes aparecerán
              aquí a medida que se guarden.
            </Empty>
          ) : (
            <DownloadsTable downloads={downloads} />
          )}
        </Tabs.Content>

        <Tabs.Content value="issues" css={contentStyles}>
          {issues.length === 0 ? (
            <Empty icon={<CheckCircleIcon size={28} />} title="Sin incidencias">
              Las claves sin resultados o cuyo endpoint responda con XML se listarán aquí para revisarlas o
              reintentarlas.
            </Empty>
          ) : (
            <Flex direction="column" gap="8px" pt="3">
              {issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} locked={locked} onRetry={() => onRetry([issue.key])} />
              ))}
            </Flex>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
}
