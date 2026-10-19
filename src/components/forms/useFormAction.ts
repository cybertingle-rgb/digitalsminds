"use client";

import { useActionState, useTransition, type FormEvent } from "react";

/**
 * Like `<form action={...}>` with useActionState, but without React's automatic
 * form reset after submission, so a validation error never wipes what the user typed.
 */
export function useFormAction<S>(action: (state: Awaited<S>, formData: FormData) => Promise<S>, initial: Awaited<S>) {
  const [state, dispatch, actionPending] = useActionState<S, FormData>(action, initial);
  const [transitionPending, startTransition] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return [state, onSubmit, actionPending || transitionPending] as const;
}
