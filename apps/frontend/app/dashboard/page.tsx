"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

interface Contact {
  id: string;
}
interface Audience {
  id: string;
}
interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "SENT";
  createdAt: string;
}

// The campaigns endpoint is paginated on the backend now, so it responds
// with { campaigns, total, page, totalPages } instead of a bare array.
interface CampaignsResponse {
  campaigns: Campaign[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_STYLES: Record<Campaign["status"], string> = {
  DRAFT: "bg-[#EFEAD9] text-[#7A7566]",
  SCHEDULED: "bg-[#DCE6F5] text-[#2A4E8A]",
  SENDING: "bg-[#F5E7C1] text-[#8A6A1E]",
  SENT: "bg-[#DCEEE0] text-[#2C6E43]",
};

export default function DashboardHome() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [audiences, setAudiences] = useState<Audience[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  // Total sent count across ALL campaigns, not just the campaigns on the
  // current page — comes straight from the paginated response metadata
  // rather than being derived by filtering the (partial) campaigns array.
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    api.get<Contact[]>("/api/contacts").then(setContacts).catch(() => setContacts([]));
    api.get<Audience[]>("/api/audiences").then(setAudiences).catch(() => setAudiences([]));
    api
      .get<CampaignsResponse>("/api/campaigns")
      .then((res) => {
        setCampaigns(res.campaigns);
        // NOTE: this only reflects SENT campaigns within the fetched page.
        // If you need an accurate total across all pages, expose a
        // dedicated count from the backend (e.g. res.sentCount) and swap
        // this line for that instead.
        setSentCount(res.campaigns.filter((c) => c.status === "SENT").length);
      })
      .catch(() => {
        setCampaigns([]);
        setSentCount(0);
      });
  }, []);

  const recent = campaigns?.slice(0, 5) ?? [];

  return (
    <div>
      <h1 className="font-[family-name:var(--font-logo)] text-xl italic text-[#14213D] sm:text-2xl">
        Overview
      </h1>
      <p className="mt-1 text-sm text-[#7A7566]">
        A quick look at what&apos;s happening in your workspace.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Contacts" value={contacts?.length} href="/dashboard/contacts" />
        <StatCard label="Audiences" value={audiences?.length} href="/dashboard/audiences" />
        <StatCard label="Campaigns sent" value={sentCount} href="/dashboard/campaigns" />
      </div>

      <div className="mt-8 sm:mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#3B3529]">Recent campaigns</h2>
          <Link
            href="/dashboard/campaigns"
            className="text-sm text-[#0F2044] underline decoration-[#C9A227] decoration-2 underline-offset-2"
          >
            View all
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E3DCC9] bg-white">
          {campaigns === null ? (
            <p className="px-5 py-6 text-sm text-[#7A7566]">Loading...</p>
          ) : recent.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#7A7566]">
              No campaigns yet.{" "}
              <Link href="/dashboard/campaigns" className="underline decoration-[#C9A227] decoration-2 underline-offset-2">
                Create your first one
              </Link>
              .
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E3DCC9] text-xs uppercase tracking-wide text-[#9A9384]">
                    <th className="px-4 py-3 font-medium sm:px-5">Name</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Subject</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((c) => (
                    <tr key={c.id} className="border-b border-[#EFEAD9] last:border-0 hover:bg-[#FBF8F2]">
                      <td className="px-4 py-3 sm:px-5">
                        <Link href={`/dashboard/campaigns/${c.id}`} className="font-medium text-[#14213D] hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[#7A7566] sm:px-5">{c.subject}</td>
                      <td className="px-4 py-3 sm:px-5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[c.status]}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | undefined;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-[#E3DCC9] bg-white px-4 py-4 transition hover:border-[#C9A227]/50 hover:shadow-sm sm:px-5"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[#9A9384]">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-logo)] text-2xl italic text-[#14213D] sm:text-3xl">
        {value ?? "–"}
      </p>
    </Link>
  );
}