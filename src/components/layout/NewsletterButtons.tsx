"use client";

import { useState, useTransition } from "react";
import { FormAlert } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { confirmAction, unsubscribeAction } from "@/app/[lang]/(marketing)/newsletter/actions";

/** A button (not a bare link) so email scanners that open links can't confirm or unsubscribe on someone's behalf. */
export function NewsletterButton(props: { kind: "confirm" | "unsubscribe"; token: string; label: string; done: string; failed: string }) {
  const [result, setResult] = useState<boolean | null>(null);
  const [pending, start] = useTransition();
  if (result !== null) return <FormAlert tone={result ? "success" : "error"}>{result ? props.done : props.failed}</FormAlert>;
  return (
    <Button
      type="button"
      variant={props.kind === "confirm" ? "primary" : "dark"}
      className="w-full"
      disabled={pending}
      onClick={() => start(async () => setResult(await (props.kind === "confirm" ? confirmAction : unsubscribeAction)(props.token)))}
    >
      {props.label}
    </Button>
  );
}
