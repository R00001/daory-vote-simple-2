"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export default function ConnectButton() {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  if (connecting) {
    return (
      <button
        disabled
        className="px-5 py-2 border border-daory-border text-daory-muted text-sm font-medium uppercase tracking-wider"
      >
        Connecting...
      </button>
    );
  }

  if (publicKey) {
    const address = publicKey.toBase58();
    const short = `${address.slice(0, 4)}...${address.slice(-4)}`;
    return (
      <button
        onClick={() => disconnect()}
        className="px-5 py-2 border border-daory-border text-white text-sm font-medium hover:border-daory-cyan transition-colors"
      >
        {short}
      </button>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      className="px-5 py-2 border border-daory-cyan text-daory-cyan text-sm font-medium uppercase tracking-wider hover:bg-daory-cyan/10 transition-colors flex items-center gap-2"
    >
      Connect Wallet
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </button>
  );
}
