import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { contactDetails } from "@/modules/content/settings";

/** Floating WhatsApp support button; shown only after the owner adds a number in Admin → Website → Contact. */
export async function WhatsAppButton({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const { whatsapp } = await contactDetails(locale, dict).catch(() => ({ whatsapp: null }));
  if (!whatsapp) return null;
  return (
    <a
      href={`https://wa.me/${whatsapp}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={dict.contact.whatsappButton}
      title={dict.contact.whatsappButton}
      className="fixed bottom-5 start-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg ring-4 ring-white/70 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal-900"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.82 14.13c-.25.69-1.44 1.32-1.98 1.4-.5.08-1.15.11-1.86-.12-.43-.14-.98-.32-1.69-.62-2.97-1.28-4.91-4.27-5.06-4.47-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.6-.37.8-.37l.57.01c.18.01.43-.07.67.51.25.6.84 2.06.92 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.61.17.3.77 1.27 1.65 2.06 1.14 1.01 2.09 1.33 2.39 1.48.3.15.47.12.65-.07.17-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.74.82 2.04.97.3.15.5.22.57.35.07.12.07.72-.18 1.41Z" />
      </svg>
    </a>
  );
}
