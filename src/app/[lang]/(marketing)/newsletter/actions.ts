"use server";

import { confirmSubscription, unsubscribe } from "@/modules/newsletter/service";

export async function confirmAction(token: string): Promise<boolean> {
  return confirmSubscription(String(token).slice(0, 100));
}

export async function unsubscribeAction(token: string): Promise<boolean> {
  return unsubscribe(String(token).slice(0, 100));
}
