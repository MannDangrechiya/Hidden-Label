import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ serial: string }>;
}

export default async function VerifySerialRedirect({ params }: PageProps) {
  const { serial } = await params;
  redirect(`/inspection/${encodeURIComponent(serial)}`);
}
