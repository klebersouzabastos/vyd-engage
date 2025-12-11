import { useState, useEffect } from "react";
import { WhatsAppConnection } from "../../types/whatsapp";
import { DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { ConnectionStatusBadge } from "./ConnectionStatusBadge";
import { RefreshCw, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";
import { getBaileysQRCode, startBaileysConnection } from "../../utils/whatsapp/baileysApi";
import { getEvolutionQRCode } from "../../utils/whatsapp/evolutionApi";

interface QRCodeModalProps {
  connection: WhatsAppConnection;
}

export function QRCodeModal({ connection }: QRCodeModalProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const fetchQRCode = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let result;
      
      if (connection.provider === "baileys") {
        result = await getBaileysQRCode(connection.config as any);
        if (!result) {
          // Tentar iniciar conexão se não houver QR code
          result = await startBaileysConnection(connection.config as any);
        }
      } else if (connection.provider === "evolution") {
        result = await getEvolutionQRCode(connection.config as any);
      } else {
        setError("QR Code não disponível para este tipo de provedor");
        setIsLoading(false);
        return;
      }

      if (result) {
        setQrCode(result.qrCode);
        setExpiresAt(result.expiresAt);
      } else {
        setError("Não foi possível obter o QR Code. Verifique se a instância está configurada corretamente.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao obter QR Code");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQRCode();
  }, []);

  const isExpired = expiresAt && new Date(expiresAt) < new Date();

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>QR Code - {connection.name}</DialogTitle>
        <DialogDescription>
          Escaneie este QR Code com o WhatsApp para conectar sua conta
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <ConnectionStatusBadge status={connection.status} />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isExpired && qrCode && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Este QR Code expirou. Clique em "Atualizar QR Code" para gerar um novo.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col items-center justify-center p-6 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-[#2563EB]" />
              <p className="text-sm text-[#6B7280]">Gerando QR Code...</p>
            </div>
          ) : qrCode ? (
            <>
              <img
                src={qrCode}
                alt="QR Code WhatsApp"
                className="w-64 h-64 border-2 border-white rounded-lg shadow-lg"
              />
              <p className="text-sm text-[#6B7280] mt-4 text-center max-w-sm">
                1. Abra o WhatsApp no seu celular<br />
                2. Vá em Configurações → Aparelhos conectados<br />
                3. Toque em "Conectar um aparelho"<br />
                4. Escaneie este QR Code
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="h-12 w-12 text-[#6B7280]" />
              <p className="text-sm text-[#6B7280]">
                Não foi possível gerar o QR Code
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={fetchQRCode}
            disabled={isLoading}
            variant="outline"
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar QR Code
              </>
            )}
          </Button>
        </div>

        {expiresAt && !isExpired && (
          <p className="text-xs text-center text-[#6B7280]">
            QR Code expira em: {new Date(expiresAt).toLocaleString("pt-BR")}
          </p>
        )}
      </div>
    </div>
  );
}







