import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  PaymentIntent,
  PaymentMethod,
  PaymentResult,
  CardTokenData,
  PaymentStatus,
} from "../types/payment";
import { PlanType } from "../types/plan";
import {
  createPaymentIntent,
  processCreditCardPayment,
  processPixPayment,
  processBoletoPayment,
  checkPaymentStatus,
  validatePaymentForUpgrade,
  getPaymentIntents,
  getPaymentIntent,
} from "../services/paymentService";

interface PaymentContextType {
  paymentIntents: PaymentIntent[];
  currentPaymentIntent: PaymentIntent | null;
  isProcessing: boolean;
  startPayment: (planId: PlanType, amount: number, method: PaymentMethod) => Promise<PaymentIntent>;
  processPayment: (
    paymentIntentId: string,
    data?: CardTokenData
  ) => Promise<PaymentResult>;
  checkPayment: (paymentIntentId: string) => Promise<PaymentStatus>;
  validateUpgrade: (planId: PlanType) => { isValid: boolean; reason?: string; pendingPayment?: PaymentIntent };
  clearCurrentPayment: () => void;
  refreshPayments: () => void;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [paymentIntents, setPaymentIntents] = useState<PaymentIntent[]>(() => {
    return getPaymentIntents();
  });
  const [currentPaymentIntent, setCurrentPaymentIntent] = useState<PaymentIntent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Atualizar lista de pagamentos
  const refreshPayments = useCallback(() => {
    const intents = getPaymentIntents();
    setPaymentIntents(intents);
    
    // Atualizar pagamento atual se existir
    if (currentPaymentIntent) {
      const updated = intents.find((i) => i.id === currentPaymentIntent.id);
      if (updated) {
        setCurrentPaymentIntent(updated);
      }
    }
  }, [currentPaymentIntent]);

  // Iniciar processo de pagamento
  const startPayment = useCallback(
    async (planId: PlanType, amount: number, method: PaymentMethod): Promise<PaymentIntent> => {
      setIsProcessing(true);
      try {
        const intent = await createPaymentIntent(planId, amount, method, {
          planName: planId,
        });
        
        setCurrentPaymentIntent(intent);
        refreshPayments();
        
        return intent;
      } catch (error) {
        console.error("Erro ao criar intenção de pagamento:", error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshPayments]
  );

  // Processar pagamento
  const processPayment = useCallback(
    async (
      paymentIntentId: string,
      data?: CardTokenData
    ): Promise<PaymentResult> => {
      setIsProcessing(true);
      try {
        const intent = getPaymentIntent(paymentIntentId);
        if (!intent) {
          throw new Error("Intenção de pagamento não encontrada");
        }

        let result: PaymentResult;

        switch (intent.method) {
          case "credit_card":
            if (!data) {
              throw new Error("Dados do cartão são obrigatórios");
            }
            result = await processCreditCardPayment(paymentIntentId, data);
            break;
          case "pix":
            result = await processPixPayment(paymentIntentId);
            break;
          case "boleto":
            result = await processBoletoPayment(paymentIntentId);
            break;
          default:
            throw new Error("Método de pagamento não suportado");
        }

        // Atualizar estado
        refreshPayments();
        
        // Atualizar pagamento atual
        const updatedIntent = getPaymentIntent(paymentIntentId);
        if (updatedIntent) {
          setCurrentPaymentIntent(updatedIntent);
        }

        return result;
      } catch (error) {
        console.error("Erro ao processar pagamento:", error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshPayments]
  );

  // Verificar status de pagamento
  const checkPayment = useCallback(
    async (paymentIntentId: string): Promise<PaymentStatus> => {
      try {
        const status = await checkPaymentStatus(paymentIntentId);
        refreshPayments();
        
        // Atualizar pagamento atual
        const updatedIntent = getPaymentIntent(paymentIntentId);
        if (updatedIntent) {
          setCurrentPaymentIntent(updatedIntent);
        }
        
        return status;
      } catch (error) {
        console.error("Erro ao verificar status de pagamento:", error);
        return "failed";
      }
    },
    [refreshPayments]
  );

  // Validar se pode fazer upgrade
  const validateUpgrade = useCallback(
    (planId: PlanType): { isValid: boolean; reason?: string; pendingPayment?: PaymentIntent } => {
      return validatePaymentForUpgrade(planId);
    },
    []
  );

  // Limpar pagamento atual
  const clearCurrentPayment = useCallback(() => {
    setCurrentPaymentIntent(null);
  }, []);

  // Verificar pagamentos pendentes periodicamente (PIX e Boleto)
  useEffect(() => {
    const interval = setInterval(() => {
      const pendingIntents = paymentIntents.filter(
        (intent) =>
          intent.status === "pending" &&
          (intent.method === "pix" || intent.method === "boleto")
      );

      if (pendingIntents.length > 0) {
        // Verificar status de cada pagamento pendente
        pendingIntents.forEach((intent) => {
          checkPayment(intent.id).catch(console.error);
        });
      }
    }, 30000); // Verificar a cada 30 segundos

    return () => clearInterval(interval);
  }, [paymentIntents, checkPayment]);

  const value: PaymentContextType = {
    paymentIntents,
    currentPaymentIntent,
    isProcessing,
    startPayment,
    processPayment,
    checkPayment,
    validateUpgrade,
    clearCurrentPayment,
    refreshPayments,
  };

  return <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>;
}

export function usePayment() {
  const context = useContext(PaymentContext);
  if (context === undefined) {
    throw new Error("usePayment deve ser usado dentro de um PaymentProvider");
  }
  return context;
}








