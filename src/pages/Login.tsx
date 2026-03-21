import React, { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { VYDEcosystemBanner } from "../components/VYDEcosystemBanner";
import { ArrowLeft, Eye, EyeOff, Shield } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { FieldError } from "../components/register/FieldError";
import { getErrorMessage, getErrorCode, getErrorStatusCode } from "../utils/errors";
import { useAutoFocus } from "../hooks/useFocusManagement";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [touchedFields, setTouchedFields] = useState<{ email?: boolean; password?: boolean }>({});
  const autoFocusRef = useAutoFocus<HTMLFormElement>();

  const validateEmail = useCallback((value: string): string | undefined => {
    if (!value.trim()) return "E-mail é obrigatório";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value.trim())) return "Formato de e-mail inválido";
    return undefined;
  }, []);

  const validatePassword = useCallback((value: string): string | undefined => {
    if (!value) return "Senha é obrigatória";
    if (value.length < 6) return "Senha deve ter no mínimo 6 caracteres";
    return undefined;
  }, []);

  const handleFieldBlur = useCallback((field: "email" | "password") => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
    const value = field === "email" ? email : password;
    const error = field === "email" ? validateEmail(value) : validatePassword(value);
    setFieldErrors((prev) => ({ ...prev, [field]: error }));
  }, [email, password, validateEmail, validatePassword]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email, password, requires2FA ? totpCode : undefined);
      if (result && result.requiresTwoFactor) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }
      toast.success("Login realizado com sucesso!");
      navigate('/app');
    } catch (error: unknown) {
      const code = getErrorCode(error);
      const statusCode = getErrorStatusCode(error);
      let errorMessage = getErrorMessage(error);

      if (code === 'INVALID_TOTP_CODE') {
        errorMessage = "Código 2FA inválido. Tente novamente.";
        setTotpCode("");
      } else if (code === 'NETWORK_ERROR') {
        errorMessage = "Erro de conexão. Verifique se o servidor está rodando.";
      } else if (code === 'INVALID_CREDENTIALS') {
        errorMessage = "Email ou senha incorretos.";
      } else if (statusCode === 401) {
        errorMessage = "Credenciais inválidas.";
      }

      toast.error(errorMessage);
      console.error("Erro de login:", error);
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
            to="/" 
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6 sm:mb-8"
          >
            <ArrowLeft size={20} />
            <span className="text-sm sm:text-base">Voltar para home</span>
          </Link>

          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3 mb-8 sm:mb-10 md:mb-12">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs sm:text-sm">VE</span>
            </div>
            <span className="text-xl sm:text-2xl font-semibold text-gray-900">VYD Engage</span>
          </div>

          {/* Heading */}
          <div className="mb-8 sm:mb-10 md:mb-12">
            <h1 className="text-gray-900 mb-3 text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
              Bem-vindo de volta
            </h1>
            <p className="text-gray-600 text-base sm:text-lg md:text-xl mt-2">
              Entre com suas credenciais para acessar sua conta
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6" ref={autoFocusRef}>
            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-gray-900 text-base sm:text-lg font-medium block">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (touchedFields.email) {
                    setFieldErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
                  }
                }}
                onBlur={() => handleFieldBlur("email")}
                className={`w-full h-12 sm:h-14 px-4 py-3 border rounded-lg bg-white text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${touchedFields.email && fieldErrors.email ? "border-red-500" : "border-gray-300"}`}
                required
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
              <FieldError
                id="email-error"
                error={fieldErrors.email}
                touched={touchedFields.email}
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-gray-900 text-base sm:text-lg font-medium block">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (touchedFields.password) {
                      setFieldErrors((prev) => ({ ...prev, password: validatePassword(e.target.value) }));
                    }
                  }}
                  onBlur={() => handleFieldBlur("password")}
                  className={`w-full h-12 sm:h-14 px-4 py-3 pr-14 border rounded-lg bg-white text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${touchedFields.password && fieldErrors.password ? "border-red-500" : "border-gray-300"}`}
                  required
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword(!showPassword);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 transition-colors focus:outline-none z-10 cursor-pointer flex items-center justify-center"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <EyeOff size={20} className="sm:w-5 sm:h-5" />
                  ) : (
                    <Eye size={20} className="sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>
              <FieldError
                id="password-error"
                error={fieldErrors.password}
                touched={touchedFields.password}
              />
            </div>

            {requires2FA ? (
              <div className="space-y-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2 text-primary">
                  <Shield size={18} />
                  <span className="font-medium text-sm sm:text-base">Autenticação de dois fatores</span>
                </div>
                <p className="text-sm text-gray-600">
                  Insira o código do seu aplicativo autenticador.
                </p>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full h-12 sm:h-14 text-center text-xl tracking-widest border border-gray-300 rounded-lg"
                  autoFocus
                  aria-label="Código de autenticação de dois fatores"
                />
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                  />
                  <span className="text-sm sm:text-base text-gray-600">Lembrar de mim</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm sm:text-base text-primary hover:text-primary-dark font-normal transition-colors whitespace-nowrap"
                >
                  Esqueci minha senha
                </Link>
              </div>
            )}

            <Button
              type="submit"
              disabled={requires2FA && totpCode.length !== 6}
              className="w-full h-12 sm:h-14 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors text-base sm:text-lg mt-6"
            >
              {requires2FA ? "Verificar" : "Entrar"}
            </Button>
          </form>

          {/* Sign up link */}
          <p className="mt-8 sm:mt-10 text-center text-gray-600 text-base sm:text-lg">
            Não tem uma conta?{" "}
            <Link 
              to="/register" 
              className="text-primary hover:text-primary-dark font-medium transition-colors"
            >
              Criar conta gratuita
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:flex flex-1 bg-gray-100 relative overflow-hidden w-full lg:w-1/2">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"></div>
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1641430034785-47f6f91ab6cf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB3b3Jrc3BhY2UlMjBsYXB0b3B8ZW58MXx8fHwxNzYzNzAwMDAxfDA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Modern workspace"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="absolute inset-0 flex items-center justify-center p-6 lg:p-8 xl:p-12 z-10">
          <div className="text-center text-white max-w-md lg:max-w-lg xl:max-w-xl px-4">
            <h3 className="mb-3 sm:mb-4 text-xl lg:text-2xl xl:text-3xl font-semibold leading-tight">
              Organize seus leads e automatize follow-ups
            </h3>
            <p className="text-sm lg:text-base xl:text-lg opacity-90">
              Capture, organize e converta mais leads com automação inteligente via WhatsApp e e-mail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
