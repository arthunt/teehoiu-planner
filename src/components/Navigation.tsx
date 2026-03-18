"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();

  return (
    <header className="bg-[#009B8D] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <div>
              <h1 className="text-lg font-bold leading-tight">
                Teehoiu Planner
              </h1>
              <p className="text-xs text-teal-100 leading-tight hidden sm:block">
                Teede hoolduse planeerimine
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === "/"
                  ? "bg-white/20 text-white"
                  : "text-teal-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              Planner
            </Link>
            <Link
              href="/feedback"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === "/feedback"
                  ? "bg-white/20 text-white"
                  : "text-teal-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              Tagasiside
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
