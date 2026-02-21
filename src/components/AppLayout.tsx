import { Outlet } from "react-router";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
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
      <main className="flex-1 ml-0 md:ml-64 pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
