import { ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function VYDEcosystemBanner() {
  const { user, loading } = useAuth();

  // Only hide banner when we're sure user is authenticated
  // Show banner by default on public pages
  if (loading === false && user !== null) {
    return null;
  }

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

