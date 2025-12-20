import React, { useState } from "react";
import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { VYDEcosystemBanner } from "../components/VYDEcosystemBanner";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Login realizado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer login");
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
            className="inline-flex items-center gap-2 text-[#6B7280] hover:text-[#1F2937] transition-colors mb-6 sm:mb-8"
          >
            <ArrowLeft size={20} />
            <span className="text-sm sm:text-base">Voltar para home</span>
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
              Bem-vindo de volta
            </h1>
            <p className="text-[#6B7280] text-base sm:text-lg md:text-xl mt-2">
              Entre com suas credenciais para acessar sua conta
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
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

            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-[#1F2937] text-base sm:text-lg font-medium block">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 sm:h-14 px-4 py-3 pr-14 border border-[#E5E7EB] rounded-lg bg-white text-[#1F2937] text-base placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword(!showPassword);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1F2937] transition-colors focus:outline-none z-10 cursor-pointer flex items-center justify-center"
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
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded border-[#E5E7EB] text-[#2563EB] focus:ring-2 focus:ring-[#2563EB] cursor-pointer" 
                />
                <span className="text-sm sm:text-base text-[#6B7280]">Lembrar de mim</span>
              </label>
              <a 
                href="#" 
                className="text-sm sm:text-base text-[#2563EB] hover:text-[#1E40AF] font-normal transition-colors whitespace-nowrap"
              >
                Esqueci minha senha
              </a>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 sm:h-14 bg-[#2563EB] hover:bg-[#1E40AF] text-white font-medium rounded-lg transition-colors text-base sm:text-lg mt-6"
            >
              Entrar
            </Button>
          </form>

          {/* Sign up link */}
          <p className="mt-8 sm:mt-10 text-center text-[#6B7280] text-base sm:text-lg">
            Não tem uma conta?{" "}
            <Link 
              to="/register" 
              className="text-[#2563EB] hover:text-[#1E40AF] font-medium transition-colors"
            >
              Criar conta gratuita
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
