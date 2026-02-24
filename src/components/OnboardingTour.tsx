import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import { Button } from "./ui/button";
import { X, ArrowRight, ArrowLeft } from "lucide-react";

interface TourStep {
  target: string; // CSS selector
  title: string;
  description: string;
  route?: string; // Navigate to this route before showing
  position?: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='dashboard-stats']",
    title: "Painel de Controle",
    description:
      "Aqui você tem uma visão geral de todos os seus leads, tarefas e métricas importantes do seu CRM.",
    route: "/app",
    position: "bottom",
  },
  {
    target: "[data-tour='sidebar-leads']",
    title: "Gerenciamento de Leads",
    description:
      "Acesse a lista de leads para cadastrar, organizar e acompanhar seus contatos e oportunidades.",
    position: "right",
  },
  {
    target: "[data-tour='sidebar-tasks']",
    title: "Tarefas e Lembretes",
    description:
      "Crie tarefas vinculadas aos seus leads para nunca perder um follow-up importante.",
    position: "right",
  },
  {
    target: "[data-tour='sidebar-automations']",
    title: "Automações",
    description:
      "Configure fluxos automáticos de WhatsApp e e-mail para engajar seus leads sem esforço manual.",
    position: "right",
  },
  {
    target: "[data-tour='sidebar-pipeline']",
    title: "Pipeline de Vendas",
    description:
      "Visualize seu funil de vendas no estilo Kanban e arraste leads entre as etapas.",
    position: "right",
  },
];

const TOUR_STORAGE_KEY = "vyd-engage-tour-completed";

export function OnboardingTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed && location.pathname.startsWith("/app")) {
      const timer = setTimeout(() => setIsActive(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  const positionTooltip = useCallback(() => {
    const step = TOUR_STEPS[currentStep];
    const el = document.querySelector(step.target);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const pos = step.position || "bottom";
    const style: React.CSSProperties = { position: "fixed", zIndex: 10001 };

    switch (pos) {
      case "bottom":
        style.top = rect.bottom + 12;
        style.left = rect.left + rect.width / 2;
        style.transform = "translateX(-50%)";
        break;
      case "top":
        style.bottom = window.innerHeight - rect.top + 12;
        style.left = rect.left + rect.width / 2;
        style.transform = "translateX(-50%)";
        break;
      case "right":
        style.top = rect.top + rect.height / 2;
        style.left = rect.right + 12;
        style.transform = "translateY(-50%)";
        break;
      case "left":
        style.top = rect.top + rect.height / 2;
        style.right = window.innerWidth - rect.left + 12;
        style.transform = "translateY(-50%)";
        break;
    }

    setTooltipStyle(style);
  }, [currentStep]);

  // Close tour on Escape key
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") completeTour();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    const step = TOUR_STEPS[currentStep];
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      const timer = setTimeout(positionTooltip, 500);
      return () => clearTimeout(timer);
    }

    positionTooltip();
    window.addEventListener("resize", positionTooltip);
    return () => window.removeEventListener("resize", positionTooltip);
  }, [isActive, currentStep, location.pathname, navigate, positionTooltip]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeTour = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setIsActive(false);
  };

  if (!isActive) return null;

  const step = TOUR_STEPS[currentStep];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-[10000]"
        onClick={completeTour}
      />

      {/* Highlight target element */}
      <HighlightElement selector={step.target} />

      {/* Tooltip */}
      <div
        style={tooltipStyle}
        className="bg-white rounded-lg shadow-lg border border-gray-300 p-5 w-80 z-[10001]"
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold text-gray-900">{step.title}</h4>
          <button
            onClick={completeTour}
            className="p-1 hover:bg-gray-200 rounded"
            aria-label="Fechar tour"
          >
            <X size={14} className="text-gray-500" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">{step.description}</p>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {currentStep + 1} de {TOUR_STEPS.length}
          </span>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrev}>
                <ArrowLeft size={14} />
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {currentStep === TOUR_STEPS.length - 1 ? (
                "Concluir"
              ) : (
                <>
                  Próximo <ArrowRight size={14} className="ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function HighlightElement({ selector }: { selector: string }) {
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const el = document.querySelector(selector);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setStyle({
      position: "fixed",
      top: rect.top - 4,
      left: rect.left - 4,
      width: rect.width + 8,
      height: rect.height + 8,
      borderRadius: 8,
      boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
      zIndex: 10000,
      pointerEvents: "none",
      background: "transparent",
    });
  }, [selector]);

  return <div style={style} />;
}
