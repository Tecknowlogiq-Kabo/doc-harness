import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/error-boundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocHarness — AI Documentation Generator",
  description: "Generate comprehensive software documentation from a single prompt",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text">
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
