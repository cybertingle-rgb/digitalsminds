import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CourseProgressCard, RequestsList } from "@/components/learning/AccountSections";
import { LinkButton } from "@/components/ui/Button";
import { localizePath } from "@/i18n/config";
import { authPage, noindex } from "@/modules/auth/pages";
import { getCurrentUser } from "@/modules/auth/session";
import { myLearning } from "@/modules/learning/progress";
import { latestPaymentsFor } from "@/modules/payments/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My courses", robots: noindex };

export default async function MyCoursesPage({ params }: PageProps<"/[lang]/account/courses">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(localizePath("/account/courses", locale))}`);
  const t = dict.account;
  const learning = await myLearning(user.id);
  const enrolled = learning.filter((l) => l.enrollment.status === "APPROVED");
  const requests = learning.filter((l) => l.enrollment.status !== "APPROVED");
  const payments = requests.length ? await latestPaymentsFor(user.id) : new Map();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold text-charcoal-900">{t.myCourses}</h1>
        <LinkButton href={localizePath("/courses", locale)} variant="secondary">{t.browseCourses}</LinkButton>
      </div>
      {enrolled.length === 0 ? (
        <p className="glass-subtle rounded-2xl p-6 text-charcoal-900">{t.noCourses}</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {enrolled.map((item) => <CourseProgressCard key={item.enrollment.id} item={item} locale={locale} dict={dict} />)}
        </ul>
      )}
      <RequestsList requests={requests} payments={payments} locale={locale} dict={dict} />
    </div>
  );
}
