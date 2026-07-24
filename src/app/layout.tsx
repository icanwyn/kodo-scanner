import type { Metadata } from "next";
import { Noto_Sans_JP, JetBrains_Mono } from "next/font/google";
import { Shell } from "@/components/layout/Shell";
import "./globals.css";

const noto = Noto_Sans_JP({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kōdō Scanner — High-Probability Stock Scanner",
  description:
    "Expert confluence stock scanner with market regime, trade journal, and deep analysis. Not financial advice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${noto.variable} ${mono.variable} antialiased`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
