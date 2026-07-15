"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";

interface Campaign {
  id: string;
  name: string;
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "SENT";
  scheduledAt: string | null;
  createdAt: string;
}

interface Audience {
  id: string;
  name: string;
  memberCount: number;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [source, setSource] = useState<"AUDIENCE" | "PASTED_LIST">("AUDIENCE");
  const [audienceId, setAudienceId] = useState("");
  const [pastedList, setPastedList] = useState("");
  const [sendMode, setSendMode] = useState<"now" | "later">("now");
  const [sendAt, setSendAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    matchedCount: number;
    unmatchedCount: number;
  } | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [c, a] = await Promise.all([
        api.get<Campaign[]>("/api/campaigns"),
        api.get<Audience[]>("/api/audiences"),
      ]);
      setCampaigns(c);
      setAudiences(a);
      if (a.length > 0 && !audienceId) setAudienceId(a[0].id);
    } catch {
      // could surface a toast in a fuller build
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLastResult(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        subject,
        body,
        recipientSource: source,
      };
      if (source === "AUDIENCE") {
        payload.audienceId = audienceId;
      } else {
        payload.pastedList = pastedList;
      }
      if (sendMode === "later" && sendAt) {
        payload.sendAt = new Date(sendAt).toISOString();
      }

      const result = await api.post<{
        matchedCount: number;
        unmatchedCount: number;
      }>("/api/campaigns", payload);

      setLastResult({
        matchedCount: result.matchedCount,
        unmatchedCount: result.unmatchedCount,
      });
      setName("");
      setSubject("");
      setBody("");
      setPastedList("");
      setSendAt("");
      await loadAll();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Could not create campaign"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function statusBadge(status: Campaign["status"]) {
    const styles: Record<Campaign["status"], string> = {
      DRAFT: "bg-slate-100 text-slate-600",
      SCHEDULED: "bg-amber-100 text-amber-700",
      SENDING: "bg-blue-100 text-blue-700",
      SENT: "bg-emerald-100 text-emerald-700",
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
        {status}
      </span>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Campaigns</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and send email campaigns to your contacts.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          New campaign
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 space-y-4 rounded-md border border-slate-200 bg-white p-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Campaign name
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Subject line
              </label>
              <input
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Email body
            </label>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Recipients</p>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setSource("AUDIENCE")}
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  source === "AUDIENCE"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-600"
                }`}
              >
                Pick an audience
              </button>
              <button
                type="button"
                onClick={() => setSource("PASTED_LIST")}
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  source === "PASTED_LIST"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-600"
                }`}
              >
                Paste emails/phones
              </button>
            </div>

            {source === "AUDIENCE" ? (
              audiences.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No audiences yet — create one on the Audiences page first.
                </p>
              ) : (
                <select
                  value={audienceId}
                  onChange={(e) => setAudienceId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">When to send</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="radio"
                  checked={sendMode === "now"}
                  onChange={() => setSendMode("now")}
                />
                Send now
              </label>
              <label className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="radio"
                  checked={sendMode === "later"}
                  onChange={() => setSendMode("later")}
                />
                Schedule for later
              </label>
              {sendMode === "later" && (
                <input
                  type="datetime-local"
                  required
                  value={sendAt}
                  onChange={(e) => setSendAt(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting
                ? "Creating..."
                : sendMode === "now"
                ? "Send campaign"
                : "Schedule campaign"}
            </button>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>

          {lastResult && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Campaign created: {lastResult.matchedCount} matched recipient
              {lastResult.matchedCount !== 1 ? "s" : ""}
              {lastResult.unmatchedCount > 0
                ? `, ${lastResult.unmatchedCount} could not be matched`
                : ""}
              .
            </p>
          )}
        </form>
      )}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Scheduled</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && campaigns.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No campaigns yet.
                </td>
              </tr>
            )}
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2">{statusBadge(c.status)}</td>
                <td className="px-4 py-2 text-slate-500">
                  {c.scheduledAt
                    ? new Date(c.scheduledAt).toLocaleString()
                    : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/dashboard/campaigns/${c.id}`}
                    className="text-xs font-medium text-slate-600 hover:underline"
                  >
                    View analytics
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}