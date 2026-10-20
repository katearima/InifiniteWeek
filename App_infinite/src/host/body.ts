export class BodyReadError extends Error {
  constructor(public status: 400 | 499 | 504) { super("Request body unavailable"); }
}

/** Read bounded bytes before admission. Never await an uncooperative stream's cancellation. */
export async function bufferRequest(request: Request, limit: number, deadline: number, signal: AbortSignal): Promise<Request> {
  if (signal.aborted) throw new BodyReadError(499);
  if (Date.now() >= deadline) throw new BodyReadError(504);
  if (!request.body) return request;
  const reader = request.body.getReader();
  let abort!: () => void;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => reject(new BodyReadError(499));
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => reject(new BodyReadError(504)), Math.max(1, deadline - Date.now()));
  });
  try {
    const declared = request.headers.get("content-length");
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new BodyReadError(400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await Promise.race([reader.read(), interrupted]);
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new BodyReadError(400);
      // Own the bytes even if a custom stream reuses its buffers.
      chunks.push(value.slice());
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new Request(request, { body: bytes });
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error instanceof BodyReadError ? error : new BodyReadError(400);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
