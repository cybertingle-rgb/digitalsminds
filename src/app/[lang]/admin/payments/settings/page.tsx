import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/modules/auth/session";
import { getPaymentDetails } from "@/modules/payments/service";
import { PaymentDetailsForm } from "../PaymentForms";

export const metadata: Metadata = { title: "Payment details" };

export default async function PaymentSettingsPage() {
  await requirePagePermission("payments.manage", "/admin/payments/settings");
  const details = await getPaymentDetails();
  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/payments" className="text-sm text-muted hover:text-charcoal-900">← Payments</Link>
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Payment details</h1>
        <p className="mt-1 text-muted">Where students send course fees. Only the methods you fill in are offered.</p>
      </div>
      <PaymentDetailsForm value={details} />
    </div>
  );
}
