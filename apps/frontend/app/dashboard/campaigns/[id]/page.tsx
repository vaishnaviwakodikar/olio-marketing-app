"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../../lib/api";

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
  createdAt: string;
  recipientSource: "AUDIENCE" | "PASTED_LIST";
  audienceId: string | null;
  recipients: Recipient[];
  statusCounts: Record<string, number>;
  attachmentFilename: string | null;
}

interface Audience {
  id: string;
  name: string;
  memberCount: number;
}

const POLL_INTERVAL_MS = 5000;

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);

  // Edit & Send form state
  const [editing, setEditing] = useState(false);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [source, setSource] = useState<"AUDIENCE" | "PASTED_LIST">("AUDIENCE");
  const [audienceId, setAudienceId] = useState("");
  const [pastedList, setPastedList] = useState("");
  const [sendMode, setSendMode] = useState<"now" | "later">("now");
  const [sendAt, setSendAt] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.get<CampaignDetail>(
          `/api/campaigns/${params.id}`
        );
        if (!cancelled) setCampaign(data);
      } catch {
      }
    }

    load();
    const interval = setInterval(() => {
      if (!editing) load();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    
  }, [params.id, editing]);

  function openEditForm() {
    if (!campaign) return;
    setName(campaign.name);
    setSubject(campaign.subject);
    setBody(campaign.body);
    setSource(campaign.recipientSource);
    setAudienceId(campaign.audienceId ?? "");
    setPastedList("");
    setSendMode("now");
    setSendAt("");
    setAttachment(null);
    setFormError(null);
    setEditing(true);

    if (audiences.length === 0) {
      api
        .get<Audience[]>("/api/audiences")
        .then((a) => {
          setAudiences(a);
          if (a.length > 0 && !campaign.audienceId) setAudienceId(a[0].id);
        })
        .catch(() => {});
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!campaign) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("subject", subject);
      formData.set("body", body);
      formData.set("recipientSource", source);
      if (source === "AUDIENCE") {
        formData.set("audienceId", audienceId);
      } else {
        formData.set("pastedList", pastedList);
      }
      if (sendMode === "later" && sendAt) {
        formData.set("sendAt", new Date(sendAt).toISOString());
      }
      if (attachment) {
        formData.set("attachment", attachment);
      }

      await api.put<CampaignDetail>(`/api/campaigns/${campaign.id}`, formData);
      const refreshed = await api.get<CampaignDetail>(
        `/api/campaigns/${campaign.id}`
      );
      setCampaign(refreshed);
      setEditing(false);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Could not send campaign"
      );
    } finally {
      setSubmitting(false);
    }
  }

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
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
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#0F2044]/45">
              <span>
                Created{" "}
                {new Date(campaign.createdAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {campaign.scheduledAt && (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#C9A227]" />
                  Scheduled for{" "}
                  {new Date(campaign.scheduledAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>

          {campaign.status === "DRAFT" && !editing && (
            <button
              type="button"
              onClick={openEditForm}
              className="whitespace-nowrap rounded-md bg-[#0F2044] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0a1730]"
            >
              Edit & send
            </button>
          )}
        </div>
      </div>

      {/* Message content - visible for all campaigns, including already-sent ones */}
      {!editing && (
        <div className="mb-6 rounded-xl border border-[#0F2044]/10 bg-white p-4 shadow-sm sm:p-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0F2044]/45">
            Message content
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-[#0F2044]/50">Campaign name</p>
              <p className="mt-0.5 text-sm text-[#0F2044]">{campaign.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#0F2044]/50">Subject line</p>
              <p className="mt-0.5 text-sm text-[#0F2044]">{campaign.subject}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-[#0F2044]/50">Email body</p>
            <p className="mt-1.5 whitespace-pre-wrap rounded-md border border-[#0F2044]/10 bg-[#FBF8F2] px-3 py-2.5 text-sm text-[#0F2044]">
              {campaign.body}
            </p>
          </div>
          {campaign.attachmentFilename && (
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/campaigns/${campaign.id}/attachment`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#0F2044]/60 underline decoration-[#0F2044]/20 underline-offset-2 transition-colors hover:text-[#C9A227] hover:decoration-[#C9A227]"
            >
              📎 {campaign.attachmentFilename} — view attachment
            </a>
          )}
        </div>
      )}

      {/* Edit & send form */}
      {editing && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 space-y-6 rounded-xl border border-[#0F2044]/10 bg-white p-4 shadow-sm sm:p-6"
        >
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0F2044]/45">
              Message
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#0F2044]/70">
                  Campaign name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] px-3 py-2 text-sm text-[#0F2044] placeholder:text-[#0F2044]/30 transition-shadow focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#0F2044]/70">
                  Subject line
                </label>
                <input
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] px-3 py-2 text-sm text-[#0F2044] placeholder:text-[#0F2044]/30 transition-shadow focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-[#0F2044]/70">
                Email body
              </label>
              <textarea
                required
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] px-3 py-2 text-sm text-[#0F2044] placeholder:text-[#0F2044]/30 transition-shadow focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30"
              />
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-[#0F2044]/70">
                Attach a PDF{" "}
                <span className="font-normal text-[#0F2044]/40">
                  (optional — replaces existing attachment if set)
                </span>
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-[#0F2044]/70 file:mr-3 file:rounded-md file:border file:border-[#0F2044]/15 file:bg-[#FBF8F2] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#0F2044] file:transition-colors hover:file:bg-[#0F2044]/5"
              />
              {attachment && (
                <p className="mt-1.5 text-xs text-[#0F2044]/45">
                  {attachment.name} ({Math.round(attachment.size / 1024)} KB)
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-[#0F2044]/10 pt-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0F2044]/45">
              Recipients
            </p>
            <div className="mb-3 inline-flex w-full rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] p-0.5 sm:w-auto">
              <button
                type="button"
                onClick={() => setSource("AUDIENCE")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none ${
                  source === "AUDIENCE"
                    ? "bg-[#0F2044] text-white shadow-sm"
                    : "text-[#0F2044]/60 hover:text-[#0F2044]"
                }`}
              >
                Pick an audience
              </button>
              <button
                type="button"
                onClick={() => setSource("PASTED_LIST")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none ${
                  source === "PASTED_LIST"
                    ? "bg-[#0F2044] text-white shadow-sm"
                    : "text-[#0F2044]/60 hover:text-[#0F2044]"
                }`}
              >
                Paste emails/phones
              </button>
            </div>

            {source === "AUDIENCE" ? (
              audiences.length === 0 ? (
                <p className="text-xs text-[#0F2044]/40">
                  No audiences yet — create one on the Audiences page first.
                </p>
              ) : (
                <select
                  value={audienceId}
                  onChange={(e) => setAudienceId(e.target.value)}
                  className="w-full rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] px-3 py-2 text-sm text-[#0F2044] focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30"
                >
                  {audiences.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.memberCount} members)
                    </option>
                  ))}
                </select>
              )
            ) : (
              <textarea
                rows={3}
                placeholder="Paste emails or phone numbers, separated by commas or new lines"
                value={pastedList}
                onChange={(e) => setPastedList(e.target.value)}
                className="w-full rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] px-3 py-2 text-sm text-[#0F2044] placeholder:text-[#0F2044]/30 focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30"
              />
            )}
          </div>

          <div className="border-t border-[#0F2044]/10 pt-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0F2044]/45">
              When to send
            </p>
            <div className="flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#0F2044]">
                <input
                  type="radio"
                  checked={sendMode === "now"}
                  onChange={() => setSendMode("now")}
                  className="h-3.5 w-3.5 accent-[#C9A227]"
                />
                Send now
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#0F2044]">
                <input
                  type="radio"
                  checked={sendMode === "later"}
                  onChange={() => setSendMode("later")}
                  className="h-3.5 w-3.5 accent-[#C9A227]"
                />
                Schedule for later
              </label>
              {sendMode === "later" && (
                <input
                  type="datetime-local"
                  value={sendAt}
                  onChange={(e) => setSendAt(e.target.value)}
                  className="rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] px-3 py-1.5 text-sm text-[#0F2044] focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30"
                />
              )}
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 border-t border-[#0F2044]/10 pt-6 sm:flex-row sm:items-center sm:gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-[#0F2044] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0a1730] disabled:opacity-50 sm:w-auto"
            >
              {submitting
                ? "Sending..."
                : sendMode === "now"
                ? "Send campaign"
                : "Schedule campaign"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={submitting}
              className="text-sm font-medium text-[#0F2044]/50 hover:text-[#0F2044]"
            >
              Cancel
            </button>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>
        </form>
      )}

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