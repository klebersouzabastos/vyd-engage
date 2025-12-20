import { useState } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { CreditCardData } from "../../types/payment";
import { CreditCard, Lock } from "lucide-react";

interface CreditCardFormProps {
  onSubmit: (data: CreditCardData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CreditCardForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: CreditCardFormProps) {
  const [formData, setFormData] = useState<CreditCardData>({
    cardNumber: "",
    cardHolderName: "",
    expirationMonth: "",
    expirationYear: "",
    securityCode: "",
    installments: 1,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreditCardData, string>>>({});

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, "");
    const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
    return formatted.slice(0, 19); // Máximo 16 dígitos + 3 espaços
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setFormData({ ...formData, cardNumber: formatted });
    if (errors.cardNumber) {
      setErrors({ ...errors, cardNumber: undefined });
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CreditCardData, string>> = {};

    if (!formData.cardNumber || formData.cardNumber.replace(/\s/g, "").length < 13) {
      newErrors.cardNumber = "Número do cartão inválido";
    }

    if (!formData.cardHolderName || formData.cardHolderName.length < 3) {
      newErrors.cardHolderName = "Nome do portador é obrigatório";
    }

    if (!formData.expirationMonth || !formData.expirationYear) {
      newErrors.expirationMonth = "Data de validade é obrigatória";
    }

    if (!formData.securityCode || formData.securityCode.length < 3) {
      newErrors.securityCode = "CVV inválido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return month.toString().padStart(2, "0");
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="cardNumber">Número do Cartão</Label>
        <Input
          id="cardNumber"
          type="text"
          placeholder="0000 0000 0000 0000"
          value={formData.cardNumber}
          onChange={handleCardNumberChange}
          maxLength={19}
          className="mt-1.5"
          disabled={isLoading}
        />
        {errors.cardNumber && (
          <p className="text-xs text-red-600 mt-1">{errors.cardNumber}</p>
        )}
      </div>

      <div>
        <Label htmlFor="cardHolderName">Nome no Cartão</Label>
        <Input
          id="cardHolderName"
          type="text"
          placeholder="NOME COMPLETO"
          value={formData.cardHolderName}
          onChange={(e) => {
            setFormData({ ...formData, cardHolderName: e.target.value.toUpperCase() });
            if (errors.cardHolderName) {
              setErrors({ ...errors, cardHolderName: undefined });
            }
          }}
          className="mt-1.5"
          disabled={isLoading}
        />
        {errors.cardHolderName && (
          <p className="text-xs text-red-600 mt-1">{errors.cardHolderName}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="expirationMonth">Mês</Label>
          <select
            id="expirationMonth"
            value={formData.expirationMonth}
            onChange={(e) => {
              setFormData({ ...formData, expirationMonth: e.target.value });
              if (errors.expirationMonth) {
                setErrors({ ...errors, expirationMonth: undefined });
              }
            }}
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={isLoading}
          >
            <option value="">MM</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="expirationYear">Ano</Label>
          <select
            id="expirationYear"
            value={formData.expirationYear}
            onChange={(e) => {
              setFormData({ ...formData, expirationYear: e.target.value });
              if (errors.expirationMonth) {
                setErrors({ ...errors, expirationMonth: undefined });
              }
            }}
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={isLoading}
          >
            <option value="">AAAA</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="securityCode">CVV</Label>
          <Input
            id="securityCode"
            type="text"
            placeholder="123"
            value={formData.securityCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "").slice(0, 4);
              setFormData({ ...formData, securityCode: value });
              if (errors.securityCode) {
                setErrors({ ...errors, securityCode: undefined });
              }
            }}
            maxLength={4}
            className="mt-1.5"
            disabled={isLoading}
          />
          {errors.securityCode && (
            <p className="text-xs text-red-600 mt-1">{errors.securityCode}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="installments">Parcelas</Label>
        <select
          id="installments"
          value={formData.installments || 1}
          onChange={(e) =>
            setFormData({ ...formData, installments: parseInt(e.target.value) })
          }
          className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          disabled={isLoading}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
            <option key={num} value={num}>
              {num}x sem juros
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Lock size={16} className="text-blue-600" />
        <p className="text-xs text-blue-800">
          Seus dados estão seguros. Não armazenamos informações do cartão.
        </p>
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-[#2563EB] hover:bg-[#1E40AF]"
        >
          {isLoading ? "Processando..." : "Pagar"}
        </Button>
      </div>
    </form>
  );
}








