"use client";

import { useState, useTransition } from "react";
import { Notice, StatusBadge } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { changeRoleAction, removeAction, resendInviteAction, setSuspendedAction, type TeamState } from "./actions";

export type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  status: "ACTIVE" | "SUSPENDED";
  invitePending: boolean;
  isOwner: boolean;
  isYou: boolean;
  lastActive: string | null;
};

type Confirm = { id: string; kind: "suspend" | "remove" | "super" } | null;

export function TeamTable({ members }: { members: Member[] }) {
  const [result, setResult] = useState<TeamState | null>(null);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reason, setReason] = useState("");

  const run = (fn: () => Promise<TeamState>) =>
    start(async () => {
      setResult(await fn());
      setConfirm(null);
      setReason("");
    });

  return (
    <section aria-labelledby="team-title" className="glass rounded-2xl p-6">
      <h2 id="team-title" className="text-lg font-semibold text-charcoal-900">Team ({members.length})</h2>
      {result?.message && <div className="mt-4"><Notice tone={result.status === "error" ? "error" : "success"}>{result.message}</Notice></div>}
      <ul className="mt-4 divide-y divide-line">
        {members.map((m) => {
          const locked = m.isOwner || m.isYou;
          return (
            <li key={m.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-charcoal-900">
                    {m.name} {m.isYou && <span className="text-sm font-normal text-muted">(you)</span>}
                  </p>
                  <p className="truncate text-sm text-muted" dir="ltr">{m.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge tone="off">{m.roleLabel}</StatusBadge>
                    {m.isOwner && <StatusBadge tone="ok">Owner</StatusBadge>}
                    {m.status === "SUSPENDED" && <StatusBadge tone="warn">Suspended</StatusBadge>}
                    {m.invitePending && <StatusBadge tone="warn">Invitation pending</StatusBadge>}
                  </div>
                  <p className="mt-1 text-xs text-muted">{m.lastActive ? `Last active ${m.lastActive}` : "Not signed in yet"}</p>
                </div>
                {!locked && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`role-${m.id}`}>Role for {m.name}</label>
                    <select
                      id={`role-${m.id}`}
                      className={`${inputClass} mt-0 w-auto py-2`}
                      value={m.role}
                      disabled={pending}
                      onChange={(e) => {
                        const role = e.target.value;
                        if (role === "SUPER_ADMIN") setConfirm({ id: m.id, kind: "super" });
                        else run(() => changeRoleAction(m.id, role));
                      }}
                    >
                      <option value="CONTENT_MANAGER">Content Manager</option>
                      <option value="INSTRUCTOR">Instructor</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                    {m.invitePending && (
                      <Button type="button" variant="secondary" className="py-2" disabled={pending} onClick={() => run(() => resendInviteAction(m.id))}>
                        Resend invite
                      </Button>
                    )}
                    {m.status === "SUSPENDED" ? (
                      <Button type="button" variant="secondary" className="py-2" disabled={pending} onClick={() => run(() => setSuspendedAction(m.id, false))}>
                        Reactivate
                      </Button>
                    ) : (
                      <Button type="button" variant="secondary" className="py-2" disabled={pending} onClick={() => setConfirm({ id: m.id, kind: "suspend" })}>
                        Suspend
                      </Button>
                    )}
                    <Button type="button" variant="ghost" className="py-2 text-red-700" disabled={pending} onClick={() => setConfirm({ id: m.id, kind: "remove" })}>
                      Remove
                    </Button>
                  </div>
                )}
              </div>
              {confirm?.id === m.id && (
                <div role="alertdialog" aria-label="Confirm" className="mt-3 rounded-xl border border-sun-400 bg-sun-50 p-4 text-sm">
                  {confirm.kind === "suspend" && (
                    <>
                      <p className="font-semibold text-charcoal-900">Suspend {m.name}? They will be signed out everywhere and can&apos;t log in until reactivated.</p>
                      <label htmlFor={`reason-${m.id}`} className="mt-3 block text-charcoal-900">Reason (optional, internal)</label>
                      <input id={`reason-${m.id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={inputClass} />
                    </>
                  )}
                  {confirm.kind === "remove" && (
                    <p className="font-semibold text-charcoal-900">Remove {m.name} from the team? They lose admin access and are signed out, but keep a normal student account.</p>
                  )}
                  {confirm.kind === "super" && (
                    <p className="font-semibold text-charcoal-900">Make {m.name} a Super Admin? They will have full control, including team, integrations and student data exports.</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="dark"
                      className="py-2"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          confirm.kind === "suspend"
                            ? setSuspendedAction(m.id, true, reason || undefined)
                            : confirm.kind === "remove"
                              ? removeAction(m.id)
                              : changeRoleAction(m.id, "SUPER_ADMIN"),
                        )
                      }
                    >
                      Confirm
                    </Button>
                    <Button type="button" variant="secondary" className="py-2" onClick={() => setConfirm(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
