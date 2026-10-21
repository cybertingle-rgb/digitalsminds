import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { contactDetails } from "@/modules/content/settings";

/** Email, WhatsApp (only once the owner adds a number) and office address. */
export async function ContactDetails({ dict, locale, inverse = false, className = "" }: { dict: Dictionary; locale: Locale; inverse?: boolean; className?: string }) {
  const contact = await contactDetails(locale, dict);
  const label = inverse ? "text-white" : "text-charcoal-900";
  const link = inverse ? "hover:text-sun-400" : "underline-offset-4 hover:underline";
  return (
    <dl className={`space-y-4 ${className}`}>
      <div>
        <dt className={`font-semibold ${label}`}>{dict.contact.emailLabel}</dt>
        <dd className="mt-1">
          <a className={link} href={`mailto:${contact.email}`} dir="ltr">
            {contact.email}
          </a>
        </dd>
      </div>
      {contact.whatsapp && (
        <div>
          <dt className={`font-semibold ${label}`}>{dict.contact.whatsappLabel}</dt>
          <dd className="mt-1">
            <a className={link} href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" dir="ltr">
              +{contact.whatsapp}
            </a>
          </dd>
        </div>
      )}
      <div>
        <dt className={`font-semibold ${label}`}>{dict.contact.officeLabel}</dt>
        <dd className="mt-1">
          <address className="not-italic">
            {contact.address.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        </dd>
      </div>
    </dl>
  );
}
