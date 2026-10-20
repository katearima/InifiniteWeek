export async function preparePicture(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG, or WebP picture.");
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("Choose a picture smaller than 10 MB.");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("This picture could not be opened. Try another JPEG, PNG, or WebP file."); }
  try {
    if (!bitmap.width || !bitmap.height) throw new Error("This picture is empty.");
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser cannot prepare this picture.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.5, 0.35]) {
      const encoded = canvas.toDataURL("image/jpeg", quality);
      const payload = encoded.split(",")[1] ?? "";
      const bytes = payload.length * 3 / 4 - (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0);
      if (encoded.startsWith("data:image/jpeg;base64,") && bytes <= 512 * 1024) return encoded;
    }
    throw new Error("This picture is still too large after resizing. Try a smaller picture.");
  } finally { bitmap.close(); }
}
