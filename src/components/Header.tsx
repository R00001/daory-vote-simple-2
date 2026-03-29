"use client";

import Link from "next/link";
import Image from "next/image";
import ConnectButton from "./ConnectButton";

export default function Header() {
  return (
    <header className="border-b border-daory-border bg-black/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/daory-logo.png"
            alt="DAOry"
            width={120}
            height={29}
            className="h-5 sm:h-7 w-auto"
            priority
          />
        </Link>

        <nav className="flex items-center gap-3 sm:gap-6">
          <Link href="/" className="text-daory-muted hover:text-white transition-colors text-xs sm:text-sm font-medium uppercase tracking-wider">
            Vote
          </Link>
          <Link href="/results" className="text-daory-muted hover:text-white transition-colors text-xs sm:text-sm font-medium uppercase tracking-wider">
            Results
          </Link>
          <Link href="/delegate" className="text-daory-muted hover:text-white transition-colors text-xs sm:text-sm font-medium uppercase tracking-wider hidden sm:block">
            Delegate
          </Link>
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}
