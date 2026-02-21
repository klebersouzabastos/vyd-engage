import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { VYDEcosystemBanner } from "../components/VYDEcosystemBanner";
import { CheckCircle } from "lucide-react";
import { useCustomFields } from "../contexts/CustomFieldsContext";
import { CustomFieldInput } from "../components/CustomFieldInput";
import { validateFieldValue } from "../utils/customFields";
import { addInteraction } from "../utils/interactions";
import { syncLeadToPipeline } from "../utils/pipelineSync";

export function PublicForm() {
  const { formId } = useParams();
  const { fields } = useCustomFields();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    message: "",
    customFields: {} as Record<string, any>,
  });
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializar campos customizados com valores padrão
  useEffect(() => {
    const defaultCustomFields: Record<string, any> = {};
    fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        defaultCustomFields[field.id] = field.defaultValue;
      }
    });
    if (Object.keys(defaultCustomFields).length > 0) {
      setFormData((prev) => ({
        ...prev,
        customFields: defaultCustomFields,
      }));
    }
  }, [fields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validar campos customizados obrigatórios
    const errors: Record<string, string> = {};
    fields.forEach((field) => {
      const value = formData.customFields[field.id];
      const validation = validateFieldValue(field, value);
      if (!validation.valid) {
        errors[field.id] = validation.error || "";
      }
    });

    if (Object.keys(errors).length > 0) {
      setCustomFieldErrors(errors);
      setIsSubmitting(false);
      return;
    }

    try {
      // Criar lead no localStorage
      const stored = localStorage.getItem("leads");
      const leads = stored ? JSON.parse(stored) : [];
      const leadId = Date.now();

      const newLead = {
        id: leadId,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        source: "manual" as const,
        status: "novo" as const,
        date: new Date().toLocaleDateString("pt-BR"),
        automations: [],
        tags: [],
        customFields: formData.customFields,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      leads.push(newLead);
      localStorage.setItem("leads", JSON.stringify(leads));

      // Criar interação inicial
      addInteraction(leadId, {
        type: "note",
        content: `Lead criado via formulário público${formData.message ? `: ${formData.message}` : ""}`,
      });

      // Sincronizar com o Pipeline
      syncLeadToPipeline(newLead);

      setTimeout(() => {
        setSubmitted(true);
        setIsSubmitting(false);
      }, 500);
    } catch (error) {
      console.error("Erro ao salvar lead:", error);
      setIsSubmitting(false);
      alert("Erro ao enviar formulário. Tente novamente.");
    }
  };

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setFormData({
      ...formData,
      customFields: {
        ...formData.customFields,
        [fieldId]: value,
      },
    });
    // Limpar erro do campo quando o usuário começar a digitar
    if (customFieldErrors[fieldId]) {
      setCustomFieldErrors({
        ...customFieldErrors,
        [fieldId]: "",
      });
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-gray-100 flex flex-col items-center justify-center p-4">
        <VYDEcosystemBanner />
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-gray-900 mb-2">Obrigado!</h2>
          <p className="text-gray-600 mb-6">
            Recebemos suas informações e entraremos em contato em breve.
          </p>
          <div className="p-4 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-600">
              Fique atento ao seu WhatsApp e e-mail para nossas mensagens.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-gray-100 flex flex-col items-center justify-center p-4">
      <VYDEcosystemBanner />
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {/* Company Logo */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl font-bold">E</span>
          </div>
          <h2 className="text-gray-900 mb-1">Entre em contato</h2>
          <p className="text-gray-600">Preencha o formulário abaixo e retornaremos em breve</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome completo *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="João Silva"
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(11) 99999-9999"
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="seu@email.com"
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="message">Como podemos ajudar? (opcional)</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Conte-nos mais sobre sua necessidade..."
              rows={4}
              className="mt-1.5"
            />
          </div>

          {fields.length > 0 && (
            <div className="pt-4 border-t border-gray-300">
              <Label className="mb-3 block text-gray-900 font-medium">Informações Adicionais</Label>
              <div className="space-y-4">
                {fields.map((field) => (
                  <CustomFieldInput
                    key={field.id}
                    field={field}
                    value={formData.customFields[field.id]}
                    onChange={(value) => handleCustomFieldChange(field.id, value)}
                    error={customFieldErrors[field.id]}
                  />
                ))}
              </div>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary-dark"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enviando..." : "Enviar"}
          </Button>
        </form>

        <p className="text-xs text-center text-gray-600 mt-6">
          Ao enviar este formulário, você concorda com nossa política de privacidade.
        </p>
      </div>
    </div>
  );
}
