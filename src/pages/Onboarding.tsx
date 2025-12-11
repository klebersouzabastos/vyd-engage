import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Building2, Target, Zap, Check, ArrowLeft, MessageSquare, ArrowRight } from "lucide-react";
import { useWhatsApp } from "../contexts/WhatsAppContext";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "../components/ui/dialog";
import { WhatsAppConnectionsModal } from "../components/whatsapp/WhatsAppConnectionsModal";

export function Onboarding() {
  const navigate = useNavigate();
  const { connections } = useWhatsApp();
  const [step, setStep] = useState(1);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    companySize: "",
    objective: "",
    email: "",
  });

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      navigate("/app");
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Back Button */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-[#6B7280] hover:text-[#1F2937] transition-colors mb-6"
        >
          <ArrowLeft size={20} />
          <span className="text-sm">Voltar para home</span>
        </Link>

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB] flex items-center justify-center">
            <span className="text-white font-bold text-lg">F</span>
          </div>
          <span className="text-xl font-semibold text-[#1F2937]">FlowCRM</span>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-12">
          {[1, 2, 3].map((num) => (
            <div key={num} className="flex items-center flex-1">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center
                ${step >= num ? 'bg-[#2563EB] text-white' : 'bg-white text-[#6B7280] border-2 border-[#E5E7EB]'}
              `}>
                {step > num ? <Check size={20} /> : num}
              </div>
              {num < 3 && (
                <div className={`flex-1 h-1 mx-4 ${step > num ? 'bg-[#2563EB]' : 'bg-[#E5E7EB]'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-8">
          {step === 1 && (
            <div>
              <div className="w-12 h-12 bg-[#2563EB]/10 rounded-lg flex items-center justify-center mb-4">
                <Building2 className="text-[#2563EB]" size={24} />
              </div>
              <h2 className="text-[#1F2937] mb-2">Dados da empresa</h2>
              <p className="text-[#6B7280] mb-6">Conte-nos um pouco sobre sua empresa</p>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="companyName">Nome da empresa</Label>
                  <Input
                    id="companyName"
                    placeholder="Ex: Minha Empresa LTDA"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="companySize">Tamanho da equipe</Label>
                  <select
                    id="companySize"
                    value={formData.companySize}
                    onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
                    className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white text-[#1F2937]"
                  >
                    <option value="">Selecione</option>
                    <option value="1-10">1-10 pessoas</option>
                    <option value="11-50">11-50 pessoas</option>
                    <option value="51-200">51-200 pessoas</option>
                    <option value="201+">201+ pessoas</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="w-12 h-12 bg-[#2563EB]/10 rounded-lg flex items-center justify-center mb-4">
                <Target className="text-[#2563EB]" size={24} />
              </div>
              <h2 className="text-[#1F2937] mb-2">Objetivo principal</h2>
              <p className="text-[#6B7280] mb-6">O que você mais deseja alcançar?</p>

              <div className="space-y-3">
                {[
                  { value: "capturar", label: "Capturar mais leads", desc: "Formulários e integrações" },
                  { value: "organizar", label: "Organizar vendas", desc: "Pipeline e CRM completo" },
                  { value: "automatizar", label: "Automatizar follow-ups", desc: "WhatsApp e e-mail" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`
                      flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all
                      ${formData.objective === option.value 
                        ? 'border-[#2563EB] bg-[#2563EB]/5' 
                        : 'border-[#E5E7EB] hover:border-[#2563EB]/50'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="objective"
                      value={option.value}
                      checked={formData.objective === option.value}
                      onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-[#1F2937]">{option.label}</p>
                      <p className="text-sm text-[#6B7280]">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="w-12 h-12 bg-[#2563EB]/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="text-[#2563EB]" size={24} />
              </div>
              <h2 className="text-[#1F2937] mb-2">Configurações de automação</h2>
              <p className="text-[#6B7280] mb-6">Configure seus canais de comunicação (opcional)</p>

              <div className="space-y-4">
                <div>
                  <Label>Conexões WhatsApp</Label>
                  <p className="text-sm text-[#6B7280] mb-3">
                    Configure suas integrações com WhatsApp (opcional). Você pode configurar depois nas Configurações.
                  </p>
                  {connections.length > 0 ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-800">
                          {connections.length} conexão(ões) configurada(s)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border border-[#E5E7EB] rounded-lg bg-[#F9FAFB]">
                      <p className="text-sm text-[#6B7280] mb-3">
                        Nenhuma conexão configurada ainda
                      </p>
                      <Dialog open={whatsappModalOpen} onOpenChange={setWhatsappModalOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full">
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Configurar Conexão WhatsApp
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[900px] max-w-[calc(100vw-2rem)] h-[700px] max-h-[calc(100vh-2rem)] overflow-y-auto">
                          <WhatsAppConnectionsModal onClose={() => setWhatsappModalOpen(false)} />
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                  <p className="text-xs text-[#6B7280] mt-2">
                    Suportamos WhatsApp Business API oficial, Evolution API, Baileys/WPPConnect e ChatAPI
                  </p>
                </div>
                <div>
                  <Label htmlFor="email">E-mail de envio</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="noreply@suaempresa.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-[#6B7280] mt-1">E-mail usado para enviar automações</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#E5E7EB]">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 1}
              className="text-[#6B7280]"
            >
              Voltar
            </Button>
            <div className="flex gap-3">
              {step === 3 && (
                <Button
                  variant="outline"
                  onClick={() => navigate("/app")}
                  className="text-[#6B7280] border-[#E5E7EB] hover:bg-[#F9FAFB]"
                >
                  Configurar depois
                </Button>
              )}
              <Button
                onClick={handleNext}
                className="bg-[#2563EB] hover:bg-[#1E40AF]"
              >
                {step === 3 ? "Começar a usar" : "Continuar"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
