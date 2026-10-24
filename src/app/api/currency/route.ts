import { NextResponse } from "next/server";
import { getDisplayRates, PROVIDERS } from "@/modules/currency/service";

export const dynamic = "force-dynamic";

/** Fresh display rates for the enabled currencies (PKR base). Public; contains no personal data. */
export async function GET() {
  const display = await getDisplayRates();
  const attribution = PROVIDERS[display.provider as keyof typeof PROVIDERS]?.attribution ?? null;
  return NextResponse.json({ ...display, attribution }, { headers: { "cache-control": "public, max-age=600, stale-while-revalidate=3600" } });
}
