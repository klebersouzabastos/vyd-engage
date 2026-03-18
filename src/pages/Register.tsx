import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoadingButton } from "../components/ui/loading-button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { VYDEcosystemBanner } from "../components/VYDEcosystemBanner";
import { ArrowLeft, Eye, EyeOff, Check, ChevronRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { step1Schema, step2Schema, step3Schema, type Step1FormData, type Step2FormData, type Step3FormData } from "../utils/validation/registerSchema";
import { getErrorMessage } from "../utils/validation/errorMessages";
import { PasswordStrengthIndicator } from "../components/register/PasswordStrengthIndicator";
import { FieldError } from "../components/register/FieldError";
import { FieldSuccess } from "../components/register/FieldSuccess";

type RegisterFormData = Step1FormData & Step2FormData & Step3FormData;

export function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<RegisterFormData>>({});

  // Form para Step 1 (Nome e Empresa)
  const step1Form = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: formData.name || "",
      companyName: formData.companyName || "",
    },
  });

  // Form para Step 2 (Senha)
  const step2Form = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    mode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Atualizar valores do formulário quando formData mudar
  useEffect(() => {
    if (formData.password !== undefined) {
      step2Form.setValue("password", formData.password, { shouldValidate: false });
    }
    if (formData.confirmPassword !== undefined) {
      step2Form.setValue("confirmPassword", formData.confirmPassword, { shouldValidate: false });
    }
  }, [formData.password, formData.confirmPassword]);

  // Form para Step 3 (Email - obrigatório)
  const step3Form = useForm<Step3FormData>({
    resolver: zodResolver(step3Schema),
    mode: "onChange",
    defaultValues: {
      email: "",
    },
  });

  // Atualizar valores do formulário quando formData mudar
  useEffect(() => {
    if (formData.email !== undefined) {
      step3Form.setValue("email", formData.email, { shouldValidate: false });
    }
  }, [formData.email]);

  const password = step2Form.watch("password");
  const watchedFieldsStep1 = step1Form.watch();
  const watchedFieldsStep2 = step2Form.watch();
  const watchedFieldsStep3 = step3Form.watch();

  const handleStep1Submit = (data: Step1FormData) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep(2);
  };

  const handleStep2Submit = (data: Step2FormData) => {
    setFormData((prev) => ({ ...prev, ...data }));
    // Sempre avançar para o Step 3 (Email obrigatório)
    setCurrentStep(3);
  };

  const handleStep3Submit = async (data: Step3FormData) => {
    setIsSubmitting(true);
    try {
      // Validação adicional para garantir que o email seja fornecido
      if (!data.email || data.email.trim() === "") {
        toast.error("O e-mail é obrigatório para criar sua conta.");
        step3Form.setError("email", { message: "Email é obrigatório" });
        setIsSubmitting(false);
        return;
      }

      const finalData: RegisterFormData = {
        ...formData,
        ...data,
      } as RegisterFormData;

      // Validação final antes de enviar
      if (!finalData.email || finalData.email.trim() === "") {
        toast.error("Por favor, informe um e-mail válido.");
        setIsSubmitting(false);
        return;
      }

      await registerUser({
        name: finalData.name,
        email: finalData.email,
        password: finalData.password,
        companyName: finalData.companyName,
      });
      
      toast.success("Conta criada com sucesso! Redirecionando...");
      
      setTimeout(() => {
        navigate("/onboarding");
      }, 1500);
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const steps = [
    { number: 1, title: "Dados pessoais", description: "Nome e empresa" },
    { number: 2, title: "Senha", description: "Crie uma senha segura" },
    { number: 3, title: "E-mail", description: "Seu e-mail de acesso" },
  ];

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
              Criar conta
            </h1>
            <p className="text-gray-600 text-base sm:text-lg md:text-xl mt-2">
              Preencha os dados abaixo para criar sua conta
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all ${
                        currentStep >= step.number
                          ? "bg-primary text-white"
                          : "bg-gray-300 text-gray-600"
                      }`}
                    >
                      {currentStep > step.number ? <Check size={20} /> : step.number}
                    </div>
                    <span className="text-xs mt-2 text-gray-600 text-center max-w-[80px]">
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-2 transition-all ${
                        currentStep > step.number ? "bg-primary" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step 1: Dados pessoais */}
          {currentStep === 1 && (
            <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-5 sm:space-y-6" noValidate>
              {/* Nome completo */}
              <div className="space-y-2.5">
                <Label htmlFor="name" className="text-gray-900 text-base sm:text-lg font-medium block">
                  Nome completo <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome completo"
                    {...step1Form.register("name", {
                      onChange: (e) => {
                        const value = e.target.value ?? "";
                        step1Form.setValue("name", value, { shouldValidate: false, shouldTouch: true });
                      },
                      onBlur: (e) => {
                        const trimmedValue = (e.target.value ?? "").trim();
                        step1Form.setValue("name", trimmedValue, { shouldValidate: true });
                      }
                    })}
                    error={step1Form.formState.errors.name?.message}
                    className="w-full h-12 sm:h-14 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    aria-describedby={step1Form.formState.errors.name ? "name-error" : undefined}
                  />
                  <FieldSuccess
                    isValid={!step1Form.formState.errors.name && step1Form.formState.touchedFields.name && !!watchedFieldsStep1.name}
                    touched={step1Form.formState.touchedFields.name}
                  />
                </div>
                <FieldError
                  id="name-error"
                  error={step1Form.formState.errors.name?.message}
                  touched={step1Form.formState.touchedFields.name}
                  className="mt-1"
                />
              </div>

              {/* Nome da empresa */}
              <div className="space-y-2.5">
                <Label htmlFor="companyName" className="text-gray-900 text-base sm:text-lg font-medium block">
                  Nome da empresa <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Nome da sua empresa"
                    {...step1Form.register("companyName", {
                      onChange: (e) => {
                        const value = e.target.value ?? "";
                        step1Form.setValue("companyName", value, { shouldValidate: false, shouldTouch: true });
                      },
                      onBlur: (e) => {
                        const trimmedValue = (e.target.value ?? "").trim();
                        step1Form.setValue("companyName", trimmedValue, { shouldValidate: true });
                      }
                    })}
                    error={step1Form.formState.errors.companyName?.message}
                    className="w-full h-12 sm:h-14 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    aria-describedby={step1Form.formState.errors.companyName ? "companyName-error" : undefined}
                  />
                  <FieldSuccess
                    isValid={!step1Form.formState.errors.companyName && step1Form.formState.touchedFields.companyName && !!watchedFieldsStep1.companyName}
                    touched={step1Form.formState.touchedFields.companyName}
                  />
                </div>
                <FieldError
                  id="companyName-error"
                  error={step1Form.formState.errors.companyName?.message}
                  touched={step1Form.formState.touchedFields.companyName}
                  className="mt-1"
                />
              </div>

              <LoadingButton
                type="submit"
                loading={false}
                className="w-full h-12 sm:h-14 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors text-base sm:text-lg mt-6 flex items-center justify-center gap-2"
                disabled={!step1Form.formState.isValid}
              >
                Continuar
                <ChevronRight size={20} />
              </LoadingButton>
            </form>
          )}

          {/* Step 2: Senha */}
          {currentStep === 2 && (
            <form onSubmit={step2Form.handleSubmit(handleStep2Submit)} className="space-y-5 sm:space-y-6" noValidate>
              {/* Senha */}
              <div className="space-y-2.5">
                <Label htmlFor="password" className="text-gray-900 text-base sm:text-lg font-medium block">
                  Senha <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...step2Form.register("password", {
                      onChange: (e) => {
                        const value = e.target.value ?? "";
                        step2Form.setValue("password", value, { shouldValidate: false, shouldTouch: true });
                      }
                    })}
                    error={step2Form.formState.errors.password?.message}
                    className="w-full h-12 sm:h-14 px-4 py-3 pr-14 border border-gray-300 rounded-lg bg-white text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    aria-describedby={step2Form.formState.errors.password ? "password-error password-strength" : "password-strength"}
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
                <div id="password-strength">
                  <PasswordStrengthIndicator password={password || ""} />
                </div>
                <FieldError
                  id="password-error"
                  error={step2Form.formState.errors.password?.message}
                  touched={step2Form.formState.touchedFields.password}
                  className="mt-1"
                />
              </div>

              {/* Confirmar senha */}
              <div className="space-y-2.5">
                <Label htmlFor="confirmPassword" className="text-gray-900 text-base sm:text-lg font-medium block">
                  Confirmar senha <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...step2Form.register("confirmPassword")}
                    error={step2Form.formState.errors.confirmPassword?.message}
                    className="w-full h-12 sm:h-14 px-4 py-3 pr-14 border border-gray-300 rounded-lg bg-white text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    aria-describedby={step2Form.formState.errors.confirmPassword ? "confirmPassword-error" : undefined}
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
                <FieldError
                  id="confirmPassword-error"
                  error={step2Form.formState.errors.confirmPassword?.message}
                  touched={step2Form.formState.touchedFields.confirmPassword}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-4 mt-6">
                <LoadingButton
                  type="button"
                  onClick={goToPreviousStep}
                  loading={false}
                  className="flex-1 h-12 sm:h-14 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium rounded-lg transition-colors text-base sm:text-lg"
                >
                  Voltar
                </LoadingButton>
                <LoadingButton
                  type="submit"
                  loading={false}
                  className="flex-1 h-12 sm:h-14 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors text-base sm:text-lg flex items-center justify-center gap-2"
                  disabled={!step2Form.formState.isValid}
                >
                  Continuar
                  <ChevronRight size={20} />
                </LoadingButton>
              </div>
            </form>
          )}

          {/* Step 3: Email (obrigatório) */}
          {currentStep === 3 && (
            <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-5 sm:space-y-6" noValidate>
              {/* Email */}
              <div className="space-y-2.5">
                <Label htmlFor="email" className="text-gray-900 text-base sm:text-lg font-medium block">
                  E-mail <span className="text-red-500">*</span>
                  <span className="text-sm text-gray-600 font-normal ml-2">(obrigatório)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    {...step3Form.register("email")}
                    error={step3Form.formState.errors.email?.message}
                    className="w-full h-12 sm:h-14 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    aria-describedby={step3Form.formState.errors.email ? "email-error email-help" : "email-help"}
                    aria-required="true"
                  />
                  <FieldSuccess
                    isValid={!step3Form.formState.errors.email && step3Form.formState.touchedFields.email && !!watchedFieldsStep3.email && watchedFieldsStep3.email.trim() !== ""}
                    touched={step3Form.formState.touchedFields.email}
                  />
                </div>
                <p id="email-help" className="text-sm text-gray-600 mt-1">
                  Este campo é obrigatório para criar sua conta.
                </p>
                <FieldError
                  id="email-error"
                  error={step3Form.formState.errors.email?.message}
                  touched={step3Form.formState.touchedFields.email}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-4 mt-6">
                <LoadingButton
                  type="button"
                  onClick={goToPreviousStep}
                  loading={false}
                  className="flex-1 h-12 sm:h-14 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium rounded-lg transition-colors text-base sm:text-lg"
                  disabled={isSubmitting}
                >
                  Voltar
                </LoadingButton>
                <LoadingButton
                  type="submit"
                  loading={isSubmitting}
                  loadingText="Criando conta..."
                  className="flex-1 h-12 sm:h-14 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors text-base sm:text-lg"
                  disabled={isSubmitting || !step3Form.formState.isValid}
                >
                  Criar conta
                </LoadingButton>
              </div>
            </form>
          )}

          {/* Sign in link */}
          <p className="mt-8 sm:mt-10 text-center text-gray-600 text-base sm:text-lg">
            Já tem uma conta?{" "}
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
              Comece a vender mais hoje
            </h3>
            <p className="text-sm lg:text-base xl:text-lg opacity-90">
              Junte-se a centenas de empresas que já estão usando o VYD Engage para aumentar suas vendas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
