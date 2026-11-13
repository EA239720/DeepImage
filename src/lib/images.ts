/** Image files that can be added: formats the webview opens and Tesseract reads. */
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

/** For the file picker: offers only those formats. */
export const IMAGE_ACCEPT = IMAGE_EXTENSIONS.map((extension) => `.${extension}`).join(",");

/** Beyond this, reading the text takes too long and can run out of memory. */
const MAX_PIXELS = 50_000_000;

export type ImageCheck = { width: number; height: number } | { problem: string };

/** Whether `file` is an image that can be read, judged by its extension, its type and its contents. */
export async function checkImage(file: File): Promise<ImageCheck> {
  const dot = file.name.lastIndexOf(".");
  const extension = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  if (!extension) return { problem: "no tiene extensión de imagen" };
  if (!IMAGE_EXTENSIONS.includes(extension)) return { problem: `.${extension} no es una extensión de imagen válida` };
  if (file.type && !file.type.startsWith("image/")) return { problem: "su contenido no es una imagen" };
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    if (size.width * size.height > MAX_PIXELS) return { problem: "es demasiado grande (más de 50 megapíxeles)" };
    return size;
  } catch {
    return { problem: "no se pudo abrir: el archivo está dañado o no es la imagen que dice ser" };
  }
}
