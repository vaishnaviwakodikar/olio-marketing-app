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

  async function handleDelete(id: string) {
    if (!confirm("Delete this audience?")) return;
    await api.delete(`/api/audiences/${id}`);
    if (expandedId === id) setExpandedId(null);
    await loadAudiences();
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
          <h1 className="text-xl font-semibold text-slate-900">Audiences</h1>
          <p className="mt-1 text-sm text-slate-500">
            Saved filters you can send campaigns to.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          New audience
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-md border border-slate-200 bg-white p-4"
        >
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mumbai contacts"
              className="w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>

          <p className="mb-1 text-xs font-medium text-slate-600">
            Match contacts where all of these are true:
          </p>
          <div className="space-y-2">
            {conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  placeholder="field (e.g. city)"
                  value={c.field}
                  onChange={(e) => updateCondition(i, "field", e.target.value)}
                  className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <span className="text-sm text-slate-400">equals</span>
                <input
                  placeholder="value (e.g. Mumbai)"
                  value={c.equals}
                  onChange={(e) => updateCondition(i, "equals", e.target.value)}
                  className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                {conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCondition(i)}
                    className="text-xs text-slate-400 hover:text-red-600"
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
            className="mt-2 text-xs font-medium text-slate-600 hover:underline"
          >
            + Add condition
          </button>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create audience"}
            </button>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>
        </form>
      )}

      <div className="space-y-3">
        {loading && <p className="text-sm text-slate-400">Loading...</p>}
        {!loading && audiences.length === 0 && (
          <p className="text-sm text-slate-400">
            No audiences yet. Create one to group your contacts.
          </p>
        )}
        {audiences.map((a) => (
          <div
            key={a.id}
            className="rounded-md border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{a.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {describeFilter(a.filter)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {a.memberCount} member{a.memberCount !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => toggleExpand(a.id)}
                  className="text-xs font-medium text-slate-600 hover:underline"
                >
                  {expandedId === a.id ? "Hide" : "View members"}
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>

            {expandedId === a.id && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                {!expandedDetail ? (
                  <p className="text-xs text-slate-400">Loading members...</p>
                ) : expandedDetail.members.length === 0 ? (
                  <p className="text-xs text-slate-400">No matching contacts.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-slate-600">
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
    </div>
  );
}