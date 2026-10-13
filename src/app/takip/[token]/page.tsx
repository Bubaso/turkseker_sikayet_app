import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getComplaintByToken } from "@/server/complaints";
import { PublicShell } from "@/components/public-shell";
import { TrackingView } from "@/components/tracking-view";

export const metadata: Metadata = { title: "Şikâyet durumu" };
export const dynamic = "force-dynamic";

export default async function TrackDetailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = getComplaintByToken(token);
  if (!c) notFound();

  return (
    <PublicShell>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">Şikâyet durumu</h1>
        <Link href="/takip" className="btn btn-secondary btn-sm">Başka şikâyet sorgula</Link>
      </div>
      <TrackingView c={c} />
    </PublicShell>
  );
}
