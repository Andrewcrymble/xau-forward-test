import type { Metadata } from "next";
import "./globals.css";
import { MainNav } from "@/components/main-nav";

export const metadata: Metadata = {
  title: "KDP Colouring Book Studio",
  description:
    "Create complete Amazon KDP-ready colouring books: plan, generate, review and export.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <div className="flex min-h-screen">
          <MainNav />
          <main className="min-w-0 flex-1 px-8 py-8">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
