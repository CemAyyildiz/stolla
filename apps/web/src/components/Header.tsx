"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/context/WalletProvider";

const navItems = [
  { href: "/community", label: "Community" },
  { href: "/proposals", label: "Proposals" },
];

function shortenAddress(address: string) {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Header() {
  const pathname = usePathname();
  const { address, connect, disconnect, isConnecting } = useWallet();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isMenuOpen) {
      if (wasOpenRef.current) {
        triggerRef.current?.focus();
      }
      wasOpenRef.current = false;
      return;
    }

    wasOpenRef.current = true;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  const handleDisconnect = () => {
    disconnect();
    setIsMenuOpen(false);
  };

  const walletLabel = useMemo(() => {
    if (!address) {
      return "Connect Wallet";
    }

    return `Account ${shortenAddress(address)}`;
  }, [address]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#0b0f19]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
        <div className="flex min-w-0 items-center gap-5 sm:gap-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-lg font-semibold text-slate-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/stolla-logo.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 rounded-lg object-cover"
              aria-hidden="true"
            />
            Stolla
          </Link>
          <nav className="flex gap-1 sm:gap-2">
            {navItems.map((item) => {
              const isActive = pathname?.startsWith(item.href) ?? false;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors sm:px-3 ${
                    isActive
                      ? "bg-indigo-950 font-medium text-indigo-300"
                      : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {address ? (
            <>
              <div className="hidden sm:flex sm:items-center sm:gap-2">
                <span className="truncate text-xs text-slate-500 sm:max-w-[180px]">
                  {address}
                </span>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
                >
                  Disconnect
                </button>
              </div>

              <div className="relative sm:hidden">
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={() => setIsMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={isMenuOpen}
                  aria-label={walletLabel}
                  className="flex max-w-[11rem] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-left text-sm text-slate-100 shadow-sm"
                >
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                    Account
                  </span>
                  <span className="truncate font-mono text-xs text-slate-300">
                    {shortenAddress(address)}
                  </span>
                </button>

                {isMenuOpen ? (
                  <div
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-4 top-14 z-[60] mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Connected account
                        </p>
                        <p className="mt-1 break-all text-sm text-slate-200">
                          {address}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                        Live
                      </span>
                    </div>
                    <div className="sr-only">{address}</div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleDisconnect}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleDisconnect();
                        }
                      }}
                      className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={connect}
              disabled={isConnecting}
              className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50 sm:px-4"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
