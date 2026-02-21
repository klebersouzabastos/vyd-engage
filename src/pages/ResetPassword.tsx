import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { VYDEcosystemBanner } from "../components/VYDEcosystemBanner";
import { ArrowLeft, Eye, EyeOff, CheckCircle } from "lucide-react";
import { apiClient } from "../services/api/client";
import { toast } from "sonner";
import { PasswordStrengthIndicator } from "../components/register/PasswordStrengthIndicator";

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error("Token de recuperação inválido ou ausente");
      navigate("/forgot-password");
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }

    if (!token) {
      toast.error("Token inválido");
      return;
    }

    setLoading(true);
    try {
      await apiClient.resetPassword(token, password);
      setSuccess(true);
      toast.success("Senha redefinida com sucesso!");
      
      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error: any) {
      toast.error(error.message || "Erro ao redefinir senha. O token pode ter expirado.");
      console.error("Erro ao redefinir senha:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null;
  }

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
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6 sm:mb-8"
          >
            <ArrowLeft size={20} />
            <span className="text-sm sm:text-base">Voltar para login</span>
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
              Redefinir senha
            </h1>
            <p className="text-gray-600 text-base sm:text-lg md:text-xl mt-2">
              {success 
                ? "Sua senha foi redefinida com sucesso!"
                : "Digite sua nova senha abaixo"
              }
            </p>
          </div>

          {success ? (
            <div className="space-y-6">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-100 rounded-full">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-center space-y-4">
                <p className="text-gray-600 text-base sm:text-lg">
                  Sua senha foi alterada com sucesso. Você será redirecionado para a página de login em instantes.
                </p>
              </div>
              <Button
                onClick={() => navigate("/login")}
                className="w-full h-12 sm:h-14 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors text-base sm:text-lg"
              >
                Ir para login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div className="space-y-2.5">
                <Label htmlFor="password" className="text-gray-900 text-base sm:text-lg font-medium block">
                  Nova senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 sm:h-14 px-4 py-3 pr-14 border border-gray-300 rounded-lg bg-white text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    required
                    minLength={8}
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
                {password && <PasswordStrengthIndicator password={password} />}
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="confirmPassword" className="text-gray-900 text-base sm:text-lg font-medium block">
                  Confirmar nova senha
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-12 sm:h-14 px-4 py-3 pr-14 border border-gray-300 rounded-lg bg-white text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowConfirmPassword(!showConfirmPassword);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 transition-colors focus:outline-none z-10 cursor-pointer flex items-center justify-center"
                    aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                    tabIndex={0}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} className="sm:w-5 sm:h-5" />
                    ) : (
                      <Eye size={20} className="sm:w-5 sm:h-5" />
                    )}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-sm text-red-600">As senhas não coincidem</p>
                )}
              </div>

              <Button 
                type="submit" 
                disabled={loading || password !== confirmPassword || password.length < 8}
                className="w-full h-12 sm:h-14 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors text-base sm:text-lg mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Redefinindo..." : "Redefinir senha"}
              </Button>
            </form>
          )}

          {/* Sign up link */}
          <p className="mt-8 sm:mt-10 text-center text-gray-600 text-base sm:text-lg">
            Lembrou sua senha?{" "}
            <Link 
              to="/login" 
              className="text-primary hover:text-primary-dark font-medium transition-colors"
            >
              Fazer login
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
              Crie uma senha segura
            </h3>
            <p className="text-sm lg:text-base xl:text-lg opacity-90">
              Use uma combinação de letras, números e caracteres especiais para maior segurança.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


