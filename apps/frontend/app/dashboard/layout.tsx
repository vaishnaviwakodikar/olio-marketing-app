"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Newsreader, Inter } from "next/font/google";
import { api, ApiError } from "../../lib/api";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["italic"],
  weight: ["500", "600"],
  variable: "--font-logo",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

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

function MercuryMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <rect x="8" y="20" width="48" height="32" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M8 22 L32 40 L56 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4 16 C 16 8, 30 8, 40 4 C 34 12, 30 18, 34 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <circle cx="40" cy="4" r="2" fill="currentColor" />
    </svg>
  );
}

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
      <div className="flex min-h-screen items-center justify-center bg-[#FBF8F2] text-sm text-[#7A7566]">
        Loading...
      </div>
    );
  }

  if (!me) return null;

  return (
  <div className={`${inter.variable} ${newsreader.variable} flex min-h-screen bg-[#FBF8F2] font-[family-name:var(--font-body)]`}>
        <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col justify-between overflow-y-auto bg-[#0F2044] px-4 py-6">
          <div>
            <div className="mb-8 flex items-center gap-2 px-2 text-[#E3BE5D]">
              <MercuryMark className="h-6 w-6" />
              <span className="font-[family-name:var(--font-logo)] text-lg italic text-[#F5EFE0]">
                Mercury
              </span>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "bg-[#C9A227]/15 font-medium text-[#E3BE5D]"
                        : "text-[#B9C4DA] hover:bg-white/5 hover:text-[#F5EFE0]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="border-t border-white/10 pt-4">
            <p className="truncate px-3 text-xs text-[#7C88A3]">{me.email}</p>
            <button
              onClick={handleLogout}
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-[#B9C4DA] transition hover:bg-white/5 hover:text-[#F5EFE0]"
            >
              Log out
            </button>
          </div>
        </aside>
        <main className="flex-1 px-8 py-8">{children}</main>
      
    </div>
  );
}