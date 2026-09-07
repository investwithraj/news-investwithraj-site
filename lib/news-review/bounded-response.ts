const JSON_MEDIA_TYPE = "application/json";

function declaredByteLength(response: Response): number | null {
  const raw = response.headers.get("content-length");
  if (raw === null) return null;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(raw)) {
    throw new Error("Remote response declared an invalid size.");
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error("Remote response declared an invalid size.");
  }
  return value;
}

/** Read a response body without ever buffering more than the allowed bytes. */
export async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("Remote response size limit is invalid.");
  }
  const declared = declaredByteLength(response);
  if (declared !== null && declared > maxBytes) {
    throw new Error("Remote response exceeded the size limit.");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("Remote response exceeded the size limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

/** Protected staging endpoints must return bounded, explicit JSON. */
export async function parseBoundedJsonResponse<T>(
  response: Response,
  maxBytes = 1_000_000,
): Promise<T> {
  const mediaType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== JSON_MEDIA_TYPE) {
    throw new Error("Protected response was not application/json.");
  }
  const text = await readBoundedResponseText(response, maxBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Protected response contained invalid JSON.");
  }
}
