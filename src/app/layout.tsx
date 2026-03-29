import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/providers/WalletProvider";
import Header from "@/components/Header";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DAOry Vote | Council Election",
  description:
    "Vote for the DAOry Council candidates. Connect your wallet, verify your Aurorian NFTs, and cast your vote.",
  openGraph: {
    title: "DAOry Council Election",
    description: "Vote for the DAOry Council. Each Aurorian NFT = 1 vote.",
    siteName: "DAOry Vote",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <WalletProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-daory-border py-6 text-center text-sm text-daory-muted">
            <p>
              DAOry &mdash; The DAO of the Aurory Universe &mdash;{" "}
              <a
                href="https://www.daory.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-daory-cyan hover:underline"
              >
                daory.io
              </a>
            </p>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
