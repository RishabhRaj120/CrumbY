import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "CrumbDesk | Local-First AI Order Management for Home Bakers",
  description:
    "A local-first AI order management tool for independent home bakers. Extracts structured orders from WhatsApp and Instagram messages using local Gemma 3 4B on Ollama.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-crumb-bg text-crumb-espresso flex">
        {/* Desktop Sidebar */}
        <Sidebar className="hidden lg:flex" />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 pb-12">{children}</main>
        </div>
      </body>
    </html>
  );
}
