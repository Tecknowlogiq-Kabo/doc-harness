import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/error-boundary";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocHarness — AI Documentation Generator",
  description: "Generate comprehensive software documentation from a single prompt",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text">
        <Sidebar />
        <main className="lg:ml-56 min-h-screen">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </body>
    </html>
  );
}
