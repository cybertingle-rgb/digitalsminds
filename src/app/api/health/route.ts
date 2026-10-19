import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database readiness probe for uptime monitors and hosts. */
export async function GET() {
  try {
    await db().$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch (err) {
    console.error("[health] database check failed", err);
    return NextResponse.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
