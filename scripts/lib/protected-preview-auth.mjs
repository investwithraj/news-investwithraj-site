export const NEWSROOM_PROTECTION_BYPASS_ENV =
  "NEWSROOM_VERCEL_PROTECTION_BYPASS";
export const ADVISORY_PROTECTION_BYPASS_ENV =
  "IWR_VERCEL_PROTECTION_BYPASS";
export const PROTECTION_BYPASS_HEADER = "x-vercel-protection-bypass";

const ALLOWED_ENVIRONMENT_NAMES = new Set([
  NEWSROOM_PROTECTION_BYPASS_ENV,
  ADVISORY_PROTECTION_BYPASS_ENV,
]);

function readBypassToken(environmentName, environment) {
  if (!ALLOWED_ENVIRONMENT_NAMES.has(environmentName)) {
    throw new TypeError("Unknown protected-Preview credential scope");
  }

  const candidate = environment?.[environmentName];
  if (candidate === undefined) return null;

  if (
    typeof candidate !== "string" ||
    candidate.length === 0 ||
    candidate.trim().length === 0
  ) {
    throw new TypeError(`${environmentName} must be a non-empty string`);
  }

  if (candidate !== candidate.trim() || /[\u0000-\u001f\u007f]/u.test(candidate)) {
    throw new TypeError(
      `${environmentName} must not contain surrounding whitespace or control characters`,
    );
  }

  return candidate;
}

export function createProtectedPreviewAuth(
  environmentName,
  environment = process.env,
) {
  const bypassToken = readBypassToken(environmentName, environment);

  return Object.freeze({
    authConfigured: bypassToken !== null,

    browserContextOptions(options = {}) {
      if (bypassToken === null) return options;

      const retainedHeaders = Object.fromEntries(
        Object.entries(options.extraHTTPHeaders ?? {}).filter(
          ([name]) => name.toLowerCase() !== PROTECTION_BYPASS_HEADER,
        ),
      );

      return {
        ...options,
        extraHTTPHeaders: {
          ...retainedHeaders,
          [PROTECTION_BYPASS_HEADER]: bypassToken,
        },
      };
    },

    fetchOptions(options = {}) {
      if (bypassToken === null) return options;

      const headers = new Headers(options.headers);
      headers.set(PROTECTION_BYPASS_HEADER, bypassToken);
      return { ...options, headers };
    },
  });
}
