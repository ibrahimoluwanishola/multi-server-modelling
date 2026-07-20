"use client";

import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// NOTE: This project intentionally does NOT use next/font/google.
// next/font/google fetches font files from fonts.googleapis.com at BUILD
// TIME. On a network without outbound access to Google (a locked-down exam
// venue, an offline defense laptop, a restricted corporate/campus network),
// `next build` fails outright before the app is graded on any point. A
// system-font stack looks close to identical in practice and removes that
// entire class of failure. See globals.css for the font-family declaration.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const pathname = usePathname();
  const isBarePage = pathname === "/" || pathname === "/login";

  useEffect(() => {
    document.title = "MediQueue Optima — M/M/c Hospital Queueing Model";
  }, []);

  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {isBarePage ? (
          children
        ) : (
          <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar
              isOpen={isSidebarOpen}
              collapsed={isSidebarCollapsed}
              onClose={() => setIsSidebarOpen(false)}
              onToggleCollapse={() => setIsSidebarCollapsed((value) => !value)}
            />
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
              <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
              <main className="flex-1 overflow-auto p-4 md:p-8">
                {children}
              </main>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
