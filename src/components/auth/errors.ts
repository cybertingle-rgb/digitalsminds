import type { Dictionary } from "@/i18n/dictionaries/en";

type AuthError = { code?: string; status?: number; message?: string } | null | undefined;

/** Map Better Auth error codes to friendly, translated messages. */
export function authErrorMessage(error: AuthError, t: Dictionary["auth"]["errors"]): string {
  if (!error) return t.generic;
  if (error.status === 429) return t.tooManyAttempts;
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return t.invalidCredentials;
    case "EMAIL_NOT_VERIFIED":
      return t.emailNotVerified;
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return t.emailTaken;
    case "PASSWORD_TOO_SHORT":
      return t.passwordTooShort;
    case "INVALID_EMAIL":
      return t.email;
    case "FAILED_TO_CREATE_SESSION":
      return t.suspended;
    default:
      return t.generic;
  }
}
