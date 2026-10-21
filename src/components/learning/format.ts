import type { Dictionary } from "@/i18n/dictionaries/en";
import { format } from "@/i18n/merge";
import { formatDay } from "@/modules/batches/rules";
import { coursePrice, formatPkr } from "@/modules/payments/format";

/** Card details for a program: fee, format, duration and the next open batch. */
export function programMeta(
  c: { accessType: string; priceAmount: number | null; format: keyof Dictionary["courses"]["formats"]; durationText: string | null },
  nextBatch: Date | undefined,
  dict: Pick<Dictionary, "courses">,
) {
  const t = dict.courses;
  const fee = coursePrice(c);
  return [fee ? formatPkr(fee) : null, t.formats[c.format], c.durationText, nextBatch ? format(t.nextBatch, { date: formatDay(nextBatch) }) : t.noOpenBatch];
}
