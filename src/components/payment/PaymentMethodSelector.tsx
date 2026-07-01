import { CreditCard, QrCode, FileText } from 'lucide-react';
import { PaymentMethod } from '../../types/payment';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onSelectMethod: (method: PaymentMethod) => void;
  disabled?: boolean;
}

export function PaymentMethodSelector({
  selectedMethod,
  onSelectMethod,
  disabled = false,
}: PaymentMethodSelectorProps) {
  const methods: Array<{
    id: PaymentMethod;
    label: string;
    icon: typeof CreditCard;
    description: string;
  }> = [
    {
      id: 'credit_card',
      label: 'Cartão de Crédito',
      icon: CreditCard,
      description: 'Aprovação imediata',
    },
    {
      id: 'pix',
      label: 'PIX',
      icon: QrCode,
      description: 'Aprovação em até 30 minutos',
    },
    {
      id: 'boleto',
      label: 'Boleto',
      icon: FileText,
      description: 'Aprovação em até 3 dias úteis',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {methods.map((method) => {
        const Icon = method.icon;
        const isSelected = selectedMethod === method.id;

        return (
          <button
            key={method.id}
            type="button"
            onClick={() => !disabled && onSelectMethod(method.id)}
            disabled={disabled}
            className={cn(
              'p-4 rounded-lg border-2 transition-all text-left',
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 bg-card hover:border-primary/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn('p-2 rounded-lg', isSelected ? 'bg-primary' : 'bg-gray-200')}>
                <Icon size={20} className={isSelected ? 'text-white' : 'text-gray-600'} />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">{method.label}</h4>
                <p className="text-xs text-gray-600">{method.description}</p>
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-card"></div>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
