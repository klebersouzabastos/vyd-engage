import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { CreditCardForm } from "./CreditCardForm";
import { PixPayment } from "./PixPayment";
import { BoletoPayment } from "./BoletoPayment";
import { usePayment } from "../../contexts/PaymentContext";
import { PaymentMethod, CreditCardData, PixPaymentData, BoletoPaymentData } from "../../types/payment";
import { PlanType } from "../../types/plan";
import { X, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "../ui/button";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: PlanType;
  planName: string;
  amount: number;
  onPaymentSuccess: () => void;
}

export function PaymentModal({
  open,
  onOpenChange,
  planId,
  planName,
  amount,
  onPaymentSuccess,
}: PaymentModalProps) {
  const {
    startPayment,
    processPayment,
    checkPayment,
    currentPaymentIntent,
    isProcessing,
    clearCurrentPayment,
  } = usePayment();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [step, setStep] = useState<"select" | "payment" | "pending" | "success" | "error">("select");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resetar estado quando modal abrir
  useEffect(() => {
    if (open) {
      setSelectedMethod(null);
      setStep("select");
      setErrorMessage(null);
      clearCurrentPayment();
    }
  }, [open, clearCurrentPayment]);

  // Verificar se há pagamento pendente quando modal abrir
  useEffect(() => {
    if (open && currentPaymentIntent) {
      if (currentPaymentIntent.status === "paid") {
        setStep("success");
      } else if (currentPaymentIntent.status === "pending") {
        setStep("pending");
      } else if (currentPaymentIntent.status === "failed") {
        setStep("error");
        setErrorMessage(currentPaymentIntent.errorMessage || "Pagamento falhou");
      }
    }
  }, [open, currentPaymentIntent]);

  const handleSelectMethod = async (method: PaymentMethod) => {
    try {
      setSelectedMethod(method);
      setErrorMessage(null);
      
      // Criar intenção de pagamento
      const intent = await startPayment(planId, amount, method);
      
      // Se for PIX ou Boleto, já processar para gerar QR Code/Boleto
      if (method === "pix" || method === "boleto") {
        const result = await processPayment(intent.id);
        if (result.success) {
          setStep("pending");
        } else {
          setStep("error");
          setErrorMessage(result.message);
        }
      } else {
        // Cartão de crédito - mostrar formulário
        setStep("payment");
      }
    } catch (error) {
      console.error("Erro ao iniciar pagamento:", error);
      setStep("error");
      setErrorMessage("Erro ao iniciar pagamento. Tente novamente.");
    }
  };

  const handleCreditCardSubmit = async (cardData: CreditCardData) => {
    if (!currentPaymentIntent) return;

    try {
      setErrorMessage(null);
      const result = await processPayment(currentPaymentIntent.id, cardData);
      
      if (result.success) {
        if (result.status === "paid") {
          setStep("success");
          setTimeout(() => {
            onPaymentSuccess();
            onOpenChange(false);
          }, 2000);
        } else {
          setStep("pending");
        }
      } else {
        setStep("error");
        setErrorMessage(result.message || "Erro ao processar pagamento");
      }
    } catch (error) {
      console.error("Erro ao processar pagamento:", error);
      setStep("error");
      setErrorMessage("Erro ao processar pagamento. Tente novamente.");
    }
  };

  const handleCheckStatus = async () => {
    if (!currentPaymentIntent) return;

    try {
      const status = await checkPayment(currentPaymentIntent.id);
      
      if (status === "paid") {
        setStep("success");
        setTimeout(() => {
          onPaymentSuccess();
          onOpenChange(false);
        }, 2000);
      } else if (status === "failed") {
        setStep("error");
        setErrorMessage("Pagamento não encontrado ou falhou");
      }
    } catch (error) {
      console.error("Erro ao verificar status:", error);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      onOpenChange(false);
    }
  };

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-2xl w-[90vw] sm:w-[600px] max-h-[85vh] min-h-[400px] overflow-hidden flex flex-col p-0"
        style={{ maxWidth: '600px' }}
      >
        <div className="px-6 pt-6 pb-4 border-b border-[#E5E7EB] flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#1F2937]">
              Pagamento - {planName}
            </DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280] mt-1">
              Valor: <span className="font-semibold text-[#1F2937]">{formatAmount(amount)}</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
          <div className="space-y-6">
          {step === "select" && (
            <div>
              <h3 className="text-lg font-semibold text-[#1F2937] mb-4">
                Escolha a forma de pagamento
              </h3>
              <PaymentMethodSelector
                selectedMethod={selectedMethod}
                onSelectMethod={handleSelectMethod}
                disabled={isProcessing}
              />
            </div>
          )}

          {step === "payment" && currentPaymentIntent && selectedMethod === "credit_card" && (
            <div>
              <h3 className="text-lg font-semibold text-[#1F2937] mb-4">
                Dados do Cartão
              </h3>
              <CreditCardForm
                onSubmit={handleCreditCardSubmit}
                onCancel={() => setStep("select")}
                isLoading={isProcessing}
              />
            </div>
          )}

          {step === "pending" && currentPaymentIntent && (
            <div>
              <h3 className="text-lg font-semibold text-[#1F2937] mb-4">
                {selectedMethod === "pix" ? "Pagamento via PIX" : "Pagamento via Boleto"}
              </h3>
              {selectedMethod === "pix" && currentPaymentIntent.paymentData && (
                <PixPayment
                  pixData={currentPaymentIntent.paymentData as PixPaymentData}
                  onCheckStatus={handleCheckStatus}
                  isLoading={isProcessing}
                />
              )}
              {selectedMethod === "boleto" && currentPaymentIntent.paymentData && (
                <BoletoPayment
                  boletoData={currentPaymentIntent.paymentData as BoletoPaymentData}
                  onCheckStatus={handleCheckStatus}
                  isLoading={isProcessing}
                />
              )}
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-[#1F2937] mb-2">
                Pagamento Aprovado!
              </h3>
              <p className="text-[#6B7280]">
                Seu plano será atualizado em instantes...
              </p>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-[#1F2937] mb-2">
                Erro no Pagamento
              </h3>
              <p className="text-[#6B7280] mb-4">
                {errorMessage || "Ocorreu um erro ao processar o pagamento."}
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("select");
                    setSelectedMethod(null);
                    setErrorMessage(null);
                    clearCurrentPayment();
                  }}
                >
                  Tentar Novamente
                </Button>
                <Button
                  onClick={handleClose}
                  className="bg-[#2563EB] hover:bg-[#1E40AF]"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}

          {isProcessing && step !== "pending" && (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={24} className="animate-spin text-[#2563EB]" />
              <span className="ml-2 text-[#6B7280]">Processando...</span>
            </div>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

