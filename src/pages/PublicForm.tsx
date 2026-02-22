import { useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { VYDEcosystemBanner } from "../components/VYDEcosystemBanner";
import { CheckCircle } from "lucide-react";

export function PublicForm() {
  const { formId } = useParams();
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Detect source from UTM params
  const utmSource = useMemo(() => {
    const src = searchParams.get("utm_source");
    if (src) return src;
    const ref = searchParams.get("ref");
    if (ref) return ref;
    return null;
  }, [searchParams]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Nome e obrigatorio";
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Email invalido";
    }
    if (formData.phone && formData.phone.replace(/\D/g, "").length < 10) {
      errors.phone = "Telefone deve ter pelo menos 10 digitos";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setError("");

    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const response = await fetch(`${apiUrl}/api/public/capture/${formId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          company: formData.company || undefined,
          message: formData.message || undefined,
          source: utmSource || "WEBSITE",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao enviar formulário");
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error("Erro ao submeter formulário:", err);
      setError(err.message || "Erro ao enviar formulário. Tente novamente.");
    } finally {
      setIsSubmitting(false);
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
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl font-bold">E</span>
          </div>
          <h2 className="text-gray-900 mb-1">Entre em contato</h2>
          <p className="text-gray-600">Preencha o formulário abaixo e retornaremos em breve</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome completo *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="João Silva"
              required
              className={`mt-1.5 ${fieldErrors.name ? "border-red-400" : ""}`}
            />
            {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
          </div>

          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="seu@email.com"
              className={`mt-1.5 ${fieldErrors.email ? "border-red-400" : ""}`}
            />
            {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
          </div>

          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(11) 99999-9999"
              className={`mt-1.5 ${fieldErrors.phone ? "border-red-400" : ""}`}
            />
            {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
          </div>

          <div>
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Nome da empresa"
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

          {error && (
            <p className="text-sm text-red-600">{error}</p>
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
