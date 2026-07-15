"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";

interface FieldCondition {
  field: string;
  equals: string;
}

interface Audience {
  id: string;
  name: string;
  filter: { fields?: FieldCondition[]; tag?: string };
  memberCount: number;
}

interface AudienceDetail extends Audience {
  members: { id: string; name: string | null; email: string | null }[];
}

export default function AudiencesPage() {
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<FieldCondition[]>([
    { field: "", equals: "" },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<AudienceDetail | null>(
    null
  );

  // delete confirm modal state
  const [deleteTarget, setDeleteTarget] = useState<Audience | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadAudiences() {
    setLoading(true);
    try {
      setAudiences(await api.get<Audience[]>("/api/audiences"));
    } catch {
      // could surface a toast in a fuller build
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAudiences();
  }, []);

  useEffect(() => {
    if (!deleteTarget) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDeleteTarget(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteTarget]);

  function updateCondition(index: number, key: keyof FieldCondition, value: string) {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [key]: value } : c))
    );
  }

  function addCondition() {
    setConditions((prev) => [...prev, { field: "", equals: "" }]);
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const fields = conditions.filter((c) => c.field && c.equals);
      await api.post("/api/audiences", {
        name,
        filter: { fields },
      });
      setName("");
      setConditions([{ field: "", equals: "" }]);
      setShowForm(false);
      await loadAudiences();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Could not create audience"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/audiences/${deleteTarget.id}`);
      if (expandedId === deleteTarget.id) setExpandedId(null);
      setDeleteTarget(null);
      await loadAudiences();
    } finally {
      setDeleting(false);
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    const detail = await api.get<AudienceDetail>(`/api/audiences/${id}`);
    setExpandedDetail(detail);
  }

  function describeFilter(filter: Audience["filter"]) {
    const parts: string[] = [];
    if (filter.tag) parts.push(`tag = ${filter.tag}`);
    filter.fields?.forEach((f) => parts.push(`${f.field} = ${f.equals}`));
    return parts.length ? parts.join(" AND ") : "All contacts";
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl font-semibold text-[#0F2044]">
            Audiences
          </h1>
          <p className="mt-1 text-sm text-[#0F2044]/60">
            Saved filters you can send campaigns to.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-[#0F2044] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0a1730]"
        >
          New audience
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-md border border-[#0F2044]/10 bg-[#FBF8F2] p-4"
        >
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-[#0F2044]/70">
              Name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mumbai contacts"
              className="w-64 rounded-md border border-[#0F2044]/20 bg-white px-2 py-1.5 text-sm text-[#0F2044] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
            />
          </div>

          <p className="mb-1 text-xs font-medium text-[#0F2044]/70">
            Match contacts where all of these are true:
          </p>
          <div className="space-y-2">
            {conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  placeholder="field (e.g. city)"
                  value={c.field}
                  onChange={(e) => updateCondition(i, "field", e.target.value)}
                  className="w-40 rounded-md border border-[#0F2044]/20 bg-white px-2 py-1.5 text-sm text-[#0F2044] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
                />
                <span className="text-sm text-[#0F2044]/40">equals</span>
                <input
                  placeholder="value (e.g. Mumbai)"
                  value={c.equals}
                  onChange={(e) => updateCondition(i, "equals", e.target.value)}
                  className="w-40 rounded-md border border-[#0F2044]/20 bg-white px-2 py-1.5 text-sm text-[#0F2044] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
                />
                {conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCondition(i)}
                    className="text-xs text-[#0F2044]/40 hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addCondition}
            className="mt-2 text-xs font-medium text-[#0F2044] hover:text-[#C9A227]"
          >
            + Add condition
          </button>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[#0F2044] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0a1730] disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create audience"}
            </button>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>
        </form>
      )}

      <div className="space-y-3">
        {loading && <p className="text-sm text-[#0F2044]/40">Loading...</p>}
        {!loading && audiences.length === 0 && (
          <p className="text-sm text-[#0F2044]/40">
            No audiences yet. Create one to group your contacts.
          </p>
        )}
        {audiences.map((a) => (
          <div
            key={a.id}
            className="rounded-md border border-[#0F2044]/10 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#0F2044]">{a.name}</p>
                <p className="mt-0.5 text-xs text-[#0F2044]/60">
                  {describeFilter(a.filter)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#C9A227]/15 px-2 py-0.5 text-xs font-medium text-[#0F2044]">
                  {a.memberCount} member{a.memberCount !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => toggleExpand(a.id)}
                  className="text-xs font-medium text-[#0F2044] hover:text-[#C9A227]"
                >
                  {expandedId === a.id ? "Hide" : "View members"}
                </button>
                <button
                  onClick={() => setDeleteTarget(a)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>

            {expandedId === a.id && (
              <div className="mt-3 border-t border-[#0F2044]/10 pt-3">
                {!expandedDetail ? (
                  <p className="text-xs text-[#0F2044]/40">Loading members...</p>
                ) : expandedDetail.members.length === 0 ? (
                  <p className="text-xs text-[#0F2044]/40">No matching contacts.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-[#0F2044]/80">
                    {expandedDetail.members.map((m) => (
                      <li key={m.id}>
                        {m.name || "—"} {m.email ? `· ${m.email}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F2044]/40 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border border-[#0F2044]/10 bg-[#FBF8F2] p-6 shadow-xl"
          >
            <h2 className="font-serif text-lg font-semibold text-[#0F2044]">
              Delete audience?
            </h2>
            <p className="mt-2 text-sm text-[#0F2044]/70">
              This will permanently delete{" "}
              <span className="font-medium text-[#0F2044]">
                {deleteTarget.name}
              </span>
              . This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-md border border-[#0F2044]/20 px-3 py-1.5 text-sm font-medium text-[#0F2044] hover:bg-[#0F2044]/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}