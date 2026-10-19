import { siteConfig } from "@/config/site";

/** Lists only the contact channels configured via environment variables. */
export function ContactChannels({ className = "", inverse = false }: { className?: string; inverse?: boolean }) {
  const { email, phone, whatsapp } = siteConfig.contact;
  if (!email && !phone && !whatsapp) return null;
  const link = inverse ? "hover:text-white" : "text-brand-700 hover:underline";
  return (
    <ul className={`space-y-1 ${className}`}>
      {email && (
        <li>
          Email: <a className={link} href={`mailto:${email}`}>{email}</a>
        </li>
      )}
      {phone && (
        <li>
          Phone: <a className={link} href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>
        </li>
      )}
      {whatsapp && (
        <li>
          WhatsApp:{" "}
          <a className={link} href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
            Chat with us
          </a>
        </li>
      )}
    </ul>
  );
}
