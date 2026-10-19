/** Human-readable descriptions for audit log actions shown in Admin → Activity. */
export const actionLabels: Record<string, string> = {
  "setup.super_admin_created": "Created the Super Admin account",
  "integration.smtp.saved": "Saved email (SMTP) settings",
  "integration.smtp.tested": "Sent a test email",
  "integration.google.saved": "Saved Google credentials",
  "integration.google.verified": "Verified Google sign-in",
  "integration.google.enabled": "Showed Google sign-in to students",
  "integration.google.disabled": "Hid Google sign-in from students",
  "integration.google.removed": "Disconnected Google",
  "team.invite": "Invited a team member",
  "team.invite_resent": "Re-sent a team invitation",
  "team.promote": "Gave a student account team access",
  "team.role_changed": "Changed a team member's role",
  "team.removed": "Removed a team member",
  "user.suspend": "Suspended an account",
  "user.reactivate": "Reactivated an account",
  "storage.checked": "Ran the file storage check",
  "inquiry.updated": "Updated an inquiry",
  "inquiry.note_added": "Added a note to an inquiry",
  "inquiry.deleted": "Deleted an inquiry",
  "export.inquiries": "Exported inquiries (CSV)",
  "settings.lead_alerts": "Changed lead alert emails",
  "media.upload": "Uploaded a file",
  "media.replace": "Replaced a file",
  "media.delete": "Deleted a file",
};

export function describeAction(action: string): string {
  return actionLabels[action] ?? action;
}
