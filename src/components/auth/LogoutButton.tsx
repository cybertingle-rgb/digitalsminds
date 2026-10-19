"use client";

import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

export function LogoutButton({ label, redirectTo, variant = "secondary" }: { label: string; redirectTo: string; variant?: "secondary" | "ghost" }) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={async () => {
        await authClient.signOut();
        window.location.assign(redirectTo);
      }}
    >
      {label}
    </Button>
  );
}
