import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Box, Dialog, Flex, Image, Portal, Text } from "@chakra-ui/react";
import { ScanIcon } from "@phosphor-icons/react";
import type { SourceImage } from "../../hooks/useImageExtraction";
import type { Region } from "../../lib/ocr";
import { Btn } from "../ui";

/** A rectangle in fractions of the image's width and height, from 0 to 1. */
interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Selections smaller than this many screen pixels are taken as a stray click. */
const MIN_DRAG = 6;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function toFrame({ x, y, width, height }: Region, image: SourceImage): Frame {
  return { left: x / image.width, top: y / image.height, width: width / image.width, height: height / image.height };
}

function toRegion(frame: Frame, image: SourceImage): Region {
  const x = Math.round(frame.left * image.width);
  const y = Math.round(frame.top * image.height);
  return {
    x,
    y,
    width: Math.max(1, Math.min(image.width - x, Math.round(frame.width * image.width))),
    height: Math.max(1, Math.min(image.height - y, Math.round(frame.height * image.height))),
  };
}

/** The largest size with the image's proportions that fits in `space`, never above its own size. */
function fit(image: SourceImage, space: { width: number; height: number }) {
  const scale = Math.min(space.width / image.width, space.height / image.height, 1);
  return { width: Math.floor(image.width * scale), height: Math.floor(image.height * scale) };
}

interface RegionDialogProps {
  image: SourceImage;
  /** Reads the chosen region, or the whole image for `null`. */
  onConfirm: (region: Region | null) => void;
  onCancel: () => void;
}

/** Shows an image large so that a rectangle can be dragged over the part whose text is wanted. */
export function RegionDialog({ image, onConfirm, onCancel }: RegionDialogProps) {
  const [frame, setFrame] = useState<Frame | null>(image.region && toFrame(image.region, image));
  const [space, setSpace] = useState({ width: 0, height: 0 });
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSpace({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const shown = fit(image, space);
  const region = frame && toRegion(frame, image);

  /** Where the pointer is, in fractions of the shown image. */
  const locate = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp((event.clientY - bounds.top) / bounds.height),
    };
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = locate(event);
    setFrame(null);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    const point = locate(event);
    setFrame({
      left: Math.min(start.x, point.x),
      top: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
  };

  const endDrag = () => {
    drag.current = null;
    setFrame((current) =>
      current && current.width * shown.width >= MIN_DRAG && current.height * shown.height >= MIN_DRAG ? current : null,
    );
  };

  return (
    <Dialog.Root
      open
      unstyled
      onOpenChange={(event) => {
        if (!event.open) onCancel();
      }}
    >
      <Portal>
        <Dialog.Backdrop css={{ position: "fixed", inset: "0", zIndex: "modal", bg: "scrim" }} />
        <Dialog.Positioner
          css={{ position: "fixed", inset: "0", zIndex: "modal", display: "grid", placeItems: "center", p: "8" }}
        >
          <Dialog.Content
            css={{
              width: "min(1100px, 100%)",
              height: "min(820px, 100%)",
              display: "flex",
              flexDirection: "column",
              gap: "4",
              p: "8",
              borderRadius: "lg",
              bg: "bg",
              boxShadow: "lg",
            }}
          >
            <Flex direction="column" gap="2px">
              <Dialog.Title css={{ fontFamily: "heading", fontWeight: "500", fontSize: "20px", lineHeight: "1.2" }}>
                Zona a leer
              </Dialog.Title>
              <Dialog.Description css={{ fontSize: "13px", color: "fg.muted" }}>
                Arrastra sobre la imagen para marcar la parte con las claves. Sin zona se lee la imagen completa.
              </Dialog.Description>
            </Flex>

            <Flex ref={stage} flex="1" minH="0" align="center" justify="center" bg="bg.inset" borderRadius="md">
              {shown.width > 0 && (
                <Box
                  position="relative"
                  width={`${shown.width}px`}
                  height={`${shown.height}px`}
                  overflow="hidden"
                  cursor="crosshair"
                  touchAction="none"
                  userSelect="none"
                  onPointerDown={startDrag}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <Image
                    src={image.url}
                    alt={image.file.name}
                    draggable={false}
                    width="100%"
                    height="100%"
                    display="block"
                    pointerEvents="none"
                  />
                  {frame && (
                    <Box
                      position="absolute"
                      left={`${frame.left * 100}%`}
                      top={`${frame.top * 100}%`}
                      width={`${frame.width * 100}%`}
                      height={`${frame.height * 100}%`}
                      borderWidth="2px"
                      borderColor="accent"
                      // Dims everything outside the selection.
                      boxShadow="0 0 0 9999px rgba(0, 0, 0, 0.45)"
                      pointerEvents="none"
                    />
                  )}
                </Box>
              )}
            </Flex>

            <Flex align="center" gap="8px" wrap="wrap">
              <Text fontSize="12px" color="fg.muted" fontVariantNumeric="tabular-nums" mr="auto">
                {region
                  ? `Zona de ${region.width} × ${region.height} px`
                  : `Imagen completa · ${image.width} × ${image.height} px`}
              </Text>
              <Btn type="button" variant="ghost" disabled={!frame} onClick={() => setFrame(null)}>
                Usar imagen completa
              </Btn>
              <Btn type="button" variant="secondary" onClick={onCancel}>
                Cancelar
              </Btn>
              <Btn type="button" variant="primary" onClick={() => onConfirm(region)}>
                <ScanIcon />
                Leer texto
              </Btn>
            </Flex>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
