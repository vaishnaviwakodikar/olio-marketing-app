"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "../../../../lib/api";

interface Recipient {
  id: string;
  status: string;
  rawEmail: string | null;
  rawPhone: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  contact: { name: string | null; email: string | null; phone: string | null } | null;
}

interface CampaignDetail {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string | null;
  recipients: Recipient[];
  statusCounts: Record<string, number>;
}

const POLL_INTERVAL_MS = 5000;

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.get<CampaignDetail>(
          `/api/campaigns/${params.id}`
        );
        if (!cancelled) setCampaign(data);
      } catch {
        // keep showing last known state on a transient poll failure
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [params.id]);

  if (!campaign) {
    return <p className="text-sm text-slate-400">Loading...</p>;
  }

  const total = campaign.recipients.filter((r) => r.status !== "UNMATCHED").length;
  const sent =
    (campaign.statusCounts.SENT ?? 0) +
    (campaign.statusCounts.DELIVERED ?? 0) +
    (campaign.statusCounts.OPENED ?? 0);
  const delivered =
    (campaign.statusCounts.DELIVERED ?? 0) + (campaign.statusCounts.OPENED ?? 0);
  const opened = campaign.statusCounts.OPENED ?? 0;
  const unmatched = campaign.statusCounts.UNMATCHED ?? 0;

  return (
    <div>
      <Link
        href="/dashboard/campaigns"
        className="mb-4 inline-block text-xs text-slate-500 hover:underline"
      >
        ← Back to campaigns
      </Link>

      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{campaign.name}</h1>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {campaign.status}
        </span>
      </div>
      <p className="mb-6 text-sm text-slate-500">Subject: {campaign.subject}</p>

      <div className="mb-6 grid grid-cols-4 gap-3">
        <StatCard label="Total recipients" value={total} />
        <StatCard label="Sent" value={sent} />
        <StatCard label="Delivered" value={delivered} />
        <StatCard label="Opened" value={opened} />
      </div>

      <p className="mb-4 text-xs text-slate-400">
        Updating automatically every few seconds. Open tracking isn&apos;t
        exact — some mail clients block the tracking pixel.
      </p>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Recipient</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {campaign.recipients.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  {r.status === "UNMATCHED" ? (
                    <span className="text-amber-700">
                      {r.rawEmail || r.rawPhone} (no match found)
                    </span>
                  ) : (
                    <>
                      {r.contact?.name || "—"}{" "}
                      <span className="text-slate-400">
                        {r.contact?.email || r.contact?.phone}
                      </span>
                    </>
                  )}
                </td>
                <td className="px-4 py-2">
                  <StatusPill status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unmatched > 0 && (
        <p className="mt-3 text-xs text-amber-700">
          {unmatched} entr{unmatched !== 1 ? "ies" : "y"} in the pasted list
          could not be matched to a saved contact and were not sent to.
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-slate-100 text-slate-600",
    SENT: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-emerald-100 text-emerald-700",
    OPENED: "bg-purple-100 text-purple-700",
    FAILED: "bg-red-100 text-red-700",
    UNMATCHED: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}