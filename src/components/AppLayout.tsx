import { Outlet } from "react-router";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      {/* Skip to main content — a11y */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:bg-[#2563EB] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm"
      >
        Pular para o conteúdo principal
      </a>

      {/* Mobile hamburger header */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center h-14 px-4 bg-white border-b border-[#E5E7EB] md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#1F2937] transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={24} />
        </button>
        <span className="ml-3 font-semibold text-[#1F2937] text-sm">VYD Engage</span>
      </div>

      {/* Backdrop overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <main id="main-content" className="flex-1 ml-0 md:ml-64 pt-14 md:pt-0" role="main">
        <Outlet />
      </main>
    </div>
  );
}
