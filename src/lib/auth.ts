import "server-only";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { db } from "@/lib/db";
import { authSecret } from "@/lib/env";
import { sendMail } from "@/lib/mailer";
import { CLIENT_IP_HEADER } from "@/lib/request";
import { actionEmail } from "@/modules/email/templates";
import { getGoogleCredentials } from "@/modules/settings/integrations";

type GoogleCredentials = Awaited<ReturnType<typeof getGoogleCredentials>>;

const optionalEmail = z.email().max(254).transform((v) => v.toLowerCase());
const phone = z.string().trim().regex(/^[+()\-\s\d]{6,40}$/);
const city = z.string().trim().min(1).max(80);

/** Keep only valid optional profile values; never trust what the client sent. */
function cleanProfile(user: Record<string, unknown>) {
  const email = String(user.email ?? "").toLowerCase();
  const google = optionalEmail.safeParse(user.googleEmail);
  const ph = phone.safeParse(user.phone);
  const ct = city.safeParse(user.city);
  const locale = typeof user.preferredLocale === "string" && hasLocale(user.preferredLocale) ? user.preferredLocale : "en";
  return {
    googleEmail: google.success ? google.data : email,
    phone: ph.success ? ph.data : null,
    city: ct.success ? ct.data : null,
    preferredLocale: locale,
    role: "STUDENT",
    status: "ACTIVE",
  };
}

async function sendAuthEmail(kind: "verify" | "reset", user: { email: string; name: string } & Record<string, unknown>, url: string) {
  const locale: Locale = typeof user.preferredLocale === "string" && hasLocale(user.preferredLocale) ? user.preferredLocale : "en";
  const dict = getDictionary(locale);
  const e = dict.emails;
  const mail = actionEmail({
    dict,
    locale,
    to: user.email,
    // The name of an unverified account was typed by whoever signed up, who may not own this inbox.
    name: user.emailVerified === true ? user.name : "",
    url,
    ...(kind === "verify"
      ? { subject: e.verifySubject, intro: e.verifyIntro, buttonLabel: e.verifyButton }
      : { subject: e.resetSubject, intro: e.resetIntro, buttonLabel: e.resetButton }),
  });
  try {
    await sendMail(mail);
  } catch (err) {
    // Don't fail sign-up/reset because mail is down; the user can request a new link.
    console.error(`[auth] could not send ${kind} email`, err instanceof Error ? err.message : err);
  }
}

function createAuth(google: GoogleCredentials) {
  return betterAuth({
    appName: "Digitals Minds",
    baseURL: siteConfig.url,
    secret: authSecret(),
    trustedOrigins: [siteConfig.url],
    database: prismaAdapter(db(), { provider: "mysql" }),
    telemetry: { enabled: false },

    user: {
      additionalFields: {
        role: { type: "string", required: false, input: false, defaultValue: "STUDENT" },
        status: { type: "string", required: false, input: false, defaultValue: "ACTIVE" },
        googleEmail: { type: "string", required: false, input: true },
        phone: { type: "string", required: false, input: true },
        city: { type: "string", required: false, input: true },
        preferredLocale: { type: "string", required: false, input: true, defaultValue: "en" },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 14, // 14 days
      updateAge: 60 * 60 * 24, // refresh daily while active
    },

    emailAndPassword: {
      enabled: true,
      // Student accounts are created by the enrollment process after a verified payment;
      // staff accounts by invitation. Nobody can sign up on their own.
      disableSignUp: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      // A reset (or staff invite) link proves the person controls the mailbox.
      onPasswordReset: async ({ user }) => {
        if (!user.emailVerified) await db().user.update({ where: { id: user.id }, data: { emailVerified: true } });
      },
      sendResetPassword: ({ user, url }) => sendAuthEmail("reset", user, url),
    },

    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: ({ user, url }) => sendAuthEmail("verify", user, url),
    },

    socialProviders: google
      ? { google: { clientId: google.clientId, clientSecret: google.clientSecret, prompt: "select_account", disableSignUp: true } }
      : {},

    account: {
      accountLinking: {
        enabled: true,
        // Google verifies email ownership, so a Google login can join an existing account with the same email.
        trustedProviders: ["google"],
        // Lets an admin link a Google account whose address differs from their login email ("Connect & test").
        allowDifferentEmails: true,
      },
    },

    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        // Per client IP. 15/min leaves room for a classroom on one Wi-Fi while still stopping guessing.
        "/sign-in/email": { window: 60, max: 15 },
        "/request-password-reset": { window: 600, max: 3 },
        "/send-verification-email": { window: 600, max: 3 },
        "/reset-password": { window: 600, max: 5 },
      },
    },

    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
      cookiePrefix: "dm",
      // Set by src/app/api/auth/[...all]/route.ts from the proxy-added hop (see clientIp).
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            // Accounts are never created through the auth API (sign-up is disabled above; this is
            // a second lock): students get one when their payment is verified, staff by invitation,
            // and the Super Admin through /setup.
            if (ctx?.path || user.email.toLowerCase() === siteConfig.superAdminEmail) {
              throw new APIError("FORBIDDEN", { message: "Accounts are created after enrollment.", code: "SIGNUP_CLOSED" });
            }
            return { data: { ...user, email: user.email.toLowerCase(), ...cleanProfile(user) } };
          },
        },
        update: {
          before: async (data) => {
            // Profile edits through the API can never change role or status.
            const { role: _role, status: _status, ...rest } = data as Record<string, unknown>;
            void _role;
            void _status;
            // Same checks as sign-up for profile fields; an invalid value is ignored, not saved.
            const checks: Record<string, (v: unknown) => boolean> = {
              name: (v) => typeof v === "string" && v.trim().length >= 1 && v.length <= 120 && !/[\x00-\x1f\x7f]/.test(v),
              googleEmail: (v) => v === null || optionalEmail.safeParse(v).success,
              phone: (v) => v === null || phone.safeParse(v).success,
              city: (v) => v === null || city.safeParse(v).success,
              preferredLocale: (v) => typeof v === "string" && hasLocale(v),
            };
            for (const [field, ok] of Object.entries(checks)) if (field in rest && !ok(rest[field])) delete rest[field];
            return { data: rest };
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const user = await db().user.findUnique({ where: { id: session.userId }, select: { status: true } });
            if (!user || user.status === "SUSPENDED") return false;
          },
        },
      },
    },

    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Kept on globalThis: in a production build, route handlers and server actions are
// separate bundles, so module-level variables would not be shared between them.
const state = globalThis as unknown as { __dmAuth?: { key: string; auth: Auth; checkedAt: number } };

/**
 * The auth instance is rebuilt when the Google credentials saved in
 * Admin → Integrations change (checked at most every 15 seconds, or right
 * away after invalidateAuth()).
 */
export async function getAuth(): Promise<Auth> {
  const cached = state.__dmAuth;
  if (cached && Date.now() - cached.checkedAt < 15_000) return cached.auth;
  const google = await getGoogleCredentials();
  const key = google ? `${google.clientId}:${google.updatedAt}` : "none";
  const auth = cached && cached.key === key ? cached.auth : createAuth(google);
  state.__dmAuth = { key, auth, checkedAt: Date.now() };
  return auth;
}

/** Call after changing integration settings so the next request picks them up. */
export function invalidateAuth() {
  if (state.__dmAuth) state.__dmAuth.checkedAt = 0;
}
