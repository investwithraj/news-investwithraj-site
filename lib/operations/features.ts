export function explicitlyEnabled(environmentName: string): boolean {
  return process.env[environmentName] === "1";
}

export function productionFeatureAvailable(environmentName: string): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return explicitlyEnabled(environmentName);
}

export function syntheticEditorialMediaAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return explicitlyEnabled("ALLOW_SYNTHETIC_EDITORIAL_MEDIA");
}

export function diagnosticsAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return explicitlyEnabled("ENABLE_DIAGNOSTIC_GENERATION");
}

/**
 * Raj's voice/likeness cannot be generated or exposed in production until a
 * separate reviewed-recording and human media-approval workflow exists.
 */
export function dailyAnchorGenerationAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return explicitlyEnabled("ENABLE_DAILY_ANCHOR_PIPELINE");
}
