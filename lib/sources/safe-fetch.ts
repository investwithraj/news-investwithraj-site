import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2002::", 16],
  ["3fff::", 20],
] as const) {
  BLOCKED.addSubnet(network, prefix, "ipv6");
}

export interface SafeFetchOptions {
  allowedDomains: string[];
  accept: string;
  allowedContentTypes: RegExp;
  maxBytes: number;
  timeoutMs: number;
  maxRedirects?: number;
  userAgent: string;
}

export interface SafeFetchResult {
  bytes: Buffer;
  finalUrl: string;
  contentType: string;
}

function normalizedHost(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

function hostAllowed(hostname: string, allowedDomains: string[]): boolean {
  const host = normalizedHost(hostname);
  return allowedDomains.some((domain) => {
    const allowed = normalizedHost(domain);
    return Boolean(allowed) && (host === allowed || host.endsWith(`.${allowed}`));
  });
}

function validateUrl(value: string, allowedDomains: string[]): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443") ||
    !hostAllowed(url.hostname, allowedDomains)
  ) {
    throw new Error("Source URL is outside the approved HTTPS host boundary.");
  }
  return url;
}

function publicAddress(address: string, family: number): boolean {
  if (family === 4 || isIP(address) === 4) {
    return !BLOCKED.check(address, "ipv4");
  }
  if (family === 6 || isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice("::ffff:".length);
      return isIP(mapped) === 4 && !BLOCKED.check(mapped, "ipv4");
    }
    return !BLOCKED.check(address, "ipv6");
  }
  return false;
}

async function pinnedAddress(
  hostname: string,
  deadline: number,
): Promise<{
  address: string;
  family: 4 | 6;
}> {
  if (isIP(hostname)) {
    const family = isIP(hostname) as 4 | 6;
    if (!publicAddress(hostname, family)) {
      throw new Error("Source host resolves to a non-public address.");
    }
    return { address: hostname, family };
  }
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) throw new Error("Source DNS lookup timed out.");
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const records = await Promise.race([
    lookup(hostname, { all: true, verbatim: true }),
    new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error("Source DNS lookup timed out.")),
        remainingMs,
      );
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
  if (
    records.length === 0 ||
    records.some((record) => !publicAddress(record.address, record.family))
  ) {
    throw new Error("Source host has a non-public or unresolved address.");
  }
  return records[0] as { address: string; family: 4 | 6 };
}

async function requestOnce(
  url: URL,
  options: SafeFetchOptions,
  deadline: number,
): Promise<
  | { redirect: string }
  | { bytes: Buffer; contentType: string }
> {
  const pinned = await pinnedAddress(url.hostname, deadline);
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) throw new Error("Source fetch timed out.");

  return new Promise((resolve, reject) => {
    let settled = false;
    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const request = httpsRequest(
      {
        protocol: "https:",
        hostname: url.hostname,
        port: 443,
        servername: url.hostname,
        method: "GET",
        path: `${url.pathname}${url.search}`,
        headers: {
          "User-Agent": options.userAgent,
          Accept: options.accept,
          "Accept-Encoding": "identity",
          Host: url.hostname,
        },
        lookup: ((_hostname, lookupOptions, callback) => {
          // Node 24 enables address-family auto-selection for HTTPS requests
          // and asks custom lookup functions for `all` results. Returning the
          // legacy single-address callback shape in that mode makes Node read
          // an undefined address and reject every source request. Preserve DNS
          // pinning while matching the callback shape requested by the client.
          if (
            typeof lookupOptions === "object" &&
            lookupOptions !== null &&
            lookupOptions.all
          ) {
            callback(null, [pinned]);
            return;
          }
          callback(null, pinned.address, pinned.family);
        }) as LookupFunction,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          const location = response.headers.location;
          response.resume();
          if (!location) {
            finishError(new Error("Source redirect has no destination."));
            return;
          }
          settled = true;
          resolve({ redirect: new URL(location, url).toString() });
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          finishError(new Error(`Source request failed (${status}).`));
          return;
        }
        const contentType = String(response.headers["content-type"] ?? "");
        const contentEncoding = String(
          response.headers["content-encoding"] ?? "identity",
        ).toLowerCase();
        options.allowedContentTypes.lastIndex = 0;
        if (!options.allowedContentTypes.test(contentType)) {
          response.resume();
          finishError(new Error("Source response type is not approved."));
          return;
        }
        if (contentEncoding !== "identity") {
          response.resume();
          finishError(
            new Error("Compressed source responses are not accepted."),
          );
          return;
        }
        const declared = Number(response.headers["content-length"] ?? "0");
        if (Number.isFinite(declared) && declared > options.maxBytes) {
          response.destroy();
          finishError(new Error("Source response exceeds the byte limit."));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer | Uint8Array) => {
          const bytes = Buffer.from(chunk);
          size += bytes.length;
          if (size > options.maxBytes) {
            response.destroy(
              new Error("Source response exceeds the byte limit."),
            );
            return;
          }
          chunks.push(bytes);
        });
        response.on("error", finishError);
        response.on("end", () => {
          if (settled) return;
          settled = true;
          resolve({ bytes: Buffer.concat(chunks, size), contentType });
        });
      },
    );
    request.setTimeout(remainingMs, () => {
      request.destroy(new Error("Source fetch timed out."));
    });
    request.on("error", finishError);
    request.end();
  });
}

/**
 * HTTPS-only, host-allowlisted, DNS-pinned, redirect-bounded and byte-capped
 * fetch used by every external newsroom source.
 */
export async function safeFetchBytes(
  initialUrl: string,
  options: SafeFetchOptions,
): Promise<SafeFetchResult> {
  if (
    options.allowedDomains.length === 0 ||
    options.maxBytes < 1 ||
    options.maxBytes > 5 * 1024 * 1024 ||
    options.timeoutMs < 1_000 ||
    options.timeoutMs > 60_000 ||
    !Number.isSafeInteger(options.maxRedirects ?? 3) ||
    (options.maxRedirects ?? 3) < 0 ||
    (options.maxRedirects ?? 3) > 5
  ) {
    throw new Error("Safe source-fetch options are invalid.");
  }
  const deadline = Date.now() + options.timeoutMs;
  let current = validateUrl(initialUrl, options.allowedDomains);
  const visited = new Set<string>();
  const redirects = options.maxRedirects ?? 3;

  for (let hop = 0; hop <= redirects; hop += 1) {
    if (visited.has(current.toString())) {
      throw new Error("Source redirect loop rejected.");
    }
    visited.add(current.toString());
    const result = await requestOnce(current, options, deadline);
    if ("redirect" in result) {
      if (hop === redirects) throw new Error("Too many source redirects.");
      current = validateUrl(result.redirect, options.allowedDomains);
      continue;
    }
    return {
      ...result,
      finalUrl: current.toString(),
    };
  }
  throw new Error("Source fetch did not resolve.");
}

export function urlOnApprovedHost(
  value: string,
  allowedDomains: string[],
): boolean {
  try {
    validateUrl(value, allowedDomains);
    return true;
  } catch {
    return false;
  }
}
