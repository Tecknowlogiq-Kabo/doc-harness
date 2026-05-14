import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocHarness — AI Documentation Generator",
  description: "Generate comprehensive software documentation from a single prompt",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text">{children}</body>
    </html>
  );
}
