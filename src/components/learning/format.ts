import type { Dictionary } from "@/i18n/dictionaries/en";
import { format } from "@/i18n/merge";
import { formatDay } from "@/modules/batches/rules";

/** Card details for a program: format, duration and the next open batch (the fee is passed to the card separately). */
export function programMeta(
  c: { accessType: string; priceAmount: number | null; format: keyof Dictionary["courses"]["formats"]; durationText: string | null },
  nextBatch: Date | undefined,
  dict: Pick<Dictionary, "courses">,
) {
  const t = dict.courses;
  return [t.formats[c.format], c.durationText, nextBatch ? format(t.nextBatch, { date: formatDay(nextBatch) }) : t.noOpenBatch];
}
