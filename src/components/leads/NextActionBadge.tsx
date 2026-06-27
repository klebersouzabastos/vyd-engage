import { useEffect, useState } from 'react';
import {
  PhoneOutgoing,
  MessageCircle,
  Mail,
  Calendar,
  Handshake,
  RefreshCw,
  FileText,
  CheckCircle,
  Phone,
  Zap,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { apiClient } from '../../services/api/client';
import { useAIStatus } from '../../hooks/useAIStatus';
import type { NextAction } from '../../types';

interface NextActionBadgeProps {
  leadId: string;
  /**
   * "badge" (default) renders a labelled pill for the detail page; "icon"
   * renders a compact icon-only chip suited to a dense list row.
   */
  variant?: 'badge' | 'icon';
}

/**
 * Maps the action enum (CALL, EMAIL, WHATSAPP, MEETING, FOLLOW_UP, DEMO,
 * PROPOSAL, CLOSE — spec req 12) and the server `icon` hint to an icon.
 */
const ACTION_ICONS: Record<string, React.ReactNode> = {
  CALL: <PhoneOutgoing size={14} />,
  EMAIL: <Mail size={14} />,
  WHATSAPP: <MessageCircle size={14} />,
  MEETING: <Calendar size={14} />,
  FOLLOW_UP: <RefreshCw size={14} />,
  DEMO: <Zap size={14} />,
  PROPOSAL: <FileText size={14} />,
  CLOSE: <Handshake size={14} />,
};

const ICON_HINTS: Record<string, React.ReactNode> = {
  'phone-outgoing': <PhoneOutgoing size={14} />,
  phone: <Phone size={14} />,
  'message-circle': <MessageCircle size={14} />,
  mail: <Mail size={14} />,
  calendar: <Calendar size={14} />,
  handshake: <Handshake size={14} />,
  'refresh-cw': <RefreshCw size={14} />,
  'check-circle': <CheckCircle size={14} />,
};

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 border-red-200',
  MEDIUM: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  LOW: 'bg-green-50 text-green-700 border-green-200',
};

function resolveIcon(action: NextAction): React.ReactNode {
  return (
    ACTION_ICONS[action.action?.toUpperCase?.()] || ICON_HINTS[action.icon] || <Zap size={14} />
  );
}

/**
 * Next-action suggestion with its justification (spec AI-1.2, reqs 11 & 16).
 * Shows the action icon plus a tooltip carrying the `reasoning`. Rendered both
 * on the Lead detail page and in the leads list. Hidden (and makes no AI call)
 * when the AI provider is not configured (req 33).
 */
export function NextActionBadge({ leadId, variant = 'badge' }: NextActionBadgeProps) {
  const { enabled } = useAIStatus();
  const [action, setAction] = useState<NextAction | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await apiClient.getLeadNextAction(leadId);
        if (!cancelled) setAction(result.data);
      } catch {
        // Silent fail — badge just won't render (errors handled in cards/panels).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, leadId]);

  // AI disabled (req 33) or nothing to show yet: render nothing inline.
  if (!enabled || !action) return null;

  // The justification: prefer the AI `reasoning` (req 10), fall back to `reason`.
  const reasoning = action.reasoning || action.reason;
  const styles = PRIORITY_STYLES[action.priority] || PRIORITY_STYLES.MEDIUM;
  const icon = resolveIcon(action);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium cursor-default ${styles}`}
        >
          {icon}
          {variant === 'badge' && <span className="truncate max-w-[180px]">{action.action}</span>}
          <span className="sr-only">Próxima ação sugerida por IA: {action.action}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-semibold mb-0.5">{action.action}</p>
        {reasoning && <p className="font-normal opacity-90">{reasoning}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
