import { useState } from 'react';
import { Button } from '../ui/button';
import { FileText, Download, Copy, Clock, CheckCircle } from 'lucide-react';
import { BoletoPaymentData } from '../../types/payment';
import { copyToClipboard } from '../../utils/reportSharing';

interface BoletoPaymentProps {
  boletoData: BoletoPaymentData;
  onCheckStatus: () => void;
  isLoading?: boolean;
}

export function BoletoPayment({
  boletoData,
  onCheckStatus,
  isLoading = false,
}: BoletoPaymentProps) {
  const [copied, setCopied] = useState(false);

  const formatExpirationDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleCopyBarcode = async () => {
    if (boletoData.barcode) {
      try {
        await copyToClipboard(boletoData.barcode.replace(/\D/g, ''));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Erro ao copiar código de barras:', error);
      }
    }
  };

  const handleCopyDigitableLine = async () => {
    if (boletoData.digitableLine) {
      try {
        await copyToClipboard(boletoData.digitableLine);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Erro ao copiar linha digitável:', error);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={16} className="text-yellow-600" />
          <p className="text-sm font-medium text-yellow-900">
            Vencimento: {formatExpirationDate(boletoData.expiresAt)}
          </p>
        </div>
        <p className="text-xs text-yellow-800">
          Pague o boleto até a data de vencimento. A aprovação pode levar até 3 dias úteis após o
          pagamento.
        </p>
      </div>

      {boletoData.digitableLine && (
        <div>
          <Label className="text-sm mb-2 block">Linha Digitável</Label>
          <div className="flex gap-2">
            <Input value={boletoData.digitableLine} readOnly className="flex-1 font-mono text-sm" />
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyDigitableLine}
              disabled={copied}
            >
              {copied ? <CheckCircle size={16} className="text-green-600" /> : <Copy size={16} />}
            </Button>
          </div>
        </div>
      )}

      {boletoData.barcode && (
        <div>
          <Label className="text-sm mb-2 block">Código de Barras</Label>
          <div className="flex gap-2">
            <Input value={boletoData.barcode} readOnly className="flex-1 font-mono text-sm" />
            <Button type="button" variant="outline" onClick={handleCopyBarcode} disabled={copied}>
              {copied ? <CheckCircle size={16} className="text-green-600" /> : <Copy size={16} />}
            </Button>
          </div>
        </div>
      )}

      {boletoData.pdfUrl && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => window.open(boletoData.pdfUrl, '_blank')}
        >
          <Download size={16} className="mr-2" />
          Baixar Boleto (PDF)
        </Button>
      )}

      <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
        <div className="flex items-start gap-3">
          <FileText size={20} className="text-gray-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 mb-1">Como pagar o boleto</h4>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Copie a linha digitável ou código de barras</li>
              <li>Acesse seu banco ou aplicativo de pagamento</li>
              <li>Cole o código e confirme o pagamento</li>
              <li>Aguarde a confirmação (até 3 dias úteis)</li>
            </ol>
          </div>
        </div>
      </div>

      <Button
        onClick={onCheckStatus}
        disabled={isLoading}
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
