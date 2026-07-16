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
  workspaceId: string
  createdAt: string;
  workspace: { name: string; createdAt: string };
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/contacts", label: "Contacts" },
  { href: "/dashboard/audiences", label: "Audiences" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/profile", label: "Profile" },
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

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
  const [navOpen, setNavOpen] = useState(false);

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

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

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
    <div className={`${inter.variable} ${newsreader.variable} min-h-screen bg-[#FBF8F2] font-[family-name:var(--font-body)] lg:flex`}>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E3DCC9] bg-[#0F2044] px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2 text-[#E3BE5D]">
          <MercuryMark className="h-5 w-5" />
          <span className="font-[family-name:var(--font-logo)] text-base italic text-[#F5EFE0]">
            Mercury
          </span>
        </div>
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-1.5 text-[#B9C4DA] transition hover:bg-white/10 hover:text-[#F5EFE0]"
        >
          <MenuIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Overlay backdrop for mobile drawer */}
      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar: fixed drawer on mobile, static column on desktop */}
      <aside
  className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-64 shrink-0 flex-col justify-between overflow-y-auto bg-[#0F2044] px-4 py-6 transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-60 lg:translate-x-0 ${
    navOpen ? "translate-x-0" : "-translate-x-full"
  }`}
>
        <div>
          <div className="mb-8 flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-[#E3BE5D]">
              <MercuryMark className="h-6 w-6" />
              <span className="font-[family-name:var(--font-logo)] text-lg italic text-[#F5EFE0]">
                Mercury
              </span>
            </div>
            <button
              onClick={() => setNavOpen(false)}
              aria-label="Close menu"
              className="rounded-md p-1 text-[#B9C4DA] transition hover:bg-white/10 hover:text-[#F5EFE0] lg:hidden"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
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
  className="mt-1 w-full rounded-lg bg-gradient-to-b from-[#F5D67D] via-[#E3BE5D] to-[#C9A227] px-3 py-2 text-left text-sm font-medium text-[#0F2044] shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.4)] transition hover:from-[#F7DE94] hover:via-[#EBC96E] hover:to-[#D4AC33] hover:shadow-[0_2px_4px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.5)] active:shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]"
>
  Log out
</button>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}