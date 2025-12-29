import { ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useLocation } from "react-router";

export function VYDEcosystemBanner() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Define public routes where banner should ALWAYS appear
  const publicRoutes = ['/', '/login', '/register', '/onboarding', '/forgot-password', '/reset-password', '/verify-email'];
  const isPublicRoute = publicRoutes.includes(location.pathname) || location.pathname.startsWith('/capture/');

  // Always show banner on public routes, regardless of auth state or loading
  // This ensures it appears even if API fails or takes time to respond
  if (isPublicRoute) {
    return (
      <div 
        className="fixed top-0 left-0 right-0 bg-[#F9FAFB] border-b border-[#E5E7EB] shadow-sm"
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          zIndex: 100,
          backgroundColor: '#F9FAFB',
          borderBottom: '1px solid #E5E7EB',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '24px',
          paddingRight: '24px'
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm w-full">
          <a
            href="https://www.vydhub.com"
            target="_self"
            className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#1F2937] transition-colors flex-shrink-0"
          >
            <ArrowLeft size={14} />
            <span>Back to VYD Hub</span>
          </a>
          <span className="text-[#6B7280] flex-shrink-0 ml-auto">
            A VYD ecosystem solution
          </span>
        </div>
      </div>
    );
  }

  // Hide banner only if:
  // 1. We're on a private route (starts with /app)
  // 2. AND user is authenticated (not loading and has user.id)
  // Otherwise, show banner
  if (location.pathname.startsWith('/app')) {
    // On private routes, only hide if user is authenticated
    if (!loading && user && user.id) {
      return null;
    }
  }

  // Show banner by default (for unauthenticated users on /app routes, etc.)
  return (
    <div 
      className="fixed top-0 left-0 right-0 bg-[#F9FAFB] border-b border-[#E5E7EB] shadow-sm"
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 100,
        backgroundColor: '#F9FAFB',
        borderBottom: '1px solid #E5E7EB',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '24px',
        paddingRight: '24px'
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between text-sm w-full">
        <a
          href="https://www.vydhub.com"
          target="_self"
          className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#1F2937] transition-colors flex-shrink-0"
        >
          <ArrowLeft size={14} />
          <span>Back to VYD Hub</span>
        </a>
        <span className="text-[#6B7280] flex-shrink-0 ml-auto">
          A VYD ecosystem solution
        </span>
      </div>
    </div>
  );
}
