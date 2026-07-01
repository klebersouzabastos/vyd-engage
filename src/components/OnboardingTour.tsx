import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Button } from './ui/button';
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';

interface TourStep {
  target?: string; // CSS selector — omit for welcome overlay
  title: string;
  description: string;
  route?: string; // Navigate to this route before showing
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Bem-vindo ao VYD Engage!',
    description:
      'Vamos fazer um tour rápido para você conhecer as principais funcionalidades do seu CRM. Leva menos de 1 minuto.',
    position: 'center',
  },
  {
    target: "[data-tour='dashboard-stats']",
    title: 'Painel de Controle',
    description:
      'Aqui você vê o resumo do seu CRM — total de leads, tarefas pendentes e métricas importantes.',
    route: '/app',
    position: 'bottom',
  },
  {
    target: "[data-tour='sidebar-leads']",
    title: 'Gerenciamento de Leads',
    description:
      'Acesse a lista de leads para cadastrar, organizar e acompanhar seus contatos e oportunidades.',
    position: 'right',
  },
  {
    target: "[data-tour='create-lead-btn']",
    title: 'Crie seu Primeiro Lead',
    description:
      'Clique aqui para adicionar seu primeiro lead e começar a gerenciar seus contatos.',
    route: '/app/leads',
    position: 'bottom',
  },
  {
    target: "[data-tour='sidebar-tasks']",
    title: 'Tarefas e Follow-ups',
    description:
      'Organize suas tarefas e lembretes vinculados aos leads para nunca perder um follow-up importante.',
    position: 'right',
  },
];

const TOUR_STORAGE_KEY = 'vyd-engage-tour-completed';

export function OnboardingTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [waitingForRoute, setWaitingForRoute] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed && location.pathname.startsWith('/app')) {
      const timer = setTimeout(() => setIsActive(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []); // Run once on mount

  const positionTooltip = useCallback(() => {
    const step = TOUR_STEPS[currentStep];

    // Center position = welcome overlay, no target needed
    if (step.position === 'center' || !step.target) {
      setTooltipStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
      });
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
      // Element not found yet — retry shortly (e.g. page still loading)
      // eslint-disable-next-line react-hooks/immutability -- recursão intencional de retry; preserva comportamento
      const retry = setTimeout(() => positionTooltip(), 300);
      return () => clearTimeout(retry);
    }

    const rect = el.getBoundingClientRect();
    const pos = step.position || 'bottom';
    const style: React.CSSProperties = { position: 'fixed', zIndex: 10001 };

    switch (pos) {
      case 'bottom':
        style.top = rect.bottom + 12;
        style.left = rect.left + rect.width / 2;
        style.transform = 'translateX(-50%)';
        break;
      case 'top':
        style.bottom = window.innerHeight - rect.top + 12;
        style.left = rect.left + rect.width / 2;
        style.transform = 'translateX(-50%)';
        break;
      case 'right':
        style.top = rect.top + rect.height / 2;
        style.left = rect.right + 12;
        style.transform = 'translateY(-50%)';
        break;
      case 'left':
        style.top = rect.top + rect.height / 2;
        style.right = window.innerWidth - rect.left + 12;
        style.transform = 'translateY(-50%)';
        break;
    }

    setTooltipStyle(style);
  }, [currentStep]);

  // Close tour on Escape key
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // eslint-disable-next-line react-hooks/immutability -- completeTour é declarada abaixo; preserva comportamento
      if (e.key === 'Escape') completeTour();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  // Handle route navigation and tooltip positioning
  useEffect(() => {
    if (!isActive) return;

    const step = TOUR_STEPS[currentStep];

    // If step requires a route change and we're not there yet
    if (step.route && location.pathname !== step.route) {
      setWaitingForRoute(true);
      navigate(step.route);
      return;
    }

    // If we were waiting for route and now we're on the right page
    if (waitingForRoute) {
      setWaitingForRoute(false);
      // Give the page time to render before positioning
      const timer = setTimeout(positionTooltip, 600);
      return () => clearTimeout(timer);
    }

    positionTooltip();
    window.addEventListener('resize', positionTooltip);
    return () => window.removeEventListener('resize', positionTooltip);
  }, [isActive, currentStep, location.pathname, navigate, positionTooltip, waitingForRoute]);

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
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsActive(false);
  };

  if (!isActive) return null;

  const step = TOUR_STEPS[currentStep];
  const isWelcome = step.position === 'center';

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-[10000]"
        role="button"
        tabIndex={0}
        aria-label="Fechar tour"
        onClick={completeTour}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (e.key === ' ') e.preventDefault();
            completeTour();
          }
        }}
      />

      {/* Highlight target element (skip for welcome/center step) */}
      {!isWelcome && step.target && <HighlightElement selector={step.target} />}

      {/* Tooltip */}
      <div
        style={tooltipStyle}
        className={`bg-white rounded-lg shadow-xl border border-gray-300 p-5 z-[10001] ${
          isWelcome ? 'w-96 text-center' : 'w-80'
        }`}
      >
        {/* Welcome icon */}
        {isWelcome && (
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Sparkles className="text-primary" size={24} />
            </div>
          </div>
        )}

        <div
          className={`flex items-start justify-between mb-2 ${isWelcome ? 'justify-center' : ''}`}
        >
          <h4 className={`font-semibold text-gray-900 ${isWelcome ? 'text-lg' : ''}`}>
            {step.title}
          </h4>
          {!isWelcome && (
            <button
              onClick={completeTour}
              className="p-1 hover:bg-gray-200 rounded ml-2 flex-shrink-0"
              aria-label="Fechar tour"
            >
              <X size={14} className="text-gray-500" />
            </button>
          )}
        </div>
        <p className={`text-sm text-gray-600 mb-4 ${isWelcome ? 'mb-6' : ''}`}>
          {step.description}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {currentStep + 1} de {TOUR_STEPS.length}
          </span>
          <div className="flex gap-2">
            {currentStep === 0 ? (
              <Button variant="ghost" size="sm" onClick={completeTour} className="text-gray-500">
                Pular tour
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handlePrev}>
                <ArrowLeft size={14} />
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {currentStep === 0 ? (
                <>
                  Começar <ArrowRight size={14} className="ml-1" />
                </>
              ) : currentStep === TOUR_STEPS.length - 1 ? (
                'Concluir'
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
    const update = () => {
      const el = document.querySelector(selector);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      setStyle({
        position: 'fixed',
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
        borderRadius: 8,
        boxShadow: '0 0 0 9999px color-mix(in oklab, var(--vyd-neutral-0) 55%, transparent)',
        zIndex: 10000,
        pointerEvents: 'none',
        background: 'transparent',
      });
    };

    // Initial positioning with a small delay for render
    const timer = setTimeout(update, 100);
    return () => clearTimeout(timer);
  }, [selector]);

  return <div style={style} />;
}
