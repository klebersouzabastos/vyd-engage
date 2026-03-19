import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  PhoneOutgoing,
  MessageCircle,
  Flame,
  Send,
  Mail,
  Handshake,
  RefreshCw,
  CalendarX,
  Target,
  Star,
  ArrowRight,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
} from "lucide-react";
import { apiClient } from "../services/api/client";
import type { NextAction } from "../types";

const ICON_MAP: Record<string, React.ReactNode> = {
  "phone-outgoing": <PhoneOutgoing size={18} />,
  "message-circle": <MessageCircle size={18} />,
  flame: <Flame size={18} />,
  send: <Send size={18} />,
  mail: <Mail size={18} />,
  handshake: <Handshake size={18} />,
  "refresh-cw": <RefreshCw size={18} />,
  "calendar-x": <CalendarX size={18} />,
  target: <Target size={18} />,
  star: <Star size={18} />,
  "arrow-right": <ArrowRight size={18} />,
  calendar: <Calendar size={18} />,
  "check-circle": <CheckCircle size={18} />,
  "alert-circle": <AlertCircle size={18} />,
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  HIGH: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700",
  },
  MEDIUM: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
    badge: "bg-yellow-100 text-yellow-700",
  },
  LOW: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    badge: "bg-green-100 text-green-700",
  },
};

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
};

interface NextActionCardProps {
  entityType: "lead" | "deal";
  entityId: string;
}

export function NextActionCard({ entityType, entityId }: NextActionCardProps) {
  const navigate = useNavigate();
  const [action, setAction] = useState<NextAction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchAction() {
      try {
        setLoading(true);
        const result =
          entityType === "lead"
            ? await apiClient.getLeadNextAction(entityId)
            : await apiClient.getDealNextAction(entityId);
        if (!cancelled) {
          setAction(result.data);
        }
      } catch {
        // Silent fail — card just won't show
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAction();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex items-center gap-3">
        <Loader2 size={18} className="animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Analisando...</span>
      </div>
    );
  }

  if (!action) return null;

  const isOk = action.category === "ok";

  if (isOk) {
    return (
      <div className="bg-green-50 rounded-lg border border-green-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-green-100 text-green-600 flex-shrink-0">
            <CheckCircle size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-green-700">{action.action}</p>
            <p className="text-xs text-green-600 mt-0.5">{action.reason}</p>
          </div>
        </div>
      </div>
    );
  }

  const styles = PRIORITY_STYLES[action.priority] || PRIORITY_STYLES.MEDIUM;
  const icon = ICON_MAP[action.icon] || <Zap size={18} />;

  return (
    <div className={`rounded-lg border p-4 ${styles.bg} ${styles.border}`}>
      <div className="flex items-start gap-3">
        <div className={`flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 ${styles.bg} ${styles.text}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Próxima Ação
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${styles.badge}`}>
              {PRIORITY_LABELS[action.priority] || action.priority}
            </span>
          </div>
          <p className={`text-sm font-semibold ${styles.text}`}>{action.action}</p>
          <p className="text-xs text-gray-500 mt-1">{action.reason}</p>
        </div>
      </div>
    </div>
  );
}

// Compact version for dashboard list items
interface ActionSummaryRowProps {
  entityType: "lead" | "deal";
  entityId: string;
  entityName: string;
  action: NextAction;
}

export function ActionSummaryRow({ entityType, entityId, entityName, action }: ActionSummaryRowProps) {
  const navigate = useNavigate();
  const styles = PRIORITY_STYLES[action.priority] || PRIORITY_STYLES.MEDIUM;
  const icon = ICON_MAP[action.icon] || <Zap size={14} />;
  const path = entityType === "lead" ? `/app/leads/${entityId}` : `/app/deals/${entityId}`;

  return (
    <button
      onClick={() => navigate(path)}
      className="w-full text-left p-3 hover:bg-gray-100 transition-colors flex items-center gap-3"
    >
      <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${styles.bg} ${styles.text}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">{entityName}</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 ${styles.badge}`}>
            {PRIORITY_LABELS[action.priority]}
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate">{action.action}</p>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-gray-400 flex-shrink-0">
        {entityType === "lead" ? "Lead" : "Deal"}
      </span>
    </button>
  );
}
