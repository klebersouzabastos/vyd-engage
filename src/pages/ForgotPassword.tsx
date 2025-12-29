import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { VYDEcosystemBanner } from "../components/VYDEcosystemBanner";
import { ArrowLeft, Mail } from "lucide-react";
import { apiClient } from "../services/api/client";
import { toast } from "sonner";

export function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Normalize email before sending
      const normalizedEmail = email.trim().toLowerCase();
      
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        toast.error("Por favor, insira um email válido.");
        setLoading(false);
        return;
      }
      
      await apiClient.requestPasswordReset(normalizedEmail);
      setSent(true);
      toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (error: any) {
      // Mensagem de erro mais específica
      let errorMessage = "Erro ao enviar email de recuperação";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.details?.code === 'NETWORK_ERROR') {
        errorMessage = "Erro de conexão. Verifique se o servidor está rodando.";
      } else if (error.details?.code === 'VALIDATION_ERROR' || error.statusCode === 400) {
        // Verificar se há detalhes de validação do Zod
        if (error.details?.errors && Array.isArray(error.details.errors)) {
          const validationError = error.details.errors[0];
          if (validationError.path && validationError.path.includes('email')) {
            errorMessage = "Email inválido. Verifique o formato e tente novamente.";
          } else {
            errorMessage = validationError.message || "Dados inválidos. Verifique os campos e tente novamente.";
          }
        } else {
          errorMessage = "Email inválido. Verifique o formato e tente novamente.";
        }
      } else if (error.statusCode >= 500) {
        errorMessage = "Erro no servidor. Tente novamente mais tarde.";
      }
      
      toast.error(errorMessage);
      console.error("Erro ao solicitar recuperação de senha:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* VYD Ecosystem Banner */}
      <VYDEcosystemBanner />
      
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-20 bg-white w-full lg:w-1/2">
        <div className="w-full max-w-2xl sm:max-w-2xl md:max-w-2xl lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl mx-auto py-10 sm:py-12 md:py-14 lg:py-16">
          {/* Back Button */}
          <Link 
            to="/login" 
            className="inline-flex items-center gap-2 text-[#6B7280] hover:text-[#1F2937] transition-colors mb-6 sm:mb-8"
          >
            <ArrowLeft size={20} />
            <span className="text-sm sm:text-base">Voltar para login</span>
          </Link>

          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3 mb-8 sm:mb-10 md:mb-12">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-[#2563EB] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs sm:text-sm">VE</span>
            </div>
            <span className="text-xl sm:text-2xl font-semibold text-[#1F2937]">VYD Engage</span>
          </div>

          {/* Heading */}
          <div className="mb-8 sm:mb-10 md:mb-12">
            <h1 className="text-[#1F2937] mb-3 text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
              Esqueci minha senha
            </h1>
            <p className="text-[#6B7280] text-base sm:text-lg md:text-xl mt-2">
              {sent 
                ? "Enviamos um email com instruções para redefinir sua senha."
                : "Digite seu email e enviaremos um link para redefinir sua senha."
              }
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div className="space-y-2.5">
                <Label htmlFor="email" className="text-[#1F2937] text-base sm:text-lg font-medium block">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 sm:h-14 px-4 py-3 border border-[#E5E7EB] rounded-lg bg-white text-[#1F2937] text-base placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                  required
                />
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full h-12 sm:h-14 bg-[#2563EB] hover:bg-[#1E40AF] text-white font-medium rounded-lg transition-colors text-base sm:text-lg mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-[#2563EB]/10 rounded-full">
                <Mail className="w-8 h-8 text-[#2563EB]" />
              </div>
              <div className="text-center space-y-4">
                <p className="text-[#6B7280] text-base sm:text-lg">
                  Verifique sua caixa de entrada em <strong>{email}</strong> e siga as instruções para redefinir sua senha.
                </p>
                <p className="text-sm text-[#9CA3AF]">
                  Não recebeu o email? Verifique sua pasta de spam ou tente novamente.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => setSent(false)}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  Tentar outro email
                </Button>
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto bg-[#2563EB] hover:bg-[#1E40AF]"
                >
                  Voltar para login
                </Button>
              </div>
            </div>
          )}

          {/* Sign up link */}
          <p className="mt-8 sm:mt-10 text-center text-[#6B7280] text-base sm:text-lg">
            Lembrou sua senha?{" "}
            <Link 
              to="/login" 
              className="text-[#2563EB] hover:text-[#1E40AF] font-medium transition-colors"
            >
              Fazer login
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:flex flex-1 bg-[#F9FAFB] relative overflow-hidden w-full lg:w-1/2">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2563EB]/10 to-transparent"></div>
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1641430034785-47f6f91ab6cf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB3b3Jrc3BhY2UlMjBsYXB0b3B8ZW58MXx8fHwxNzYzNzAwMDAxfDA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Modern workspace"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="absolute inset-0 flex items-center justify-center p-6 lg:p-8 xl:p-12 z-10">
          <div className="text-center text-white max-w-md lg:max-w-lg xl:max-w-xl px-4">
            <h3 className="mb-3 sm:mb-4 text-xl lg:text-2xl xl:text-3xl font-semibold leading-tight">
              Recupere o acesso à sua conta
            </h3>
            <p className="text-sm lg:text-base xl:text-lg opacity-90">
              Siga as instruções enviadas por email para redefinir sua senha de forma segura.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

