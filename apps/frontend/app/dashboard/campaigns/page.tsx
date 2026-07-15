"use client";

import { useEffect, useRef, useState } from "react";
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

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

// value format matches datetime-local: "YYYY-MM-DDTHH:mm"
function toLocalValue(date: Date, hour: number, minute: number) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(hour)}:${pad(minute)}`;
}

function formatDisplay(value: string) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const dateStr = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateStr} · ${timeStr}`;
}

function ScheduleDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = value ? new Date(value) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [hour, setHour] = useState(() => (value ? new Date(value).getHours() : 9));
  const [minute, setMinute] = useState(() =>
    value ? new Date(value).getMinutes() : 0
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectedDate = value ? new Date(value) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstOfMonth = viewMonth;
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(
    firstOfMonth.getFullYear(),
    firstOfMonth.getMonth() + 1,
    0
  ).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function pickDay(day: number) {
    const date = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), day);
    onChange(toLocalValue(date, hour, minute));
  }

  function updateTime(h: number, m: number) {
    setHour(h);
    setMinute(m);
    const base = selectedDate ?? new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 1);
    onChange(toLocalValue(base, h, m));
  }

  function changeMonth(delta: number) {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));
  }

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] px-3 py-1.5 text-left text-sm text-[#0F2044] transition-shadow focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 sm:min-w-[190px] sm:w-auto"
      >
        <span className={value ? "" : "text-[#0F2044]/35"}>
          {value ? formatDisplay(value) : "Pick date & time"}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className="flex-shrink-0 text-[#0F2044]/50"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-x-4 top-1/2 z-30 w-auto -translate-y-1/2 rounded-xl border border-[#0F2044]/10 bg-white p-4 shadow-lg sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+8px)] sm:w-[300px] sm:translate-y-0">
          {/* Month nav */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#0F2044]/50 transition-colors hover:bg-[#0F2044]/5 hover:text-[#0F2044]"
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="font-serif text-sm font-medium text-[#0F2044]">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#0F2044]/50 transition-colors hover:bg-[#0F2044]/5 hover:text-[#0F2044]"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          {/* Weekday labels */}
          <div className="mb-1 grid grid-cols-7 gap-y-1">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="text-center text-[10px] font-semibold uppercase tracking-wide text-[#0F2044]/35"
              >
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const cellDate = new Date(
                firstOfMonth.getFullYear(),
                firstOfMonth.getMonth(),
                day
              );
              const isPast = cellDate < today;
              const isSelected =
                selectedDate &&
                selectedDate.getFullYear() === cellDate.getFullYear() &&
                selectedDate.getMonth() === cellDate.getMonth() &&
                selectedDate.getDate() === cellDate.getDate();
              const isToday = cellDate.getTime() === today.getTime();

              return (
                <div key={day} className="flex justify-center">
                  <button
                    type="button"
                    disabled={isPast}
                    onClick={() => pickDay(day)}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors ${
                      isSelected
                        ? "bg-[#0F2044] font-semibold text-white"
                        : isPast
                        ? "cursor-not-allowed text-[#0F2044]/20"
                        : isToday
                        ? "font-semibold text-[#C9A227] hover:bg-[#C9A227]/15"
                        : "text-[#0F2044]/80 hover:bg-[#0F2044]/8"
                    }`}
                  >
                    {day}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Time picker */}
          <div className="mt-4 flex items-center gap-2 border-t border-[#0F2044]/10 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#0F2044]/45">
              Time
            </span>
            <select
              value={hour}
              onChange={(e) => updateTime(Number(e.target.value), minute)}
              className="ml-auto rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] px-2 py-1 text-xs text-[#0F2044] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {pad(h)}
                </option>
              ))}
            </select>
            <span className="text-xs text-[#0F2044]/40">:</span>
            <select
              value={minute}
              onChange={(e) => updateTime(hour, Number(e.target.value))}
              className="rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] px-2 py-1 text-xs text-[#0F2044] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  {pad(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md bg-[#0F2044] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0a1730]"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-black/30 sm:hidden"
          aria-hidden="true"
        />
      )}
    </div>
  );
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
    const dot: Record<Campaign["status"], string> = {
      DRAFT: "bg-[#0F2044]/40",
      SCHEDULED: "bg-[#C9A227]",
      SENDING: "bg-blue-500",
      SENT: "bg-emerald-500",
    };
    const text: Record<Campaign["status"], string> = {
      DRAFT: "text-[#0F2044]/60",
      SCHEDULED: "text-[#8a6d15]",
      SENDING: "text-blue-700",
      SENT: "text-emerald-700",
    };
    const label: Record<Campaign["status"], string> = {
      DRAFT: "Draft",
      SCHEDULED: "Scheduled",
      SENDING: "Sending",
      SENT: "Sent",
    };
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text[status]}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dot[status]}`} />
        {label[status]}
      </span>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 border-b border-[#0F2044]/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C9A227]">
            Outreach
          </p>
          <h1 className="font-serif text-2xl font-medium leading-tight text-[#0F2044] sm:text-[28px]">
            Campaigns
          </h1>
          <p className="mt-1.5 text-sm text-[#0F2044]/55">
            Create and send email campaigns to your contacts.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full rounded-md bg-[#0F2044] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0a1730] sm:w-auto"
        >
          {showForm ? "Close" : "New campaign"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
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
                  placeholder="e.g. July product update"
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
                  placeholder="What shows up in their inbox"
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
                placeholder="Write your message..."
                className="w-full rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] px-3 py-2 text-sm text-[#0F2044] placeholder:text-[#0F2044]/30 transition-shadow focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30"
              />
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
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
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
              </div>
              {sendMode === "later" && (
                <ScheduleDatePicker value={sendAt} onChange={setSendAt} />
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
                ? "Creating..."
                : sendMode === "now"
                ? "Send campaign"
                : "Schedule campaign"}
            </button>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>

          {lastResult && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
              Campaign created — {lastResult.matchedCount} matched recipient
              {lastResult.matchedCount !== 1 ? "s" : ""}
              {lastResult.unmatchedCount > 0
                ? `, ${lastResult.unmatchedCount} could not be matched`
                : ""}
              .
            </div>
          )}
        </form>
      )}

      {/* Campaign list */}
      <div className="overflow-hidden rounded-xl border border-[#0F2044]/10 bg-white shadow-sm">
        {/* Mobile: stacked cards, no horizontal scroll */}
        <div className="divide-y divide-[#0F2044]/8 sm:hidden">
          {loading && (
            <div className="px-4 py-10 text-center text-sm text-[#0F2044]/40">
              Loading campaigns...
            </div>
          )}
          {!loading && campaigns.length === 0 && (
            <div className="px-5 py-14 text-center">
              <p className="text-sm font-medium text-[#0F2044]/60">
                No campaigns yet
              </p>
              <p className="mt-1 text-xs text-[#0F2044]/40">
                Create your first campaign to reach your contacts.
              </p>
            </div>
          )}
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/campaigns/${c.id}`}
              className="block px-4 py-3.5 transition-colors active:bg-[#FBF8F2]/60"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-[#0F2044]">{c.name}</p>
                {statusBadge(c.status)}
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-xs text-[#0F2044]/55">
                  {c.scheduledAt
                    ? new Date(c.scheduledAt).toLocaleString()
                    : "Not scheduled"}
                </p>
                <span className="text-xs font-medium text-[#0F2044]/40">
                  View analytics →
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Desktop/tablet: table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#0F2044]/10 bg-[#FBF8F2]">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F2044]/50 sm:px-5">
                  Name
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F2044]/50 sm:px-5">
                  Status
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F2044]/50 sm:px-5">
                  Scheduled
                </th>
                <th className="px-4 py-3 sm:px-5"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-[#0F2044]/40">
                    Loading campaigns...
                  </td>
                </tr>
              )}
              {!loading && campaigns.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-14 text-center">
                    <p className="text-sm font-medium text-[#0F2044]/60">
                      No campaigns yet
                    </p>
                    <p className="mt-1 text-xs text-[#0F2044]/40">
                      Create your first campaign to reach your contacts.
                    </p>
                  </td>
                </tr>
              )}
              {campaigns.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[#0F2044]/8 transition-colors last:border-0 hover:bg-[#FBF8F2]/60"
                >
                  <td className="px-4 py-3.5 font-medium text-[#0F2044] sm:px-5">{c.name}</td>
                  <td className="px-4 py-3.5 sm:px-5">{statusBadge(c.status)}</td>
                  <td className="px-4 py-3.5 text-[#0F2044]/55 sm:px-5">
                    {c.scheduledAt
                      ? new Date(c.scheduledAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-right sm:px-5">
                    <Link
                      href={`/dashboard/campaigns/${c.id}`}
                      className="text-xs font-medium text-[#0F2044] transition-colors hover:text-[#C9A227]"
                    >
                      View analytics →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}