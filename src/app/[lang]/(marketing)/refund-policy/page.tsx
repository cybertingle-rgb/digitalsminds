import { LegalPageView, legalMetadata } from "@/components/content/LegalPageView";

export async function generateMetadata({ params }: PageProps<"/[lang]/refund-policy">) {
  return legalMetadata("refund", (await params).lang);
}

export default async function Page({ params }: PageProps<"/[lang]/refund-policy">) {
  return <LegalPageView page="refund" lang={(await params).lang} />;
}
