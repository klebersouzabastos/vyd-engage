import { ConnectionStatusInfo } from "../../types/whatsapp";
import { Badge } from "../ui/badge";
import { CheckCircle, XCircle, Loader2, Battery, BatteryLow, BatteryMedium, BatteryFull } from "lucide-react";

interface ConnectionStatusBadgeProps {
  status: ConnectionStatusInfo;
  showBattery?: boolean;
  showLastSync?: boolean;
}

export function ConnectionStatusBadge({
  status,
  showBattery = false,
  showLastSync = false,
}: ConnectionStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status.status) {
      case "connected":
        return {
          icon: CheckCircle,
          label: "Conectado",
          className: "bg-green-100 text-green-700 border-green-200",
        };
      case "disconnected":
        return {
          icon: XCircle,
          label: "Desconectado",
          className: "bg-gray-100 text-gray-700 border-gray-200",
        };
      case "connecting":
        return {
          icon: Loader2,
          label: "Conectando",
          className: "bg-blue-100 text-blue-700 border-blue-200",
        };
      case "error":
        return {
          icon: XCircle,
          label: "Erro",
          className: "bg-red-100 text-red-700 border-red-200",
        };
      default:
        return {
          icon: XCircle,
          label: "Desconhecido",
          className: "bg-gray-100 text-gray-700 border-gray-200",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const getBatteryIcon = () => {
    if (status.batteryLevel === undefined) return null;
    
    if (status.batteryLevel < 20) return BatteryLow;
    if (status.batteryLevel < 50) return BatteryMedium;
    if (status.batteryLevel < 80) return Battery;
    return BatteryFull;
  };

  const BatteryIcon = getBatteryIcon();

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return null;
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `Há ${diffMins} min`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Há ${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `Há ${diffDays}d`;
  };

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={`${config.className} flex items-center gap-1.5`}
      >
        {status.status === "connecting" ? (
          <Icon className="h-3 w-3 animate-spin" />
        ) : (
          <Icon className="h-3 w-3" />
        )}
        <span>{config.label}</span>
      </Badge>

      {showBattery && BatteryIcon && status.batteryLevel !== undefined && (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <BatteryIcon className="h-3 w-3" />
          <span>{status.batteryLevel}%</span>
        </div>
      )}

      {showLastSync && status.lastSync && (
        <span className="text-xs text-gray-600">
          {formatLastSync(status.lastSync)}
        </span>
      )}

      {status.errorMessage && (
        <span className="text-xs text-red-600" title={status.errorMessage}>
          {status.errorMessage.length > 30
            ? `${status.errorMessage.substring(0, 30)}...`
            : status.errorMessage}
        </span>
      )}
    </div>
  );
}








