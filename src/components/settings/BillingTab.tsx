import { useState } from "react";
import { Button } from "../ui/button";
import { CheckCircle } from "lucide-react";
import { usePlan } from "../../contexts/PlanContext";
import { usePayment } from "../../contexts/PaymentContext";
import { PlanType } from "../../types/plan";
import { PaymentModal } from "../payment/PaymentModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

const planOrder: PlanType[] = ["starter", "pro", "enterprise"];

export function BillingTab() {
  const {
    currentPlan,
    plans,
    planUsage,
    subscription,
    paymentHistory,
    changePlan,
    changePlanWithPayment,
    getPlan,
    canUpgrade,
    canDowngrade
  } = usePlan();
  const { validateUpgrade, currentPaymentIntent } = usePayment();
  const [planChangeModalOpen, setPlanChangeModalOpen] = useState(false);
  const [selectedPlanToChange, setSelectedPlanToChange] = useState<PlanType | null>(null);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div>
        <h3 className="text-gray-900 mb-4">Plano Atual</h3>
        {(() => {
          const currentPlanData = getPlan(currentPlan);
          return (
            <div className="p-6 rounded-lg border-2 border-primary bg-primary/5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-xl font-semibold text-gray-900">{currentPlanData.name}</h4>
                  <p className="text-gray-600">R$ {currentPlanData.price.toFixed(2)}/mes</p>
                </div>
                <span className="px-3 py-1 bg-primary text-white text-xs rounded-full">
                  {subscription?.status === "active" ? "Ativo" : subscription?.status === "trial" ? "Teste" : "Inativo"}
                </span>
              </div>
              <div className="space-y-2 mb-4">
                {currentPlanData.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle size={16} className="text-success" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                {canDowngrade() && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const currentIndex = planOrder.indexOf(currentPlan);
                      if (currentIndex > 0) {
                        setSelectedPlanToChange(planOrder[currentIndex - 1]);
                        setPlanChangeModalOpen(true);
                      }
                    }}
                  >
                    Fazer Downgrade
                  </Button>
                )}
                {canUpgrade() && (
                  <Button
                    className="flex-1 bg-primary hover:bg-primary-dark"
                    onClick={() => {
                      const currentIndex = planOrder.indexOf(currentPlan);
                      if (currentIndex < planOrder.length - 1) {
                        const nextPlan = planOrder[currentIndex + 1];
                        setSelectedPlanToChange(nextPlan);
                        const validation = validateUpgrade(nextPlan);
                        if (!validation.isValid) {
                          setPaymentModalOpen(true);
                        } else {
                          setPlanChangeModalOpen(true);
                        }
                      }
                    }}
                  >
                    Fazer Upgrade
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Available Plans Comparison */}
      <div className="pt-6 border-t border-gray-300">
        <h3 className="text-gray-900 mb-4">Planos Disponiveis</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlan;
            const isUpgrade = planOrder.indexOf(plan.id) > planOrder.indexOf(currentPlan);

            return (
              <div
                key={plan.id}
                className={`p-6 rounded-lg border-2 ${
                  isCurrentPlan
                    ? "border-primary bg-primary/5"
                    : plan.highlighted
                    ? "border-amber bg-amber/5"
                    : "border-gray-300 bg-white"
                }`}
              >
                {plan.highlighted && !isCurrentPlan && (
                  <div className="mb-3">
                    <span className="px-2 py-1 bg-amber text-white text-xs rounded-full">
                      Recomendado
                    </span>
                  </div>
                )}
                <div className="mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-1">{plan.name}</h4>
                  <p className="text-sm text-gray-600 mb-2">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900">R$ {plan.price.toFixed(2)}</span>
                    <span className="text-sm text-gray-600">/mes</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-4">
                  {plan.features.slice(0, 4).map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle size={16} className="text-success mt-0.5 flex-shrink-0" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                {isCurrentPlan ? (
                  <Button variant="outline" className="w-full" disabled>
                    Plano Atual
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${
                      isUpgrade
                        ? "bg-primary hover:bg-primary-dark"
                        : "bg-gray-600 hover:bg-gray-500"
                    }`}
                    onClick={() => {
                      setSelectedPlanToChange(plan.id);
                      if (isUpgrade) {
                        const validation = validateUpgrade(plan.id);
                        if (!validation.isValid) {
                          setPaymentModalOpen(true);
                        } else {
                          setPlanChangeModalOpen(true);
                        }
                      } else {
                        setPlanChangeModalOpen(true);
                      }
                    }}
                  >
                    {isUpgrade ? "Fazer Upgrade" : "Fazer Downgrade"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Usage */}
      <div className="pt-6 border-t border-gray-300">
        <h3 className="text-gray-900 mb-4">Uso Atual</h3>
        <div className="space-y-4">
          {[
            { label: "Leads", usage: planUsage.leads },
            { label: "Usuarios", usage: planUsage.users },
            { label: "Automacoes", usage: planUsage.automations },
            { label: "Conexoes WhatsApp", usage: planUsage.whatsappConnections },
            { label: "Configuracoes de Email", usage: planUsage.emailConfigs },
          ].map(({ label, usage }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-medium">
                  {usage.current} / {usage.limit === 0 ? "Ilimitado" : usage.limit}
                </span>
              </div>
              {usage.limit > 0 && (
                <div className="w-full bg-gray-300 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      usage.percentage >= 90
                        ? "bg-red-500"
                        : usage.percentage >= 70
                        ? "bg-yellow-500"
                        : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(usage.percentage, 100)}%` }}
                  ></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Payment History */}
      <div className="pt-6 border-t border-gray-300">
        <h3 className="text-gray-900 mb-4">Historico de Pagamentos</h3>
        <div className="space-y-3">
          {paymentHistory.length > 0 ? (
            paymentHistory.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">R$ {payment.amount.toFixed(2)}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(payment.date).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 text-xs rounded-full ${
                    payment.status === "paid"
                      ? "bg-green-100 text-green-700"
                      : payment.status === "pending"
                      ? "bg-yellow-100 text-yellow-700"
                      : payment.status === "failed"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {payment.status === "paid"
                    ? "Pago"
                    : payment.status === "pending"
                    ? "Pendente"
                    : payment.status === "failed"
                    ? "Falhou"
                    : "Reembolsado"}
                </span>
              </div>
            ))
          ) : (
            <div className="p-4 bg-gray-100 rounded-lg text-center">
              <p className="text-sm text-gray-600">Nenhum pagamento registrado</p>
            </div>
          )}
        </div>
      </div>

      {/* Plan Change Confirmation Modal */}
      <Dialog open={planChangeModalOpen} onOpenChange={setPlanChangeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPlanToChange && planOrder.indexOf(selectedPlanToChange) > planOrder.indexOf(currentPlan)
                ? "Confirmar Upgrade de Plano"
                : "Confirmar Downgrade de Plano"}
            </DialogTitle>
            <DialogDescription>
              {selectedPlanToChange && (
                <>
                  Voce esta prestes a mudar do plano <strong>{getPlan(currentPlan).name}</strong> para o plano{" "}
                  <strong>{getPlan(selectedPlanToChange).name}</strong>.
                  {planOrder.indexOf(selectedPlanToChange) > planOrder.indexOf(currentPlan) ? (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Upgrade:</strong> Voce tera acesso a mais recursos e limites maiores. A mudanca sera aplicada imediatamente.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Atencao:</strong> Ao fazer downgrade, voce pode perder acesso a alguns recursos se estiver usando mais do que o permitido no novo plano.
                      </p>
                    </div>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedPlanToChange && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-100 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Plano Atual</span>
                  <span className="font-medium text-gray-900">
                    {getPlan(currentPlan).name} - R$ {getPlan(currentPlan).price.toFixed(2)}/mes
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Novo Plano</span>
                  <span className="font-medium text-gray-900">
                    {getPlan(selectedPlanToChange).name} - R$ {getPlan(selectedPlanToChange).price.toFixed(2)}/mes
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPlanChangeModalOpen(false);
                setSelectedPlanToChange(null);
              }}
              disabled={isChangingPlan}
            >
              Cancelar
            </Button>
            <Button
              className="bg-primary hover:bg-primary-dark"
              onClick={async () => {
                if (!selectedPlanToChange) return;
                setIsChangingPlan(true);
                try {
                  const isUpgrade = planOrder.indexOf(selectedPlanToChange) > planOrder.indexOf(currentPlan);
                  if (isUpgrade) {
                    const validation = validateUpgrade(selectedPlanToChange);
                    if (!validation.isValid) {
                      setPlanChangeModalOpen(false);
                      setPaymentModalOpen(true);
                      return;
                    }
                  }
                  await changePlan(selectedPlanToChange);
                  setPlanChangeModalOpen(false);
                  setSelectedPlanToChange(null);
                } catch (error: any) {
                  console.error("Erro ao mudar plano:", error);
                  if (error.message?.includes("pagamento")) {
                    setPlanChangeModalOpen(false);
                    setPaymentModalOpen(true);
                  } else {
                    alert(error.message || "Erro ao mudar plano. Tente novamente.");
                  }
                } finally {
                  setIsChangingPlan(false);
                }
              }}
              disabled={isChangingPlan}
            >
              {isChangingPlan ? "Processando..." : "Confirmar Mudanca"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      {selectedPlanToChange && (
        <PaymentModal
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          planId={selectedPlanToChange}
          planName={getPlan(selectedPlanToChange).name}
          amount={getPlan(selectedPlanToChange).price}
          onPaymentSuccess={async () => {
            try {
              if (currentPaymentIntent && currentPaymentIntent.status === "paid") {
                await changePlanWithPayment(selectedPlanToChange, currentPaymentIntent.id);
              } else {
                await changePlan(selectedPlanToChange);
              }
              setPaymentModalOpen(false);
              setSelectedPlanToChange(null);
            } catch (error: any) {
              console.error("Erro ao atualizar plano apos pagamento:", error);
              alert(error.message || "Erro ao atualizar plano. Entre em contato com o suporte.");
            }
          }}
        />
      )}
    </div>
  );
}
