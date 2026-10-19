import { NextResponse } from "next/server";
import type { z } from "zod";

/** Error that is safe to show to API clients. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Convert any thrown value into a JSON response. Unknown errors are logged
 * server-side and returned as a generic 500 so internals never leak.
 */
export function errorResponse(err: unknown, headers?: HeadersInit): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status, headers },
    );
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json(
    { ok: false, error: { code: "internal_error", message: "Something went wrong. Please try again later." } },
    { status: 500, headers },
  );
}
