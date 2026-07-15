"use client";

import { Newsreader, Inter } from "next/font/google";

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

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div
      className={`${inter.variable} ${newsreader.variable} flex min-h-screen font-[family-name:var(--font-body)]`}
    >
      {/* Branding panel */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0A1424] via-[#0F2044] to-[#17315F] px-12 py-14 text-[#F5EFE0] md:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#C9A227] opacity-[0.12] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-6rem] right-[-4rem] h-72 w-72 rounded-full bg-[#E3BE5D] opacity-[0.08] blur-3xl" />

        <div className="relative flex items-center gap-3 text-[#E3BE5D]">
          <MercuryMark className="h-9 w-9" />
          <span className="font-[family-name:var(--font-logo)] text-2xl italic tracking-wide text-[#F5EFE0]">
            Mercury
          </span>
        </div>

        <div className="relative max-w-sm">
          <p className="font-[family-name:var(--font-logo)] text-3xl italic leading-snug text-[#F5EFE0]">
            Every campaign,
            <br />
            delivered and tracked.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[#B9C4DA]">
            Send, monitor, and understand your email campaigns from one
            calm, dependable place.
          </p>
        </div>

        <p className="relative text-xs tracking-wide text-[#7C88A3]">
          © {new Date().getFullYear()} Mercury
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-[#FBF8F2] px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-[#0F2044] md:hidden">
            <MercuryMark className="h-7 w-7" />
            <span className="font-[family-name:var(--font-logo)] text-xl italic">
              Mercury
            </span>
          </div>

          <h1 className="mb-1 font-[family-name:var(--font-logo)] text-3xl italic text-[#14213D]">
            {title}
          </h1>
          <p className="mb-8 text-sm text-[#7A7566]">{subtitle}</p>

          {children}

          <p className="mt-6 text-center text-sm text-[#7A7566]">{footer}</p>
        </div>
      </div>
    </div>
  );
}

export function FormField({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#3B3529]">
        {label}
      </label>
      <input
        {...props}
        className="w-full rounded-lg border border-[#E3DCC9] bg-white px-3.5 py-2.5 text-sm text-[#14213D] shadow-sm transition focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30"
      />
    </div>
  );
}

export function SubmitButton({
  loading,
  label,
  loadingLabel,
}: {
  loading: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-lg bg-[#0F2044] px-3.5 py-2.5 text-sm font-medium text-[#F5EFE0] transition hover:bg-[#16294A] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? loadingLabel : label}
    </button>
  );
}

export function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-[#E8B4A8] bg-[#FBEEEA] px-3.5 py-2.5 text-sm text-[#9A3B2C]">
      {children}
    </p>
  );
}