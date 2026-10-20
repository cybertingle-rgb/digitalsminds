import { LegalPageView, legalMetadata } from "@/components/content/LegalPageView";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">) {
  return legalMetadata("privacy", (await params).lang);
}

export default async function Page({ params }: PageProps<"/[lang]/privacy">) {
  return <LegalPageView page="privacy" lang={(await params).lang} />;
}
