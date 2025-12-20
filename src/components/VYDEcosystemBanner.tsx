import { ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function VYDEcosystemBanner() {
  const { user } = useAuth();

  // Only show banner when user is not authenticated
  if (user !== null) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-[#F9FAFB] border-b border-[#E5E7EB] py-2 px-6 z-[60]">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
        <span className="text-[#6B7280]">
          This solution is part of the VYD ecosystem
        </span>
        <a
          href="https://www.vydhub.com"
          className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#1F2937] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to VYD Hub</span>
        </a>
      </div>
    </div>
  );
}

