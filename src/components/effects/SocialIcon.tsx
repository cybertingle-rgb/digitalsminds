import type { SocialPlatform } from "@/modules/settings/social-types";

/** Simple brand marks drawn as single-colour SVG (inherit the text colour). */
export function SocialIcon({ platform, className = "h-5 w-5" }: { platform: SocialPlatform; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", "aria-hidden": true as const, fill: "currentColor" };
  if (platform === "facebook") {
    return (
      <svg {...common}>
        <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3Z" />
      </svg>
    );
  }
  if (platform === "instagram") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.9">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M6.9 8.8H3.8V20h3.1V8.8ZM5.4 3.8a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM20.2 13.6c0-3-1.6-5-4.3-5-1.4 0-2.4.7-2.9 1.5V8.8H10V20h3.1v-5.6c0-1.5.6-2.6 2-2.6s1.9 1.1 1.9 2.6V20h3.2v-6.4Z" />
    </svg>
  );
}
