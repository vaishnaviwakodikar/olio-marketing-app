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
    return (
      <div className="flex items-center gap-2 text-sm text-[#0F2044]/40">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C9A227]" />
        Loading campaign...
      </div>
    );
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
        className="mb-5 inline-flex items-center gap-1 text-xs font-medium text-[#0F2044]/55 transition-colors hover:text-[#C9A227]"
      >
        ← Back to campaigns
      </Link>

      {/* Header */}
      <div className="mb-8 border-b border-[#0F2044]/10 pb-6">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C9A227]">
          Campaign analytics
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-[28px] font-medium leading-tight text-[#0F2044]">
            {campaign.name}
          </h1>
          <span className="rounded-full bg-[#0F2044]/10 px-2.5 py-0.5 text-xs font-medium text-[#0F2044]/70">
            {campaign.status}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-[#0F2044]/55">
          Subject: {campaign.subject}
        </p>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatCard label="Total recipients" value={total} />
        <StatCard label="Sent" value={sent} />
        <StatCard label="Delivered" value={delivered} accent />
        <StatCard label="Opened" value={opened} accent />
      </div>

      <p className="mb-5 flex items-center gap-1.5 text-xs text-[#0F2044]/40">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Updating automatically every few seconds. Open tracking isn&apos;t
        exact — some mail clients block the tracking pixel.
      </p>

      {/* Recipients table */}
      <div className="overflow-hidden rounded-xl border border-[#0F2044]/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#0F2044]/10 bg-[#FBF8F2]">
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F2044]/50">
                Recipient
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F2044]/50">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {campaign.recipients.map((r) => (
              <tr
                key={r.id}
                className="border-b border-[#0F2044]/8 transition-colors last:border-0 hover:bg-[#FBF8F2]/60"
              >
                <td className="px-5 py-3.5">
                  {r.status === "UNMATCHED" ? (
                    <span className="text-[#8a6d15]">
                      {r.rawEmail || r.rawPhone}{" "}
                      <span className="text-[#0F2044]/40">(no match found)</span>
                    </span>
                  ) : (
                    <>
                      <span className="font-medium text-[#0F2044]">
                        {r.contact?.name || "—"}
                      </span>{" "}
                      <span className="text-[#0F2044]/45">
                        {r.contact?.email || r.contact?.phone}
                      </span>
                    </>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <StatusPill status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unmatched > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[#8a6d15]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C9A227]" />
          {unmatched} entr{unmatched !== 1 ? "ies" : "y"} in the pasted list
          could not be matched to a saved contact and were not sent to.
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#0F2044]/10 bg-white p-4 shadow-sm">
      <p
        className={`font-serif text-3xl font-medium ${
          accent ? "text-[#0F2044]" : "text-[#0F2044]"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-[#0F2044]/50">{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const dot: Record<string, string> = {
    PENDING: "bg-[#0F2044]/40",
    SENT: "bg-blue-500",
    DELIVERED: "bg-emerald-500",
    OPENED: "bg-purple-500",
    FAILED: "bg-red-500",
    UNMATCHED: "bg-[#C9A227]",
  };
  const text: Record<string, string> = {
    PENDING: "text-[#0F2044]/60",
    SENT: "text-blue-700",
    DELIVERED: "text-emerald-700",
    OPENED: "text-purple-700",
    FAILED: "text-red-700",
    UNMATCHED: "text-[#8a6d15]",
  };
  const label: Record<string, string> = {
    PENDING: "Pending",
    SENT: "Sent",
    DELIVERED: "Delivered",
    OPENED: "Opened",
    FAILED: "Failed",
    UNMATCHED: "Unmatched",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        text[status] ?? "text-[#0F2044]/60"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status] ?? "bg-[#0F2044]/40"}`} />
      {label[status] ?? status}
    </span>
  );
}