import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { VYDEcosystemBanner } from "../components/VYDEcosystemBanner";
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? window.location.origin
    : 'http://localhost:3001'
);

export function AcceptInvitation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Informe seu nome'); return; }
    if (password.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return; }
    if (password !== confirm) { toast.error('As senhas não coincidem'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: name.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao aceitar convite');
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const RightPanel = () => (
    <div className="hidden lg:flex flex-1 bg-gray-100 relative overflow-hidden w-full lg:w-1/2">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
      <ImageWithFallback
        src="https://images.unsplash.com/photo-1641430034785-47f6f91ab6cf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB3b3Jrc3BhY2UlMjBsYXB0b3B8ZW58MXx8fHwxNzYzNzAwMDAxfDA&ixlib=rb-4.1.0&q=80&w=1080"
        alt="Modern workspace"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-0 flex items-center justify-center p-6 lg:p-8 xl:p-12 z-10">
        <div className="text-center text-white max-w-md lg:max-w-lg xl:max-w-xl px-4">
          <h3 className="mb-3 sm:mb-4 text-xl lg:text-2xl xl:text-3xl font-semibold leading-tight">
            Comece a trabalhar agora
          </h3>
          <p className="text-sm lg:text-base xl:text-lg opacity-90">
            Sua conta está pronta em instantes. Crie sua senha e acesse o VYD Engage.
          </p>
        </div>
      </div>
    </div>
  );

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <VYDEcosystemBanner />
        <div className="flex-1 flex flex-col lg:flex-row">
          <div className="flex-1 flex flex-col justify-center items-center px-6 bg-white">
            <AlertCircle size={48} className="text-red-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Link inválido</h2>
            <p className="text-gray-500">O link de convite não contém um token válido.</p>
          </div>
          <RightPanel />
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <VYDEcosystemBanner />
        <div className="flex-1 flex flex-col lg:flex-row">
          <div className="flex-1 flex flex-col justify-center items-center px-6 bg-white">
            <CheckCircle size={48} className="text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Conta criada!</h2>
            <p className="text-gray-500">Redirecionando para o login…</p>
          </div>
          <RightPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <VYDEcosystemBanner />

      <div className="flex-1 flex flex-col lg:flex-row">
      {/* Left side — form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-20 bg-white w-full lg:w-1/2">
        <div className="w-full max-w-2xl sm:max-w-2xl md:max-w-2xl lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl mx-auto py-10 sm:py-12 md:py-14 lg:py-16">

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
              Você foi convidado!
            </h1>
            <p className="text-gray-600 text-base sm:text-lg md:text-xl mt-2">
              Crie sua senha para acessar sua conta.
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mb-6 flex items-start gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div className="space-y-2.5">
              <Label htmlFor="name" className="text-gray-900 text-base sm:text-lg font-medium block">
                Seu nome
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Nome completo"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full h-12 sm:h-14 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-gray-900 text-base sm:text-lg font-medium block">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-12 sm:h-14 px-4 py-3 pr-14 border border-gray-300 rounded-lg bg-white text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="confirm" className="text-gray-900 text-base sm:text-lg font-medium block">
                Confirmar senha
              </Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repita a senha"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full h-12 sm:h-14 px-4 py-3 pr-14 border border-gray-300 rounded-lg bg-white text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 transition-colors focus:outline-none"
                  aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 sm:h-14 bg-primary hover:bg-primary/90 text-white font-semibold text-base rounded-lg transition-all mt-2"
            >
              {loading && <Loader2 size={18} className="mr-2 animate-spin" />}
              Criar conta e entrar
            </Button>
          </form>
        </div>
      </div>

      <RightPanel />
      </div>
    </div>
  );
}
