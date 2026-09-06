export type PublicationStage =
  | "draft-read"
  | "integrity-validation"
  | "evidence-validation"
  | "media-validation"
  | "publication-claim"
  | "github-commit"
  | "receipt-recording";

export interface PublicationFailureDiagnostic {
  code: string;
  stage: PublicationStage;
  retryable: boolean;
  operatorAction: string;
}

/** Convert upstream errors into a bounded operator diagnostic. Raw provider
 * bodies can contain repository details and are deliberately never returned. */
export function publicationFailureDiagnostic(
  error: unknown,
  stage: PublicationStage,
): PublicationFailureDiagnostic {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (/github_token not set|github is not configured/u.test(message)) {
    return {
      code: "github-not-configured",
      stage,
      retryable: false,
      operatorAction: "Configure the newsroom GitHub publication credential.",
    };
  }
  if (/github[^\n]*(?:401|bad credentials)/u.test(message)) {
    return {
      code: "github-authentication-failed",
      stage,
      retryable: false,
      operatorAction: "Replace or re-authorise the newsroom GitHub credential.",
    };
  }
  if (/github[^\n]*(?:403|rate limit|permission)/u.test(message)) {
    return {
      code: "github-permission-or-rate-limit",
      stage,
      retryable: true,
      operatorAction: "Check repository write permission and GitHub rate limits.",
    };
  }
  if (/github[^\n]*404|repository|branch.*not found/u.test(message)) {
    return {
      code: "github-repository-or-branch-not-found",
      stage,
      retryable: false,
      operatorAction: "Verify the configured GitHub owner, repository and branch.",
    };
  }
  if (/github[^\n]*(?:409|422)|update.*ref|reference.*conflict/u.test(message)) {
    return {
      code: "github-publication-conflict",
      stage,
      retryable: true,
      operatorAction: "Retry once after the active publication operation completes.",
    };
  }
  if (/storage|redis|kv\b/u.test(message)) {
    return {
      code: "draft-storage-unavailable",
      stage,
      retryable: true,
      operatorAction: "Check the durable draft-store connection and retry.",
    };
  }
  return {
    code: "publication-upstream-failure",
    stage,
    retryable: true,
    operatorAction: "Inspect the protected server log for this stage, then retry safely.",
  };
}
