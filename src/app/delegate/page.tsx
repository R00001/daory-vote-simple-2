"use client";

import DelegateWallet from "@/components/DelegateWallet";

export default function DelegatePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-6 sm:mb-10">
        <h1
          className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white uppercase mb-3"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Wallet <span className="text-daory-cyan">Delegation</span>
        </h1>
        <p className="text-daory-muted max-w-xl">
          Don&apos;t want to connect your Aurorian holder wallet? Designate a
          separate voting wallet by proving ownership through a micro
          SOL transfer.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 sm:gap-8">
        <DelegateWallet />

        <div className="space-y-4">
          <div className="bg-daory-card border border-daory-border p-5">
            <h3 className="text-sm font-bold text-white mb-3 uppercase">
              Why Delegate?
            </h3>
            <ul className="space-y-2 text-sm text-daory-muted">
              <li className="flex gap-2">
                <span className="text-daory-cyan">01</span>
                <span>Your Aurorian wallet never connects to this site</span>
              </li>
              <li className="flex gap-2">
                <span className="text-daory-cyan">02</span>
                <span>
                  Use a burner or hot wallet to vote safely
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-daory-cyan">03</span>
                <span>
                  Prove ownership with a tiny SOL transfer (&lt;0.000002 SOL)
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-daory-cyan">04</span>
                <span>One-time setup, then vote normally</span>
              </li>
            </ul>
          </div>

          <div className="bg-daory-card border border-daory-border p-5">
            <h3 className="text-sm font-bold text-white mb-3 uppercase">
              How It Works
            </h3>
            <ol className="space-y-2 text-sm text-daory-muted list-decimal list-inside">
              <li>Enter your Aurorian wallet &amp; a voting wallet</li>
              <li>We generate a unique micro-SOL amount</li>
              <li>
                You send that exact amount from your Aurorian wallet to your
                voting wallet
              </li>
              <li>Paste the transaction signature to verify</li>
              <li>Connect your voting wallet on the Vote page</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
