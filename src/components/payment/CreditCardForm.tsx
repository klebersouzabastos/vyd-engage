import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Lock, Loader2 } from "lucide-react";

declare global {
  interface Window {
    MercadoPago: any;
  }
}

interface CreditCardFormProps {
  amount: number;
  onSubmit: (tokenData: CardTokenData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface CardTokenData {
  token: string;
  paymentMethodId: string;
  issuerId: string;
  installments: number;
}

function loadMercadoPagoSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar SDK do Mercado Pago"));
    document.head.appendChild(script);
  });
}

export function CreditCardForm({
  amount,
  onSubmit,
  onCancel,
  isLoading = false,
}: CreditCardFormProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [installments, setInstallments] = useState(1);
  const cardFormRef = useRef<any>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadMercadoPagoSDK();

        if (cancelled || mountedRef.current) return;

        const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;
        if (!publicKey || publicKey === "TEST_PUBLIC_KEY") {
          setSdkError(
            "Chave pública do Mercado Pago não configurada. Configure VITE_MERCADOPAGO_PUBLIC_KEY."
          );
          return;
        }

        const mp = new window.MercadoPago(publicKey, {
          locale: "pt-BR",
        });

        cardFormRef.current = mp.cardForm({
          amount: String(amount),
          iframe: true,
          form: {
            id: "mp-card-form",
            cardNumber: {
              id: "mp-card-number",
              placeholder: "0000 0000 0000 0000",
            },
            expirationDate: {
              id: "mp-expiration-date",
              placeholder: "MM/AA",
            },
            securityCode: {
              id: "mp-security-code",
              placeholder: "CVV",
            },
            cardholderName: {
              id: "mp-cardholder-name",
              placeholder: "NOME NO CARTÃO",
            },
            installments: {
              id: "mp-installments",
              placeholder: "Parcelas",
            },
          },
          callbacks: {
            onFormMounted: (error: any) => {
              if (error) {
                setSdkError("Erro ao montar formulário seguro do Mercado Pago");
                return;
              }
              mountedRef.current = true;
              if (!cancelled) setSdkReady(true);
            },
            onSubmit: (event: Event) => {
              event.preventDefault();
              if (!cardFormRef.current) return;

              const formData = cardFormRef.current.getCardFormData();
              onSubmit({
                token: formData.token,
                paymentMethodId: formData.paymentMethodId,
                issuerId: formData.issuerId,
                installments: formData.installments,
              });
            },
            onFetching: (resource: string) => {
              // SDK is fetching data — could show loading
              return () => {};
            },
          },
        });
      } catch (err) {
        if (!cancelled) {
          setSdkError("Erro ao inicializar pagamento seguro. Tente novamente.");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (cardFormRef.current && typeof cardFormRef.current.unmount === "function") {
        cardFormRef.current.unmount();
      }
      mountedRef.current = false;
    };
  }, [amount, onSubmit]);

  if (sdkError) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{sdkError}</p>
        </div>
        <Button variant="outline" onClick={onCancel} className="w-full">
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!sdkReady && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-primary" />
          <span className="ml-2 text-gray-600">Carregando formulário seguro...</span>
        </div>
      )}

      <form id="mp-card-form" className={sdkReady ? "" : "hidden"}>
        <div className="space-y-4">
          <div>
            <Label>Número do Cartão</Label>
            <div
              id="mp-card-number"
              className="mt-1.5 h-10 rounded-md border border-input bg-background"
            />
          </div>

          <div>
            <Label>Nome no Cartão</Label>
            <div
              id="mp-cardholder-name"
              className="mt-1.5 h-10 rounded-md border border-input bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Validade</Label>
              <div
                id="mp-expiration-date"
                className="mt-1.5 h-10 rounded-md border border-input bg-background"
              />
            </div>
            <div>
              <Label>CVV</Label>
              <div
                id="mp-security-code"
                className="mt-1.5 h-10 rounded-md border border-input bg-background"
              />
            </div>
          </div>

          <div>
            <Label>Parcelas</Label>
            <select
              id="mp-installments"
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg mt-4">
          <Lock size={16} className="text-green-600" />
          <p className="text-xs text-green-800">
            Pagamento processado com segurança pelo Mercado Pago. Seus dados do cartão não passam pelo nosso servidor.
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
            disabled={isLoading || !sdkReady}
            className="flex-1 bg-primary hover:bg-primary-dark"
          >
            {isLoading ? "Processando..." : "Pagar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
