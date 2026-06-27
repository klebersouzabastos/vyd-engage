import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from 'react';
import {
  PaymentIntent,
  PaymentMethod,
  PaymentResult,
  CardTokenData,
  PaymentStatus,
} from '../types/payment';
import { PlanType } from '../types/plan';
import {
  createPaymentIntent,
  processCreditCardPayment,
  processPixPayment,
  processBoletoPayment,
  checkPaymentStatus,
  getPaymentHistory,
} from '../services/paymentService';
import { useAuth } from './AuthContext';

interface PaymentContextType {
  paymentIntents: PaymentIntent[];
  currentPaymentIntent: PaymentIntent | null;
  isProcessing: boolean;
  startPayment: (planId: PlanType, amount: number, method: PaymentMethod) => Promise<PaymentIntent>;
  processPayment: (paymentIntentId: string, data?: CardTokenData) => Promise<PaymentResult>;
  checkPayment: (paymentIntentId: string) => Promise<PaymentStatus>;
  validateUpgrade: (planId: PlanType) => {
    isValid: boolean;
    reason?: string;
    pendingPayment?: PaymentIntent;
  };
  clearCurrentPayment: () => void;
  refreshPayments: () => void;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

export function PaymentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [paymentIntents, setPaymentIntents] = useState<PaymentIntent[]>([]);
  const [currentPaymentIntent, setCurrentPaymentIntent] = useState<PaymentIntent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const currentPaymentRef = useRef(currentPaymentIntent);
  currentPaymentRef.current = currentPaymentIntent;

  // Carregar histórico de pagamentos da API
  const refreshPayments = useCallback(async () => {
    try {
      const history = await getPaymentHistory();
      interface ApiPayment {
        id: string;
        planType?: string;
        planId?: string;
        amount?: number | string;
        method?: string;
        status?: string;
        createdAt?: string;
        updatedAt?: string;
        metadata?: Record<string, unknown>;
      }
      const intents: PaymentIntent[] = (history || []).map((p: ApiPayment) => ({
        id: p.id,
        planId: p.planType || p.planId || '',
        amount: Number(p.amount) || 0,
        method: (p.method || 'credit_card').toLowerCase() as PaymentMethod,
        status: (p.status || 'pending').toLowerCase() as PaymentStatus,
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString(),
        metadata: p.metadata,
      }));
      setPaymentIntents(intents);

      // Atualizar pagamento atual se existir
      const current = currentPaymentRef.current;
      if (current) {
        const updated = intents.find((i) => i.id === current.id);
        if (updated) {
          setCurrentPaymentIntent(updated);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar pagamentos:', error);
    }
  }, []);

  // Carregar pagamentos ao montar
  useEffect(() => {
    if (!user) {
      setPaymentIntents([]);
      return;
    }
    refreshPayments();
  }, [user, refreshPayments]);

  // Iniciar processo de pagamento
  const startPayment = useCallback(
    async (planId: PlanType, amount: number, method: PaymentMethod): Promise<PaymentIntent> => {
      setIsProcessing(true);
      try {
        const intent = await createPaymentIntent(planId, amount, method, {
          planName: planId,
        });

        setCurrentPaymentIntent(intent);
        setPaymentIntents((prev) => [intent, ...prev]);

        return intent;
      } catch (error) {
        console.error('Erro ao criar intenção de pagamento:', error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  // Processar pagamento
  const processPayment = useCallback(
    async (paymentIntentId: string, data?: CardTokenData): Promise<PaymentResult> => {
      setIsProcessing(true);
      try {
        // Buscar intent do estado local
        const allIntents = [...paymentIntents];
        const intent =
          currentPaymentRef.current?.id === paymentIntentId
            ? currentPaymentRef.current
            : allIntents.find((i) => i.id === paymentIntentId);

        if (!intent) {
          throw new Error('Intenção de pagamento não encontrada');
        }

        let result: PaymentResult;

        switch (intent.method) {
          case 'credit_card':
            if (!data) {
              throw new Error('Dados do cartão são obrigatórios');
            }
            result = await processCreditCardPayment(paymentIntentId, data);
            break;
          case 'pix':
            result = await processPixPayment(paymentIntentId);
            break;
          case 'boleto':
            result = await processBoletoPayment(paymentIntentId);
            break;
          default:
            throw new Error('Método de pagamento não suportado');
        }

        // Atualizar estado via API
        await refreshPayments();

        return result;
      } catch (error) {
        console.error('Erro ao processar pagamento:', error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [paymentIntents, refreshPayments]
  );

  // Verificar status de pagamento
  const checkPayment = useCallback(
    async (paymentIntentId: string): Promise<PaymentStatus> => {
      try {
        const status = await checkPaymentStatus(paymentIntentId);
        await refreshPayments();
        return status;
      } catch (error) {
        console.error('Erro ao verificar status de pagamento:', error);
        return 'failed';
      }
    },
    [refreshPayments]
  );

  // Validar se pode fazer upgrade (usa estado local)
  const validateUpgrade = useCallback(
    (planId: PlanType): { isValid: boolean; reason?: string; pendingPayment?: PaymentIntent } => {
      const pendingPayment = paymentIntents.find(
        (p) => p.status === 'pending' || p.status === 'processing'
      );

      if (pendingPayment) {
        return {
          isValid: false,
          reason: 'Há um pagamento pendente. Aguarde a confirmação.',
          pendingPayment,
        };
      }

      return { isValid: true };
    },
    [paymentIntents]
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
          intent.status === 'pending' && (intent.method === 'pix' || intent.method === 'boleto')
      );

      if (pendingIntents.length > 0) {
        pendingIntents.forEach((intent) => {
          checkPayment(intent.id).catch(console.error);
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [paymentIntents, checkPayment]);

  const value = useMemo(
    () => ({
      paymentIntents,
      currentPaymentIntent,
      isProcessing,
      startPayment,
      processPayment,
      checkPayment,
      validateUpgrade,
      clearCurrentPayment,
      refreshPayments,
    }),
    [
      paymentIntents,
      currentPaymentIntent,
      isProcessing,
      startPayment,
      processPayment,
      checkPayment,
      validateUpgrade,
      clearCurrentPayment,
      refreshPayments,
    ]
  );

  return <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>;
}

export function usePayment() {
  const context = useContext(PaymentContext);
  if (context === undefined) {
    throw new Error('usePayment deve ser usado dentro de um PaymentProvider');
  }
  return context;
}
