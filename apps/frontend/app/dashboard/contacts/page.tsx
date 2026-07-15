"use client";

import { useEffect, useState, useRef } from "react";
import { api, ApiError } from "../../../lib/api";

interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  customFields: Record<string, unknown>;
}

interface ImportResult {
  added: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  summary: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadContacts() {
    setLoading(true);
    try {
      const data = await api.get<Contact[]>("/api/contacts");
      setContacts(data);
    } catch {
      // swallow - could show a toast in a fuller build
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (!deleteTarget) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDeleteTarget(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteTarget]);

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post("/api/contacts", { name, email, phone });
      setName("");
      setEmail("");
      setPhone("");
      setShowAddForm(false);
      await loadContacts();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Could not add contact"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/contacts/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadContacts();
    } finally {
      setDeleting(false);
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.post<ImportResult>(
        "/api/contacts/import",
        formData
      );
      setImportResult(result);
      await loadContacts();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-end justify-between border-b border-[#0F2044]/10 pb-6">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C9A227]">
            Address book
          </p>
          <h1 className="font-serif text-[28px] font-medium leading-tight text-[#0F2044]">
            Contacts
          </h1>
          <p className="mt-1.5 text-sm text-[#0F2044]/55">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="rounded-md border border-[#0F2044]/20 bg-white px-4 py-2 text-sm font-medium text-[#0F2044] transition-colors hover:bg-[#0F2044]/5 disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import CSV"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelected}
            className="hidden"
          />
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-md bg-[#0F2044] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0a1730]"
          >
            {showAddForm ? "Close" : "Add contact"}
          </button>
        </div>
      </div>

      {importResult && (
        <div className="mb-5 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
          Import complete: {importResult.summary}
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleAddContact}
          className="mb-8 rounded-xl border border-[#0F2044]/10 bg-white p-6 shadow-sm"
        >
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0F2044]/45">
            New contact
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#0F2044]/70">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] px-3 py-2 text-sm text-[#0F2044] placeholder:text-[#0F2044]/30 transition-shadow focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#0F2044]/70">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] px-3 py-2 text-sm text-[#0F2044] placeholder:text-[#0F2044]/30 transition-shadow focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#0F2044]/70">
                Phone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 ..."
                className="rounded-md border border-[#0F2044]/15 bg-[#FBF8F2] px-3 py-2 text-sm text-[#0F2044] placeholder:text-[#0F2044]/30 transition-shadow focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[#0F2044] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0a1730] disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Save"}
            </button>
          </div>
          {formError && (
            <p className="mt-3 text-sm text-red-600">{formError}</p>
          )}
        </form>
      )}

      {/* Contacts table */}
      <div className="overflow-hidden rounded-xl border border-[#0F2044]/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#0F2044]/10 bg-[#FBF8F2]">
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F2044]/50">
                Name
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F2044]/50">
                Email
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F2044]/50">
                Phone
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F2044]/50">
                Other fields
              </th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-[#0F2044]/40">
                  Loading contacts...
                </td>
              </tr>
            )}
            {!loading && contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center">
                  <p className="text-sm font-medium text-[#0F2044]/60">
                    No contacts yet
                  </p>
                  <p className="mt-1 text-xs text-[#0F2044]/40">
                    Add one or import a CSV to get started.
                  </p>
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr
                key={c.id}
                className="border-b border-[#0F2044]/8 transition-colors last:border-0 hover:bg-[#FBF8F2]/60"
              >
                <td className="px-5 py-3.5 font-medium text-[#0F2044]">
                  {c.name || "—"}
                </td>
                <td className="px-5 py-3.5 text-[#0F2044]/70">{c.email || "—"}</td>
                <td className="px-5 py-3.5 text-[#0F2044]/70">{c.phone || "—"}</td>
                <td className="px-5 py-3.5 text-[#0F2044]/45">
                  {Object.entries(c.customFields ?? {})
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ") || "—"}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => setDeleteTarget(c)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
              Delete contact?
            </h2>
            <p className="mt-2 text-sm text-[#0F2044]/70">
              This will permanently delete{" "}
              <span className="font-medium text-[#0F2044]">
                {deleteTarget.name || deleteTarget.email || "this contact"}
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