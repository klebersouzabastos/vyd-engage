import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, AlertTriangle, Info } from 'lucide-react';
import { apiClient, ApiError } from '../../services/api/client';
import { useAIStatus } from '../../hooks/useAIStatus';
import type { ChatMessage } from '../../types';

interface AIChatPanelProps {
  leadId: string;
}

/** Max prior turns sent to the backend to cap payload size (edge case). */
const MAX_HISTORY_SENT = 10;

function storageKey(leadId: string): string {
  return `ai-chat:${leadId}`;
}

/** Loads session history for a lead, or [] if absent/corrupt. */
function loadHistory(leadId: string): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(storageKey(leadId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(leadId: string, messages: ChatMessage[]): void {
  try {
    sessionStorage.setItem(storageKey(leadId), JSON.stringify(messages));
  } catch {
    // Quota / unavailable — degrade silently; chat still works in-memory.
  }
}

/**
 * "Chat IA" side panel on the Lead detail page (spec AI-2.2, reqs 24-29 & 31).
 *
 * - Streams the answer via a manual fetch + ReadableStream reader, appending
 *   decoded text chunks progressively (req 29 / 31).
 * - Keeps conversation history in sessionStorage so it survives navigation but
 *   is cleared when the tab closes (req 27).
 * - Shows a permanent "respostas geradas por IA, podem conter erros" disclaimer
 *   (req 28).
 * - On a mid-stream connection loss, keeps the partial answer and flags the
 *   interruption (edge case).
 * - Hidden entirely when AI is not configured (req 33).
 */
export function AIChatPanel({ leadId }: AIChatPanelProps) {
  const { enabled, loading: statusLoading } = useAIStatus();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  /** Live partial answer being streamed (not yet committed to `messages`). */
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Set when a stream was cut short by a connection loss. */
  const [interrupted, setInterrupted] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load session history when the lead changes.
  useEffect(() => {
    setMessages(loadHistory(leadId));
    setPartial('');
    setError(null);
    setInterrupted(false);
  }, [leadId]);

  // Persist history whenever committed messages change.
  useEffect(() => {
    saveHistory(leadId, messages);
  }, [leadId, messages]);

  // Auto-scroll to the newest content.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, partial]);

  // Abort any in-flight stream on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    setError(null);
    setInterrupted(false);

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setStreaming(true);
    setPartial('');

    const controller = new AbortController();
    abortRef.current = controller;

    // Truncate history sent to the backend to avoid oversized payloads (edge case).
    const historyToSend = nextMessages.slice(-MAX_HISTORY_SENT);

    let accumulated = '';
    try {
      const response = await apiClient.streamLeadAIChat(
        leadId,
        { message: trimmed, history: historyToSend },
        controller.signal
      );

      if (!response.ok) {
        if (response.status === 429) {
          setError('Limite atingido, tente em instantes.');
        } else if (response.status === 503) {
          setError('O assistente de IA está indisponível no momento.');
        } else {
          setError('Não foi possível obter a resposta. Tente novamente.');
        }
        setStreaming(false);
        return;
      }

      if (!response.body) {
        setError('Resposta vazia do servidor.');
        setStreaming(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Read the raw text stream chunk by chunk and append progressively.

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setPartial(accumulated);
      }
      accumulated += decoder.decode();
      setPartial(accumulated);
    } catch (err) {
      // Connection lost mid-stream (or aborted): keep whatever we received and
      // flag the interruption instead of discarding it (edge case).
      if (err instanceof ApiError && err.statusCode === 429) {
        setError('Limite atingido, tente em instantes.');
      } else if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setInterrupted(true);
      }
    } finally {
      // Commit the (possibly partial) answer to history so it persists.
      if (accumulated) {
        setMessages((prev) => [...prev, { role: 'assistant', content: accumulated }]);
      }
      setPartial('');
      setStreaming(false);
      abortRef.current = null;
    }
  };

  // Resolving gate — render nothing to avoid a flash.
  if (statusLoading) return null;

  // AI disabled (req 33): show setup guidance, make no calls.
  if (!enabled) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Chat IA</span>
        </div>
        <p className="text-xs text-gray-500">
          Configure um provedor de IA (variável <code className="font-mono">AI_PROVIDER</code>) para
          conversar sobre este lead.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border border-purple-200 flex flex-col h-[28rem]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-purple-50/60 rounded-t-lg">
        <Sparkles size={16} className="text-purple-500" />
        <span className="text-sm font-semibold text-gray-900">Chat IA</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-700">
          IA
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !partial && (
          <div className="text-center text-gray-400 text-xs py-8">
            <p>Pergunte algo sobre este lead.</p>
            <p className="mt-1">Ex: "Quando foi o último contato?"</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Live streaming answer */}
        {partial && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap bg-gray-100 text-gray-800">
              {partial}
              <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-gray-400 animate-pulse" />
            </div>
          </div>
        )}

        {streaming && !partial && (
          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <Loader2 size={14} className="animate-spin" />
            <span>Gerando resposta...</span>
          </div>
        )}

        {interrupted && (
          <div className="flex items-center gap-2 text-amber-600 text-xs">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>Transmissão interrompida. A resposta pode estar incompleta.</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-xs">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Disclaimer (req 28) */}
      <div className="flex items-center gap-1.5 px-4 py-1.5 border-t border-gray-100 text-[11px] text-gray-400">
        <Info size={12} className="flex-shrink-0" />
        <span>Respostas geradas por IA, podem conter erros.</span>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-gray-200">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Pergunte sobre este lead..."
          disabled={streaming}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={streaming || !input.trim()}
          className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
          aria-label="Enviar pergunta"
        >
          {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
