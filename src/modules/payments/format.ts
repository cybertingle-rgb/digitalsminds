/** Fee helpers that are safe anywhere (no database). Amounts are in paisa (PKR minor units). */

/** "Rs 15,000" (whole rupees; paisa shown only when present). */
export function formatPkr(paisa: number) {
  const rupees = paisa / 100;
  return `Rs ${rupees.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** The program's enrollment fee in paisa, or null when none is set. */
export function coursePrice(course: { accessType: string; priceAmount: number | null }): number | null {
  return course.accessType === "PAID" && course.priceAmount && course.priceAmount > 0 ? course.priceAmount : null;
}
