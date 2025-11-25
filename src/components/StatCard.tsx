import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  iconBg?: string;
  iconColor?: string;
}

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  iconBg = "bg-[#2563EB]/10",
  iconColor = "text-[#2563EB]"
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB]">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-[#6B7280] mb-1">{title}</p>
          <p className="text-3xl font-semibold text-[#1F2937] mb-2">{value}</p>
          {trend && (
            <span className={`text-sm ${trend.isPositive ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
        <div className={`${iconBg} ${iconColor} p-3 rounded-lg`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}
