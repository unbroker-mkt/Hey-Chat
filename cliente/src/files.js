export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const FILE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.pptx,.txt,.csv";
export const formatSize = (bytes) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
export async function optimizeFile(file) {
  if (!file.size) throw new Error("El archivo está vacío.");
  if (file.size > MAX_FILE_SIZE)
    throw new Error("Selecciona un archivo de hasta 20 MB.");
  if (!/\.(jpe?g|png|webp|pdf|docx|xlsx|pptx|txt|csv)$/i.test(file.name))
    throw new Error(
      "Usa imágenes JPG, PNG o WebP, o documentos PDF, DOCX, XLSX, PPTX, TXT y CSV.",
    );
  if (!/\.(jpe?g|png|webp)$/i.test(file.name)) return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error("large");
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8),
    );
    if (!blob) throw new Error("encode");
    // Avoid increasing the transfer size for already efficient images.
    if (blob.size >= file.size && scale === 1) return file;
    const extension = blob.type === "image/webp" ? "webp" : "png";
    return new File([blob], file.name.replace(/\.[^.]*$/, `.${extension}`), {
      type: blob.type,
    });
  } catch {
    throw new Error(
      "No pudimos procesar esta imagen. Usa JPG, PNG o WebP de hasta 40 megapíxeles.",
    );
  } finally {
    bitmap?.close();
  }
}
