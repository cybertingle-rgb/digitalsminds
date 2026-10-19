import { notFound } from "next/navigation";

/** Any unknown URL renders the localized 404 page. */
export default function CatchAll() {
  notFound();
}
