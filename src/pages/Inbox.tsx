import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '../components/Header';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import {
  MessageSquare,
  Mail,
  Search,
  Loader2,
  Inbox as InboxIcon,
  ArrowUp,
  ArrowDown,
  Send,
  Phone,
  User,
  X,
  RefreshCw,
  Check,
  CheckCheck,
  Paperclip,
  Image,
} from 'lucide-react';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';
import { EmailFormatToolbar, useEmailFormatter } from '../components/email/EmailFormatToolbar';
import { ScreenRibbon } from '@/contexts/RibbonContext';

interface Conversation {
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  leadStatus: string;
  lastMessage: {
    id: string;
    type: 'WHATSAPP' | 'EMAIL' | string;
    direction: 'INBOUND' | 'OUTBOUND';
    content: string;
    createdAt: string;
  };
  messageCount: number;
  lastActivityAt: string;
}

interface InteractionMessage {
  id: string;
  type: 'WHATSAPP' | 'EMAIL' | 'CALL' | 'MEETING' | 'NOTE' | string;
  direction: 'INBOUND' | 'OUTBOUND';
  subject?: string;
  content: string;
  metadata?: any;
  createdAt: string;
  userId?: string;
}

export function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('all');
  const [selectedLead, setSelectedLead] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<InteractionMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [composeMessage, setComposeMessage] = useState('');
  const [composeChannel, setComposeChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [composeSubject, setComposeSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [whatsappConnectionId, setWhatsappConnectionId] = useState<string | null>(null);
  const [emailConfigId, setEmailConfigId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composeTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleEmailFormat = useEmailFormatter(
    () => composeMessage,
    setComposeMessage,
    composeTextareaRef
  );

  // Load available WhatsApp connections and Email configs
  useEffect(() => {
    apiClient
      .getWhatsAppConnections()
      .then((result) => {
        const conns = result?.data || result || [];
        const connected = conns.find((c: any) => c.status === 'CONNECTED') || conns[0];
        if (connected) setWhatsappConnectionId(connected.id);
      })
      .catch(() => {});
    apiClient
      .getEmailConfigs()
      .then((result) => {
        const configs = result?.data || result || [];
        const verified = configs.find((c: any) => c.isVerified) || configs[0];
        if (verified) setEmailConfigId(verified.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadConversations();
  }, [channel]);

  useEffect(() => {
    if (selectedLead) {
      loadMessages(selectedLead.leadId);
      // Auto-detect preferred channel
      if (selectedLead.lastMessage?.type === 'WHATSAPP' && selectedLead.leadPhone) {
        setComposeChannel('whatsapp');
      } else if (selectedLead.lastMessage?.type === 'EMAIL' && selectedLead.leadEmail) {
        setComposeChannel('email');
      }
    }
  }, [selectedLead?.leadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    setLoading(true);
    try {
      const result = await apiClient.getInboxConversations({
        channel: channel !== 'all' ? channel : undefined,
        search: search || undefined,
      });
      setConversations(result?.data?.conversations || []);
    } catch (error) {
      console.error('Erro ao carregar inbox:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (leadId: string) => {
    setLoadingMessages(true);
    try {
      const result = await apiClient.getLeadInteractions(leadId);
      const msgs = (result?.data || result || []) as InteractionMessage[];
      // Sort ascending (oldest first)
      msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(msgs);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    if (selectedLead) {
      await loadMessages(selectedLead.leadId);
    }
    setRefreshing(false);
  };

  const handleSearch = () => {
    loadConversations();
  };

  const handleSendMessage = useCallback(async () => {
    if (!selectedLead || !composeMessage.trim()) return;

    setSending(true);
    try {
      if (composeChannel === 'whatsapp') {
        if (!selectedLead.leadPhone) {
          toast.error('Lead não possui telefone cadastrado');
          setSending(false);
          return;
        }

        if (whatsappConnectionId) {
          // Send via real WhatsApp API
          const msgType = attachedFile?.type.startsWith('image/')
            ? 'image'
            : attachedFile
              ? 'document'
              : 'text';
          await apiClient.sendWhatsAppMessage({
            connectionId: whatsappConnectionId,
            to: selectedLead.leadPhone,
            type: msgType,
            content: composeMessage || (attachedFile ? attachedFile.name : ''),
            leadId: selectedLead.leadId,
          });
          toast.success(attachedFile ? 'Mensagem com anexo enviada' : 'Mensagem WhatsApp enviada');
        } else {
          // Fallback: record interaction only
          await apiClient.createInteraction({
            leadId: selectedLead.leadId,
            type: 'WHATSAPP',
            direction: 'OUTBOUND',
            content: composeMessage,
          });
          toast.success('Mensagem registrada (sem conexão WhatsApp ativa)');
        }
      } else {
        if (!selectedLead.leadEmail) {
          toast.error('Lead não possui email cadastrado');
          setSending(false);
          return;
        }

        if (emailConfigId) {
          // Send via real Email API
          await apiClient.sendEmail({
            configId: emailConfigId,
            to: selectedLead.leadEmail,
            subject: composeSubject || 'Sem assunto',
            html: composeMessage,
            leadId: selectedLead.leadId,
          });
          toast.success('Email enviado');
        } else {
          // Fallback: record interaction only
          await apiClient.createInteraction({
            leadId: selectedLead.leadId,
            type: 'EMAIL',
            direction: 'OUTBOUND',
            subject: composeSubject || 'Sem assunto',
            content: composeMessage,
          });
          toast.success('Email registrado (sem configuração de email ativa)');
        }
      }

      setComposeMessage('');
      setComposeSubject('');
      setAttachedFile(null);
      await loadMessages(selectedLead.leadId);
      loadConversations();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  }, [
    selectedLead,
    composeMessage,
    composeChannel,
    composeSubject,
    whatsappConnectionId,
    emailConfigId,
    attachedFile,
  ]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('pt-BR');
  };

  const formatMessageTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateContent = (content: string, maxLen = 60) => {
    const cleaned = content
      .replace(/<[^>]*>/g, '')
      .replace(/\n/g, ' ')
      .trim();
    return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '...' : cleaned;
  };

  const getChannelIcon = (type: string) => {
    if (type === 'WHATSAPP') return <MessageSquare size={14} className="text-green-600" />;
    if (type === 'EMAIL') return <Mail size={14} className="text-blue-600" />;
    if (type === 'CALL') return <Phone size={14} className="text-orange-600" />;
    return <MessageSquare size={14} className="text-gray-400" />;
  };

  const getChannelColor = (type: string) => {
    if (type === 'WHATSAPP') return 'bg-green-100 text-green-600';
    if (type === 'EMAIL') return 'bg-blue-100 text-blue-600';
    if (type === 'CALL') return 'bg-orange-100 text-orange-600';
    return 'bg-gray-100 text-gray-600';
  };

  const getDeliveryStatus = (msg: InteractionMessage) => {
    if (msg.direction !== 'OUTBOUND') return null;
    const status = msg.metadata?.deliveryStatus || msg.metadata?.status;
    if (status === 'read' || status === 'READ') {
      return <CheckCheck size={12} className="text-blue-400" title="Lido" />;
    }
    if (status === 'delivered' || status === 'DELIVERED') {
      return <CheckCheck size={12} className="text-white/60" title="Entregue" />;
    }
    if (status === 'failed' || status === 'FAILED') {
      return <X size={12} className="text-red-400" title="Falhou" />;
    }
    // Default: sent
    return <Check size={12} className="text-white/60" title="Enviado" />;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) {
        toast.error('Arquivo muito grande (max 16MB)');
        return;
      }
      setAttachedFile(file);
    }
  };

  const getFilePreview = () => {
    if (!attachedFile) return null;
    const isImage = attachedFile.type.startsWith('image/');
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm mb-2">
        {isImage ? (
          <Image size={14} className="text-green-600" />
        ) : (
          <Paperclip size={14} className="text-blue-600" />
        )}
        <span className="truncate flex-1 text-gray-700">{attachedFile.name}</span>
        <span className="text-xs text-gray-400">{(attachedFile.size / 1024).toFixed(0)}KB</span>
        <button onClick={() => setAttachedFile(null)} className="p-0.5 hover:bg-gray-200 rounded">
          <X size={12} className="text-gray-500" />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ScreenRibbon
        groups={[
          {
            label: 'Inbox',
            items: [
              {
                icon: RefreshCw,
                label: 'Atualizar',
                onClick: handleRefresh,
                disabled: refreshing,
              },
            ],
          },
        ]}
      />
      <Header title="Inbox" subtitle="Todas as conversas em um só lugar" />

      <div className="flex-1 flex overflow-hidden h-[calc(100vh-80px)]">
        {/* Left Panel - Conversation List */}
        <div className="w-full md:w-96 lg:w-[420px] border-r border-gray-200 flex flex-col bg-card flex-shrink-0">
          {/* Filters */}
          <div className="p-3 border-b border-gray-200 space-y-2">
            <div className="flex items-center gap-1">
              <Button
                variant={channel === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChannel('all')}
                className="h-7 text-xs"
              >
                Todos
              </Button>
              <Button
                variant={channel === 'whatsapp' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChannel('whatsapp')}
                className={`h-7 text-xs ${channel === 'whatsapp' ? 'bg-green-600 hover:bg-green-700' : ''}`}
              >
                <MessageSquare size={12} className="mr-1" />
                WhatsApp
              </Button>
              <Button
                variant={channel === 'email' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChannel('email')}
                className={`h-7 text-xs ${channel === 'email' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
              >
                <Mail size={12} className="mr-1" />
                Email
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Buscar conversa..."
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-16 px-4">
                <InboxIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.leadId}
                  role="button"
                  tabIndex={0}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-100 ${
                    selectedLead?.leadId === conv.leadId
                      ? 'bg-primary/5 border-l-2 border-l-primary'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedLead(conv)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if (e.key === ' ') e.preventDefault();
                      setSelectedLead(conv);
                    }
                  }}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${getChannelColor(conv.lastMessage.type)}`}
                  >
                    {conv.lastMessage.type === 'WHATSAPP' ? (
                      <MessageSquare size={16} />
                    ) : (
                      <Mail size={16} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="font-medium text-sm text-gray-900 truncate">
                        {conv.leadName || conv.leadEmail || conv.leadPhone || 'Sem nome'}
                      </h4>
                      <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
                        {formatTime(conv.lastActivityAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {conv.lastMessage.direction === 'OUTBOUND' ? (
                        <ArrowUp size={11} className="text-blue-400 flex-shrink-0" />
                      ) : (
                        <ArrowDown size={11} className="text-green-400 flex-shrink-0" />
                      )}
                      <p className="text-xs text-gray-500 truncate">
                        {truncateContent(conv.lastMessage.content)}
                      </p>
                    </div>
                  </div>
                  {conv.messageCount > 1 && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5 flex-shrink-0">
                      {conv.messageCount}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Conversation Thread */}
        <div className="hidden md:flex flex-1 flex-col bg-gray-50">
          {!selectedLead ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <InboxIcon className="h-16 w-16 mx-auto mb-4 text-gray-200" />
                <h3 className="text-lg font-medium text-gray-400 mb-1">Selecione uma conversa</h3>
                <p className="text-sm text-gray-400">
                  Escolha uma conversa na lista para visualizar as mensagens
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="bg-card border-b border-gray-200 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedLead.leadName || 'Sem nome'}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {selectedLead.leadEmail && (
                        <span className="flex items-center gap-1">
                          <Mail size={10} /> {selectedLead.leadEmail}
                        </span>
                      )}
                      {selectedLead.leadPhone && (
                        <span className="flex items-center gap-1">
                          <Phone size={10} /> {selectedLead.leadPhone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLead(null)}
                  className="md:hidden"
                >
                  <X size={16} />
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-sm text-gray-400">
                      Nenhuma mensagem ainda. Envie a primeira!
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => {
                      const isOutbound = msg.direction === 'OUTBOUND';
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                              isOutbound
                                ? 'bg-primary text-white rounded-br-md'
                                : 'bg-card text-gray-900 border border-gray-200 rounded-bl-md'
                            }`}
                          >
                            {msg.subject && (
                              <p
                                className={`text-xs font-medium mb-1 ${isOutbound ? 'text-white/80' : 'text-gray-500'}`}
                              >
                                {msg.subject}
                              </p>
                            )}
                            {msg.metadata?.mediaUrl &&
                              msg.metadata?.mediaType?.startsWith('image') && (
                                <img
                                  src={msg.metadata.mediaUrl}
                                  alt="Imagem anexada"
                                  className="rounded-lg max-w-full max-h-48 mb-2"
                                  loading="lazy"
                                  decoding="async"
                                />
                              )}
                            {msg.metadata?.mediaUrl &&
                              !msg.metadata?.mediaType?.startsWith('image') && (
                                <a
                                  href={msg.metadata.mediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-1.5 text-xs mb-2 underline ${isOutbound ? 'text-white/80' : 'text-blue-600'}`}
                                >
                                  <Paperclip size={12} /> {msg.metadata.fileName || 'Arquivo anexo'}
                                </a>
                              )}
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.content.replace(/<[^>]*>/g, '')}
                            </p>
                            <div
                              className={`flex items-center gap-1.5 mt-1.5 ${isOutbound ? 'justify-end' : 'justify-start'}`}
                            >
                              {getChannelIcon(msg.type)}
                              <span
                                className={`text-[10px] ${isOutbound ? 'text-white/60' : 'text-gray-400'}`}
                              >
                                {formatMessageTime(msg.createdAt)}
                              </span>
                              {isOutbound && getDeliveryStatus(msg)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Compose */}
              <div className="bg-card border-t border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setComposeChannel('whatsapp')}
                    disabled={!selectedLead.leadPhone}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      composeChannel === 'whatsapp'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    } ${!selectedLead.leadPhone ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <MessageSquare size={12} /> WhatsApp
                  </button>
                  <button
                    onClick={() => setComposeChannel('email')}
                    disabled={!selectedLead.leadEmail}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      composeChannel === 'email'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    } ${!selectedLead.leadEmail ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <Mail size={12} /> Email
                  </button>
                </div>
                {composeChannel === 'email' && (
                  <Input
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Assunto do email..."
                    className="mb-2 h-8 text-sm"
                  />
                )}
                {getFilePreview()}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {composeChannel === 'email' && <EmailFormatToolbar onFormat={handleEmailFormat} />}
                <div className="flex items-end gap-2">
                  {composeChannel === 'whatsapp' && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
                      title="Anexar arquivo"
                    >
                      <Paperclip size={18} />
                    </button>
                  )}
                  <Textarea
                    ref={composeTextareaRef as any}
                    value={composeMessage}
                    onChange={(e) => setComposeMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={
                      composeChannel === 'whatsapp'
                        ? 'Digite sua mensagem WhatsApp...'
                        : 'Digite seu email (HTML suportado)...'
                    }
                    className={`flex-1 min-h-[40px] max-h-[120px] text-sm resize-none ${composeChannel === 'email' ? 'rounded-t-none font-mono' : ''}`}
                    rows={1}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={sending || !composeMessage.trim()}
                    className="bg-primary hover:bg-primary-dark h-10 w-10 p-0 flex-shrink-0"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </Button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Enter para enviar, Shift+Enter para nova linha
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
