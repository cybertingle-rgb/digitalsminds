import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/modules/auth/session";
import { coordinatorOptions } from "@/modules/batches/service";
import { db } from "@/lib/db";
import { BatchForm } from "../BatchForm";
import { emptyBatch } from "../batch-value";

export const metadata: Metadata = { title: "New batch" };

export default async function NewBatchPage({ searchParams }: PageProps<"/[lang]/admin/batches/new">) {
  await requirePagePermission("batches.manage", "/admin/batches/new");
  const sp = await searchParams;
  const [programs, coordinators] = await Promise.all([
    db().course.findMany({ where: { status: { in: ["PUBLISHED", "DRAFT"] } }, orderBy: { title: "asc" }, select: { id: true, title: true, accessType: true, priceAmount: true } }),
    coordinatorOptions(),
  ]);
  const course = typeof sp.course === "string" ? sp.course : "";
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/batches" className="text-sm text-muted hover:text-charcoal-900">← Batches</Link>
        <h1 className="mt-2 text-2xl font-bold text-charcoal-900">New batch</h1>
      </div>
      <section className="glass rounded-2xl p-6">
        {programs.length === 0 ? (
          <p className="text-muted">Create a program first.</p>
        ) : (
          <BatchForm
            programs={programs.map((p) => ({ id: p.id, title: p.title, paid: p.accessType === "PAID" && !!p.priceAmount }))}
            coordinators={coordinators}
            value={{ ...emptyBatch, courseId: programs.some((p) => p.id === course) ? course : "" }}
          />
        )}
      </section>
    </div>
  );
}
