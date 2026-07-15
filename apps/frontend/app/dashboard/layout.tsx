"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";

interface Me {
  id: string;
  email: string;
  workspaceId: string;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/contacts", label: "Contacts" },
  { href: "/dashboard/audiences", label: "Audiences" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    api
      .get<Me>("/api/auth/me")
      .then(setMe)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
        }
      })
      .finally(() => setChecked(true));
  }, [router]);

  async function handleLogout() {
    await api.post("/api/auth/logout");
    router.push("/login");
  }

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Loading...
      </div>
    );
  }

  if (!me) return null; // redirect is already underway

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-white px-4 py-6">
          <p className="mb-6 px-2 text-sm font-semibold text-slate-900">
            Mail
          </p>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-2 py-1.5 text-sm ${
                  pathname === item.href
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 border-t border-slate-200 pt-4">
            <p className="truncate px-2 text-xs text-slate-400">{me.email}</p>
            <button
              onClick={handleLogout}
              className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </aside>
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}