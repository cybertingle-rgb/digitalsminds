import { LegalPageView, legalMetadata } from "@/components/content/LegalPageView";

export async function generateMetadata({ params }: PageProps<"/[lang]/terms">) {
  return legalMetadata("terms", (await params).lang);
}

export default async function Page({ params }: PageProps<"/[lang]/terms">) {
  return <LegalPageView page="terms" lang={(await params).lang} />;
}
