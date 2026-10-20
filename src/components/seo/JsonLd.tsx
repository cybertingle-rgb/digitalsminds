import { serialiseJsonLd, type Thing } from "@/modules/seo/structured-data";

/** Structured data for search engines (schema.org JSON-LD). */
export function JsonLd({ data }: { data: Thing | Thing[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiseJsonLd(d) }} />
      ))}
    </>
  );
}
