import { siteConfig } from "@/config/site";
import type { Dictionary } from "@/i18n/get-dictionary";

/** Email and office address. No phone numbers are shown (owner decision). */
export function ContactDetails({ dict, inverse = false, className = "" }: { dict: Dictionary; inverse?: boolean; className?: string }) {
  const label = inverse ? "text-white" : "text-charcoal-900";
  const link = inverse ? "hover:text-sun-400" : "underline-offset-4 hover:underline";
  return (
    <dl className={`space-y-4 ${className}`}>
      <div>
        <dt className={`font-semibold ${label}`}>{dict.contact.emailLabel}</dt>
        <dd className="mt-1">
          <a className={link} href={`mailto:${siteConfig.contact.email}`} dir="ltr">
            {siteConfig.contact.email}
          </a>
        </dd>
      </div>
      <div>
        <dt className={`font-semibold ${label}`}>{dict.contact.officeLabel}</dt>
        <dd className="mt-1">
          <address className="not-italic">
            {dict.contact.address.map((line) => (
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
