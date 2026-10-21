import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingCheck } from "@/components/portal/OnboardingCheck";
import { PortalHeading } from "@/components/portal/PortalParts";
import { LinkButton } from "@/components/ui/Button";
import { localizePath } from "@/i18n/config";
import { format } from "@/i18n/merge";
import { authPage, noindex } from "@/modules/auth/pages";
import { getCurrentUser } from "@/modules/auth/session";
import { RichText } from "@/modules/courses/richtext";
import { ACTIVE_STAGES, advanceStages, myEnrollments, onboardingFor } from "@/modules/portal/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Onboarding", robots: noindex };

export default async function OnboardingPage({ params }: PageProps<"/[lang]/account/onboarding">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(localizePath("/account/onboarding", locale))}`);
  const p = dict.portal;
  await advanceStages(user.id);
  const current = (await myEnrollments(user.id)).filter((e) => (ACTIVE_STAGES as readonly string[]).includes(e.effective));
  const lists = await Promise.all(current.map(async (e) => ({ e, o: await onboardingFor(e) })));

  return (
    <div className="space-y-8">
      <PortalHeading title={p.navOnboarding} intro={p.onboardingIntro} />
      {lists.length === 0 && (
        <section className="glass-subtle space-y-3 rounded-3xl p-6">
          <p className="text-charcoal-800">{p.noEnrollmentText}</p>
          <LinkButton href={localizePath("/courses", locale)}>{p.browsePrograms}</LinkButton>
        </section>
      )}
      {lists.map(({ e, o }) => (
        <section key={e.id} aria-labelledby={`ob-${e.id}`} className="glass rounded-3xl p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id={`ob-${e.id}`} className="text-xl font-bold text-charcoal-900" dir="auto">{e.course.title}{e.batch && <span className="font-normal text-muted"> · {e.batch.name}</span>}</h2>
            {o.requiredTotal > 0 && (
              <p className="text-sm font-semibold text-charcoal-900">{o.requiredDone >= o.requiredTotal ? p.onboardingDone : format(p.onboardingProgress, { done: String(o.requiredDone), total: String(o.requiredTotal) })}</p>
            )}
          </div>
          {o.items.length === 0 ? (
            <p className="mt-3 text-muted">{p.onboardingEmpty}</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {o.items.map((i, n) => (
                <li key={i.id} className={`rounded-2xl p-4 ${i.completedAt ? "bg-green-50/80" : "bg-white/60"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-charcoal-900" dir="auto">
                        <span className="text-muted">{n + 1}. </span>
                        {i.title}
                        {!i.required && <span className="ms-2 rounded-full bg-charcoal-100 px-2 py-0.5 text-xs font-semibold text-charcoal-700">{p.optional}</span>}
                      </p>
                      {i.description && <RichText text={i.description} className="mt-1 text-sm text-charcoal-800" />}
                    </div>
                    {i.studentCompletes ? (
                      <OnboardingCheck lang={locale} enrollmentId={e.id} itemId={i.id} done={!!i.completedAt} label={p.markDone} errorText={dict.auth.errors.generic} />
                    ) : (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${i.completedAt ? "bg-green-100 text-green-900" : "bg-charcoal-100 text-charcoal-700"}`}>{i.completedAt ? "✓ " : ""}{p.staffConfirms}</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
