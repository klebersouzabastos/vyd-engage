import { Outlet } from "react-router";
import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { OnboardingTour } from "./OnboardingTour";
import { Menu } from "lucide-react";

const SIDEBAR_COLLAPSED_KEY = "vyd-sidebar-collapsed";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  const toggleCollapse = () => setCollapsed((prev) => !prev);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Skip to main content — a11y */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm"
      >
        Pular para o conteúdo principal
      </a>

      {/* Mobile hamburger header */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center h-14 px-4 bg-gray-50 border-b border-gray-300 md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={24} />
        </button>
        <span className="ml-3 font-semibold text-gray-900 text-sm">VYD Engage</span>
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
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Main content — width/margin controlled via CSS in globals.css using data-sidebar */}
      <main
        id="main-content"
        data-sidebar={collapsed ? "collapsed" : "expanded"}
        className="flex-1 pt-14 md:pt-0"
        role="main"
      >
        <Outlet />
      </main>

      {/* Onboarding Tour */}
      <OnboardingTour />
    </div>
  );
}
