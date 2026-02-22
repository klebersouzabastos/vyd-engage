import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  MessageSquare,
  Mail,
  Search,
  Loader2,
  Inbox as InboxIcon,
  ArrowRight,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { apiClient } from "../services/api/client";

interface Conversation {
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  leadStatus: string;
  lastMessage: {
    id: string;
    type: "WHATSAPP" | "EMAIL" | string;
    direction: "INBOUND" | "OUTBOUND";
    content: string;
    createdAt: string;
  };
  messageCount: number;
  lastActivityAt: string;
}

export function Inbox() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");

  useEffect(() => {
    loadConversations();
  }, [channel]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const result = await apiClient.getInboxConversations({
        channel: channel !== "all" ? channel : undefined,
        search: search || undefined,
      });
      setConversations(result?.data?.conversations || []);
    } catch (error) {
      console.error("Erro ao carregar inbox:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadConversations();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Agora";
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString("pt-BR");
  };

  const truncateContent = (content: string, maxLen = 80) => {
    const cleaned = content.replace(/<[^>]*>/g, "").replace(/\n/g, " ").trim();
    return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + "..." : cleaned;
  };

  return (
    <div className="min-h-screen">
      <Header title="Inbox" subtitle="Todas as conversas em um só lugar" />

      <div className="p-8">
        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant={channel === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setChannel("all")}
            >
              Todos
            </Button>
            <Button
              variant={channel === "whatsapp" ? "default" : "outline"}
              size="sm"
              onClick={() => setChannel("whatsapp")}
              className={channel === "whatsapp" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <MessageSquare size={14} className="mr-1" />
              WhatsApp
            </Button>
            <Button
              variant={channel === "email" ? "default" : "outline"}
              size="sm"
              onClick={() => setChannel("email")}
              className={channel === "email" ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              <Mail size={14} className="mr-1" />
              Email
            </Button>
          </div>

          <div className="flex-1 max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Buscar por nome, email ou telefone..."
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Conversations List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-16">
            <InboxIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Inbox vazia</h3>
            <p className="text-gray-500">
              Quando mensagens forem enviadas ou recebidas, elas aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {conversations.map((conv) => (
              <div
                key={conv.leadId}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/app/leads/${conv.leadId}`)}
              >
                {/* Channel Icon */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                    ${conv.lastMessage.type === "WHATSAPP"
                      ? "bg-green-100 text-green-600"
                      : "bg-blue-100 text-blue-600"
                    }
                  `}
                >
                  {conv.lastMessage.type === "WHATSAPP" ? (
                    <MessageSquare size={18} />
                  ) : (
                    <Mail size={18} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-900 truncate">
                      {conv.leadName || conv.leadEmail || conv.leadPhone || "Sem nome"}
                    </h4>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {formatTime(conv.lastActivityAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {conv.lastMessage.direction === "OUTBOUND" ? (
                      <ArrowUp size={12} className="text-blue-500 flex-shrink-0" />
                    ) : (
                      <ArrowDown size={12} className="text-green-500 flex-shrink-0" />
                    )}
                    <p className="text-sm text-gray-600 truncate">
                      {truncateContent(conv.lastMessage.content)}
                    </p>
                  </div>
                </div>

                {/* Count Badge */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400">{conv.messageCount} msg</span>
                  <ArrowRight size={16} className="text-gray-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
