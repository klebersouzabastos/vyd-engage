import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { VYDEcosystemBanner } from '../components/VYDEcosystemBanner';
import { ArrowLeft, Mail } from 'lucide-react';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';
import { getErrorMessage, getErrorCode, getErrorStatusCode } from '../utils/errors';
import { FieldError } from '../components/register/FieldError';
import { useAutoFocus } from '../hooks/useFocusManagement';

export function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);
  const autoFocusRef = useAutoFocus<HTMLFormElement>(!sent);

  const validateEmail = useCallback((value: string): string | undefined => {
    if (!value.trim()) return 'E-mail é obrigatório';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value.trim())) return 'Formato de e-mail inválido';
    return undefined;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    const error = validateEmail(email);
    setFieldError(error);
    if (error) return;

    setLoading(true);
    try {
      // Normalize email before sending
      const normalizedEmail = email.trim().toLowerCase();

      await apiClient.requestPasswordReset(normalizedEmail);
      setSent(true);
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (error: unknown) {
      const code = getErrorCode(error);
      const statusCode = getErrorStatusCode(error);
      let errorMessage = getErrorMessage(error);

      if (code === 'NETWORK_ERROR') {
        errorMessage = 'Erro de conexão. Verifique se o servidor está rodando.';
      } else if (code === 'VALIDATION_ERROR' || statusCode === 400) {
        errorMessage = 'Email inválido. Verifique o formato e tente novamente.';
      } else if (statusCode >= 500) {
        errorMessage = 'Erro no servidor. Tente novamente mais tarde.';
      }

      toast.error(errorMessage);
      console.error('Erro ao solicitar recuperação de senha:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-card">
      {/* VYD Ecosystem Banner */}
      <VYDEcosystemBanner />

      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-20 bg-card w-full lg:w-1/2">
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
              Esqueci minha senha
            </h1>
            <p className="text-gray-600 text-base sm:text-lg md:text-xl mt-2">
              {sent
                ? 'Enviamos um email com instruções para redefinir sua senha.'
                : 'Digite seu email e enviaremos um link para redefinir sua senha.'}
            </p>
          </div>

          {!sent ? (
            <form
              onSubmit={handleSubmit}
              className="space-y-5 sm:space-y-6"
              ref={autoFocusRef}
              noValidate
            >
              <div className="space-y-2.5">
                <Label
                  htmlFor="email"
                  className="text-gray-900 text-base sm:text-lg font-medium block"
                >
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (touched) {
                      setFieldError(validateEmail(e.target.value));
                    }
                  }}
                  onBlur={() => {
                    setTouched(true);
                    setFieldError(validateEmail(email));
                  }}
                  className={`w-full h-12 sm:h-14 px-4 py-3 border rounded-lg bg-card text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${touched && fieldError ? 'border-red-500' : 'border-gray-300'}`}
                  aria-describedby={fieldError && touched ? 'forgot-email-error' : undefined}
                />
                <FieldError id="forgot-email-error" error={fieldError} touched={touched} />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 sm:h-14 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors text-base sm:text-lg mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-primary/10 rounded-full">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center space-y-4">
                <p className="text-gray-600 text-base sm:text-lg">
                  Verifique sua caixa de entrada em <strong>{email}</strong> e siga as instruções
                  para redefinir sua senha.
                </p>
                <p className="text-sm text-gray-400">
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
                  className="w-full sm:w-auto bg-primary hover:bg-primary-dark"
                >
                  Voltar para login
                </Button>
              </div>
            </div>
          )}

          {/* Sign up link */}
          <p className="mt-8 sm:mt-10 text-center text-gray-600 text-base sm:text-lg">
            Lembrou sua senha?{' '}
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
