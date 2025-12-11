import { useState } from "react";
import { WhatsAppConnection, WhatsAppMessage } from "../../types/whatsapp";
import { DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { ConnectionStatusBadge } from "./ConnectionStatusBadge";
import { Send, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";
import { sendMessage, formatPhoneNumber, isValidPhoneNumber } from "../../utils/whatsapp/whatsappAdapter";

interface TestMessageModalProps {
  connection: WhatsAppConnection;
  onTest?: () => void;
}

export function TestMessageModal({ connection, onTest }: TestMessageModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("Mensagem de teste do FlowCRM");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSend = async () => {
    if (!phoneNumber.trim()) {
      setResult({ success: false, message: "Por favor, informe um número de telefone" });
      return;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      setResult({ success: false, message: "Número de telefone inválido" });
      return;
    }

    if (!message.trim()) {
      setResult({ success: false, message: "Por favor, informe uma mensagem" });
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const whatsappMessage: WhatsAppMessage = {
        to: formattedPhone,
        message: message,
        connectionId: connection.id,
      };

      const sendResult = await sendMessage(connection, whatsappMessage);

      if (sendResult.success) {
        setResult({
          success: true,
          message: `Mensagem enviada com sucesso! ID: ${sendResult.messageId || "N/A"}`,
        });
        if (onTest) {
          onTest();
        }
      } else {
        setResult({
          success: false,
          message: sendResult.error || "Erro ao enviar mensagem",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Erro desconhecido ao enviar mensagem",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Testar Conexão - {connection.name}</DialogTitle>
        <DialogDescription>
          Envie uma mensagem de teste para verificar se a conexão está funcionando
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <ConnectionStatusBadge status={connection.status} />

        {connection.status.status === "disconnected" && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta conexão está desconectada. Conecte antes de testar o envio de mensagens.
            </AlertDescription>
          </Alert>
        )}

        <div>
          <Label htmlFor="test-phone">Número de Telefone *</Label>
          <Input
            id="test-phone"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="11999999999 ou +5511999999999"
            className="mt-1.5"
            disabled={isSending}
          />
          <p className="text-xs text-[#6B7280] mt-1">
            Digite o número com DDD (ex: 11999999999) ou formato internacional
          </p>
        </div>

        <div>
          <Label htmlFor="test-message">Mensagem *</Label>
          <Textarea
            id="test-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua mensagem de teste"
            className="mt-1.5"
            rows={4}
            disabled={isSending}
          />
        </div>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2 pt-4 border-t border-[#E5E7EB]">
          <Button
            onClick={handleSend}
            disabled={isSending || connection.status.status === "disconnected"}
            className="flex-1 bg-[#2563EB] hover:bg-[#1E40AF]"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Mensagem de Teste
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}







