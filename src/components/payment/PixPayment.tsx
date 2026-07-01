import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { QrCode, Copy, CheckCircle, Clock } from 'lucide-react';
import { PixPaymentData } from '../../types/payment';
import { copyToClipboard } from '../../utils/reportSharing';

interface PixPaymentProps {
  pixData: PixPaymentData;
  onCheckStatus: () => void;
  isLoading?: boolean;
}

export function PixPayment({ pixData, onCheckStatus, isLoading = false }: PixPaymentProps) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (pixData.expiresAt) {
      const calculateTimeLeft = () => {
        const expires = new Date(pixData.expiresAt!).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expires - now) / 1000));
        setTimeLeft(diff);
      };

      calculateTimeLeft();
      const interval = setInterval(calculateTimeLeft, 1000);

      return () => clearInterval(interval);
    }
  }, [pixData.expiresAt]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyPix = async () => {
    if (pixData.copyPaste) {
      try {
        await copyToClipboard(pixData.copyPaste);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Erro ao copiar PIX:', error);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={16} className="text-blue-600" />
          <p className="text-sm font-medium text-blue-900">
            {timeLeft !== null && timeLeft > 0
              ? `Expira em ${formatTime(timeLeft)}`
              : 'QR Code expirado'}
          </p>
        </div>
        <p className="text-xs text-blue-800">
          Escaneie o QR Code ou copie o código PIX para pagar. O pagamento será aprovado
          automaticamente em até 30 minutos.
        </p>
      </div>

      {pixData.qrCodeBase64 && (
        <div className="flex justify-center p-4 bg-card border border-gray-300 rounded-lg">
          <img
            src={`data:image/png;base64,${pixData.qrCodeBase64}`}
            alt="QR Code PIX"
            className="w-64 h-64"
            width={256}
            height={256}
            loading="lazy"
            decoding="async"
          />
        </div>
      )}

      {pixData.qrCode && !pixData.qrCodeBase64 && (
        <div className="flex justify-center p-4 bg-card border border-gray-300 rounded-lg">
          <div className="w-64 h-64 bg-gray-200 rounded-lg flex items-center justify-center">
            <QrCode size={64} className="text-gray-400" />
          </div>
        </div>
      )}

      {pixData.copyPaste && (
        <div>
          <Label className="text-sm mb-2 block">Código PIX (Copiar e Colar)</Label>
          <div className="flex gap-2">
            <Input value={pixData.copyPaste} readOnly className="flex-1 font-mono text-sm" />
            <Button type="button" variant="outline" onClick={handleCopyPix} disabled={copied}>
              {copied ? <CheckCircle size={16} className="text-green-600" /> : <Copy size={16} />}
            </Button>
          </div>
        </div>
      )}

      <Button
        onClick={onCheckStatus}
        disabled={isLoading || (timeLeft !== null && timeLeft === 0)}
        className="w-full bg-primary hover:bg-primary-dark"
      >
        {isLoading ? 'Verificando...' : 'Verificar Pagamento'}
      </Button>
    </div>
  );
}

// Adicionar imports necessários
import { Label } from '../ui/label';
import { Input } from '../ui/input';
