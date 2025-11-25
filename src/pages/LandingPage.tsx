import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { 
  Users, 
  Zap, 
  GitBranch, 
  Mail, 
  MessageSquare, 
  BarChart3, 
  CheckCircle, 
  Star,
  ArrowRight,
  Menu
} from "lucide-react";

export function LandingPage() {
  const features = [
    {
      icon: Users,
      title: "Captura Inteligente de Leads",
      description: "Formulários personalizados e integrações com Meta Ads, Google Ads e mais",
    },
    {
      icon: GitBranch,
      title: "Pipeline Visual",
      description: "Organize seus leads em um funil kanban intuitivo e fácil de usar",
    },
    {
      icon: Zap,
      title: "Automação Poderosa",
      description: "Configure follow-ups automáticos via WhatsApp e e-mail sem programar",
    },
    {
      icon: BarChart3,
      title: "Relatórios em Tempo Real",
      description: "Acompanhe métricas importantes e tome decisões baseadas em dados",
    },
    {
      icon: MessageSquare,
      title: "WhatsApp Business API",
      description: "Envie mensagens automatizadas diretamente para o WhatsApp dos seus leads",
    },
    {
      icon: Mail,
      title: "E-mail Marketing",
      description: "Crie campanhas de e-mail personalizadas e automatizadas",
    },
  ];

  const testimonials = [
    {
      name: "Maria Santos",
      role: "CEO da TechSolutions",
      content: "O FlowCRM transformou nossa gestão de leads. Aumentamos nossa conversão em 45% no primeiro mês!",
      rating: 5,
    },
    {
      name: "João Oliveira",
      role: "Gerente de Vendas",
      content: "A automação via WhatsApp é incrível. Economizamos horas de trabalho manual todos os dias.",
      rating: 5,
    },
    {
      name: "Ana Costa",
      role: "Fundadora da StartupX",
      content: "Interface intuitiva e fácil de usar. Implementamos em menos de 1 hora!",
      rating: 5,
    },
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "97",
      features: [
        "Até 250 leads",
        "1 usuário",
        "5 automações",
        "WhatsApp + E-mail",
        "Suporte por e-mail",
      ],
    },
    {
      name: "Pro",
      price: "197",
      features: [
        "Até 1.000 leads",
        "5 usuários",
        "Automações ilimitadas",
        "WhatsApp + E-mail",
        "Suporte prioritário",
        "Integrações avançadas",
      ],
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "497",
      features: [
        "Leads ilimitados",
        "Usuários ilimitados",
        "Automações ilimitadas",
        "WhatsApp + E-mail + SMS",
        "Suporte 24/7",
        "API customizada",
        "Gerente de conta dedicado",
      ],
    },
  ];

  const faqs = [
    {
      question: "Como funciona o período de teste?",
      answer: "Você tem 14 dias para testar todas as funcionalidades gratuitamente, sem precisar de cartão de crédito.",
    },
    {
      question: "Posso cancelar a qualquer momento?",
      answer: "Sim! Não há fidelidade. Você pode cancelar sua assinatura quando quiser.",
    },
    {
      question: "Preciso de conhecimento técnico?",
      answer: "Não! O FlowCRM foi projetado para ser extremamente intuitivo. Qualquer pessoa consegue usar.",
    },
    {
      question: "Como funciona a integração com WhatsApp?",
      answer: "Usamos a API oficial do WhatsApp Business. Basta conectar sua conta e começar a enviar mensagens automatizadas.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-[#E5E7EB] z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-[#2563EB] flex items-center justify-center">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="text-xl font-semibold text-[#1F2937]">FlowCRM</span>
            </div>

            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-[#6B7280] hover:text-[#1F2937] transition-colors">
                Funcionalidades
              </a>
              <a href="#pricing" className="text-[#6B7280] hover:text-[#1F2937] transition-colors">
                Preços
              </a>
              <a href="#testimonials" className="text-[#6B7280] hover:text-[#1F2937] transition-colors">
                Depoimentos
              </a>
              <a href="#faq" className="text-[#6B7280] hover:text-[#1F2937] transition-colors">
                FAQ
              </a>
            </nav>

            <div className="flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost">Entrar</Button>
              </Link>
              <Link to="/onboarding">
                <Button className="bg-[#2563EB] hover:bg-[#1E40AF]">
                  Começar Grátis
                </Button>
              </Link>
              <button className="md:hidden">
                <Menu size={24} className="text-[#6B7280]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-[#1F2937] mb-6">
                Capture, Organize e Converta Mais Leads
              </h1>
              <p className="text-xl text-[#6B7280] mb-8">
                CRM simples e poderoso com automação inteligente via WhatsApp e e-mail. 
                Aumente suas vendas sem aumentar sua equipe.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link to="/onboarding">
                  <Button size="lg" className="bg-[#2563EB] hover:bg-[#1E40AF] gap-2">
                    Criar Conta Gratuita
                    <ArrowRight size={20} />
                  </Button>
                </Link>
                <Button size="lg" variant="outline">
                  Assistir Demo
                </Button>
              </div>
              <div className="flex items-center gap-6 text-sm text-[#6B7280]">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-[#16A34A]" />
                  <span>14 dias grátis</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-[#16A34A]" />
                  <span>Sem cartão de crédito</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-[#16A34A]" />
                  <span>Cancele quando quiser</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#2563EB]/20 to-[#3B82F6]/20 rounded-2xl transform rotate-3"></div>
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1577563682708-4f022ec774fb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncm93dGglMjBjaGFydCUyMHN1Y2Nlc3N8ZW58MXx8fHwxNzYzNzc2MzUwfDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Dashboard preview"
                className="relative rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 bg-[#F9FAFB]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-8">
            <p className="text-[#6B7280]">Empresas que confiam no FlowCRM</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center opacity-50">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-[#E5E7EB] rounded flex items-center justify-center">
                <span className="text-[#6B7280]">Logo {i}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[#1F2937] mb-4">Tudo que você precisa para vender mais</h2>
            <p className="text-xl text-[#6B7280] max-w-2xl mx-auto">
              Ferramentas poderosas para capturar, organizar e converter leads em clientes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="p-6 rounded-lg border border-[#E5E7EB] hover:border-[#2563EB] hover:shadow-md transition-all">
                  <div className="w-12 h-12 bg-[#2563EB]/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="text-[#2563EB]" size={24} />
                  </div>
                  <h3 className="text-[#1F2937] mb-2">{feature.title}</h3>
                  <p className="text-[#6B7280]">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-6 bg-[#F9FAFB]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1761195696590-3490ea770aa1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhdXRvbWF0aW9uJTIwdGVjaG5vbG9neXxlbnwxfHx8fDE3NjM3NzI0ODR8MA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Automation"
                className="rounded-2xl shadow-xl"
              />
            </div>
            <div>
              <h2 className="text-[#1F2937] mb-6">
                Automação que realmente funciona
              </h2>
              <p className="text-lg text-[#6B7280] mb-8">
                Configure fluxos de automação personalizados em minutos, não em dias. 
                Envie mensagens no momento certo, para a pessoa certa, pelo canal certo.
              </p>
              <div className="space-y-4">
                {[
                  "Configure em minutos, não em horas",
                  "Sem necessidade de programação",
                  "Personalize com variáveis dinâmicas",
                  "Acompanhe resultados em tempo real",
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle size={20} className="text-[#16A34A] flex-shrink-0" />
                    <span className="text-[#1F2937]">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[#1F2937] mb-4">O que nossos clientes dizem</h2>
            <p className="text-xl text-[#6B7280]">
              Mais de 500 empresas já usam o FlowCRM
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="p-6 rounded-lg bg-white border border-[#E5E7EB] shadow-sm">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} size={16} className="fill-[#F59E0B] text-[#F59E0B]" />
                  ))}
                </div>
                <p className="text-[#1F2937] mb-4">"{testimonial.content}"</p>
                <div>
                  <p className="font-medium text-[#1F2937]">{testimonial.name}</p>
                  <p className="text-sm text-[#6B7280]">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 bg-[#F9FAFB]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[#1F2937] mb-4">Planos transparentes</h2>
            <p className="text-xl text-[#6B7280]">
              Escolha o plano ideal para o seu negócio
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`
                  p-8 rounded-lg bg-white border-2 
                  ${plan.highlighted 
                    ? 'border-[#2563EB] shadow-xl scale-105' 
                    : 'border-[#E5E7EB]'
                  }
                `}
              >
                {plan.highlighted && (
                  <span className="inline-block px-3 py-1 bg-[#2563EB] text-white text-xs rounded-full mb-4">
                    Mais Popular
                  </span>
                )}
                <h3 className="text-[#1F2937] mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-[#1F2937]">R$ {plan.price}</span>
                  <span className="text-[#6B7280]">/mês</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle size={20} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
                      <span className="text-[#6B7280]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/onboarding">
                  <Button
                    className={`w-full ${
                      plan.highlighted
                        ? 'bg-[#2563EB] hover:bg-[#1E40AF]'
                        : 'bg-white border-2 border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB] hover:text-white'
                    }`}
                  >
                    Começar Agora
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[#1F2937] mb-4">Perguntas Frequentes</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="p-6 rounded-lg bg-white border border-[#E5E7EB]">
                <h4 className="text-[#1F2937] mb-2">{faq.question}</h4>
                <p className="text-[#6B7280]">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-[#2563EB] to-[#3B82F6]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-white mb-6">
            Pronto para aumentar suas vendas?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Junte-se a centenas de empresas que já estão vendendo mais com o FlowCRM
          </p>
          <Link to="/onboarding">
            <Button size="lg" className="bg-white text-[#2563EB] hover:bg-white/90">
              Começar Agora - É Grátis
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-[#1F2937]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center">
                  <span className="text-white font-bold">F</span>
                </div>
                <span className="text-white font-semibold">FlowCRM</span>
              </div>
              <p className="text-[#9CA3AF] text-sm">
                O CRM que ajuda você a vender mais, automaticamente.
              </p>
            </div>
            <div>
              <h4 className="text-white font-medium mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-[#9CA3AF]">
                <li><a href="#" className="hover:text-white transition-colors">Funcionalidades</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Preços</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrações</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-medium mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-[#9CA3AF]">
                <li><a href="#" className="hover:text-white transition-colors">Sobre</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contato</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-medium mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-[#9CA3AF]">
                <li><a href="#" className="hover:text-white transition-colors">Privacidade</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Termos</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-[#374151]">
            <p className="text-center text-sm text-[#9CA3AF]">
              © 2024 FlowCRM. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
