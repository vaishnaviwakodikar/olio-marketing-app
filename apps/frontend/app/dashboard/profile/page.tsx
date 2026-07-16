"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";

interface Me {
  id: string;
  email: string;
  workspaceId: string;
  createdAt: string;
  workspace: { name: string; createdAt: string };
  stats: { contacts: number; campaigns: number; campaignsSent: number };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function initials(email: string) {
  return email.trim().charAt(0).toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Me>("/api/auth/me")
      .then(setMe)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Couldn't load your profile. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <p className="text-sm text-[#7A7566]">Loading...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!me) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#C9A227]">
          Account
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-logo)] text-3xl italic text-[#0F2044]">
          Profile
        </h1>
        <p className="mt-2 text-sm text-[#7A7566]">
          Your account and workspace details.
        </p>
      </div>

      <div className="rounded-2xl border border-[#E3DCC9] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#F5D67D] via-[#E3BE5D] to-[#C9A227] font-[family-name:var(--font-logo)] text-2xl italic text-[#0F2044] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
            {initials(me.email)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-[#0F2044]">
              {me.email}
            </p>
            <p className="text-sm text-[#7A7566]">
              Member since {formatDate(me.createdAt)}
            </p>
          </div>
        </div>

        <div className="my-6 border-t border-[#E3DCC9]" />

        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[#7A7566]">
              Email
            </dt>
            <dd className="mt-1 text-sm text-[#0F2044]">{me.email}</dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[#7A7566]">
              Workspace
            </dt>
            <dd className="mt-1 text-sm text-[#0F2044]">
              {me.workspace.name}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[#7A7566]">
              Workspace created
            </dt>
            <dd className="mt-1 text-sm text-[#0F2044]">
              {formatDate(me.workspace.createdAt)}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[#7A7566]">
              User ID
            </dt>
            <dd className="mt-1 truncate font-mono text-xs text-[#7A7566]">
              {me.id}
            </dd>
          </div>
        </dl>

        <div className="my-6 border-t border-[#E3DCC9]" />

        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[#7A7566]">
          Workspace Activity
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-[#FBF8F2] p-4 text-center">
            <p className="font-[family-name:var(--font-logo)] text-2xl italic text-[#0F2044]">
              {me.stats?.contacts ?? 0}
            </p>
            <p className="mt-1 text-xs text-[#7A7566]">Contacts</p>
          </div>
          <div className="rounded-xl bg-[#FBF8F2] p-4 text-center">
            <p className="font-[family-name:var(--font-logo)] text-2xl italic text-[#0F2044]">
              {me.stats?.campaigns ?? 0}
            </p>
            <p className="mt-1 text-xs text-[#7A7566]">Campaigns</p>
          </div>
          <div className="rounded-xl bg-[#FBF8F2] p-4 text-center">
            <p className="font-[family-name:var(--font-logo)] text-2xl italic text-[#0F2044]">
              {me.stats?.campaignsSent ?? 0}
            </p>
            <p className="mt-1 text-xs text-[#7A7566]">Sent</p>
          </div>
        </div>
      </div>

      <RenameWorkspaceCard
        currentName={me.workspace.name}
        onRenamed={(name) =>
          setMe((prev) =>
            prev ? { ...prev, workspace: { ...prev.workspace, name } } : prev
          )
        }
      />

      <ChangePasswordCard />
    </div>
  );
}

function RenameWorkspaceCard({
  currentName,
  onRenamed,
}: {
  currentName: string;
  onRenamed: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setMessage({ type: "error", text: "Workspace name can't be empty." });
      return;
    }
    if (trimmed === currentName) return;

    setSaving(true);
    try {
      const result = await api.patch<{ name: string }>("/api/auth/workspace", {
        name: trimmed,
      });
      onRenamed(result.name);
      setMessage({ type: "success", text: "Workspace renamed." });
    } catch (err) {
      const text =
        err instanceof ApiError ? err.message : "Something went wrong.";
      setMessage({ type: "error", text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E3DCC9] bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium text-[#0F2044]">Workspace name</h2>
      <p className="mt-1 text-sm text-[#7A7566]">
        This is the name shown across your dashboard.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="flex-1 rounded-lg border border-[#E3DCC9] bg-[#FBF8F2] px-3 py-2 text-sm text-[#0F2044] outline-none focus:border-[#C9A227]"
        />
        <button
          type="submit"
          disabled={saving || name.trim() === currentName}
          className="whitespace-nowrap rounded-lg bg-gradient-to-b from-[#F5D67D] via-[#E3BE5D] to-[#C9A227] px-4 py-2 text-sm font-medium text-[#0F2044] shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.4)] transition hover:from-[#F7DE94] hover:via-[#EBC96E] hover:to-[#D4AC33] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </form>

      {message && (
        <p
          className={`mt-2 text-sm ${
            message.type === "success" ? "text-[#3E7A4E]" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({
        type: "error",
        text: "New password must be at least 8 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords don't match." });
      return;
    }

    setSaving(true);
    try {
      await api.patch("/api/auth/me/password", {
        currentPassword,
        newPassword,
      });
      setMessage({ type: "success", text: "Password updated." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const text =
        err instanceof ApiError ? err.message : "Something went wrong.";
      setMessage({ type: "error", text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E3DCC9] bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium text-[#0F2044]">Change password</h2>
      <p className="mt-1 text-sm text-[#7A7566]">
        Choose a strong password you haven't used before.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <input
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full rounded-lg border border-[#E3DCC9] bg-[#FBF8F2] px-3 py-2 text-sm text-[#0F2044] outline-none focus:border-[#C9A227]"
        />
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-lg border border-[#E3DCC9] bg-[#FBF8F2] px-3 py-2 text-sm text-[#0F2044] outline-none focus:border-[#C9A227]"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-lg border border-[#E3DCC9] bg-[#FBF8F2] px-3 py-2 text-sm text-[#0F2044] outline-none focus:border-[#C9A227]"
        />

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-gradient-to-b from-[#F5D67D] via-[#E3BE5D] to-[#C9A227] px-4 py-2 text-sm font-medium text-[#0F2044] shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.4)] transition hover:from-[#F7DE94] hover:via-[#EBC96E] hover:to-[#D4AC33] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Updating..." : "Update password"}
        </button>
      </form>

      {message && (
        <p
          className={`mt-2 text-sm ${
            message.type === "success" ? "text-[#3E7A4E]" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}