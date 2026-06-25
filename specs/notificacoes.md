# Spec: Sistema de Notificações In-App

## Objetivo

Sistema de notificações em tempo real dentro do VYD Engage que avisa cada usuário quando eventos relevantes acontecem — lead atribuído, tarefa vencida, deal movido de etapa ou menção em comentário. Resolve o problema de usuários perderem eventos importantes por precisarem atualizar a página manualmente, aumentando a velocidade de resposta e visibilidade do time de vendas.

## Usuários

Todos os perfis do CRM: vendedores (uso intenso durante o dia, em campo ou escritório), gestores (acompanhamento de equipe) e admins. Acesso exclusivamente via web — mobile fora do escopo desta versão. Nível técnico variado; a interface deve ser autoexplicativa.

## Requisitos

### Obrigatórios

1. O sistema deve entregar notificações ao usuário destinatário em tempo real (menos de 2 segundos após o evento) sem que o usuário precise recarregar a página, via Socket.IO já configurado no projeto.
2. O sistema deve persistir todas as notificações no banco de dados (PostgreSQL via Prisma) com status `lida` ou `não_lida`, garantindo que fiquem disponíveis após fechamento e reabertura do browser.
3. O sistema deve exibir um ícone de sino no header com badge numérico indicando a contagem de notificações não lidas do usuário autenticado.
4. O sistema deve entregar notificações para os seguintes eventos:
   - **Lead atribuído:** usuário recebe notificação quando um lead é atribuído a ele.
   - **Task vencida ou próxima do vencimento:** usuário responsável recebe notificação quando uma tarefa sua vence ou está a menos de 24h do prazo.
   - **Deal movido de etapa:** usuário responsável pelo deal recebe notificação quando o deal muda de coluna no funil.
   - **Menção em comentário:** usuário recebe notificação quando é mencionado (`@usuario`) em um comentário de lead, deal ou task.
5. O sistema deve redirecionar o usuário para o contexto correto ao clicar em uma notificação: notificações de lead abrem a página do lead; de deal, a página do deal; de task, a página da task; de menção, o item onde ocorreu a menção.
6. O sistema deve permitir marcar uma notificação individual como lida; o badge deve decrementar imediatamente.
7. O sistema deve oferecer ação "Marcar todas como lidas" que marca todas as notificações não lidas do usuário e zera o badge.
8. O sistema deve isolar completamente as notificações por `tenantId` e `userId` — um usuário jamais vê notificações de outro usuário ou de outro tenant.
9. O sistema deve entregar notificações acumuladas (geradas enquanto o usuário estava offline) na reconexão via Socket.IO, consultando as notificações não lidas persistidas no banco.

### Fora do Escopo

- Notificações por email.
- Push notifications (browser ou mobile).
- Configurações de preferência de notificação por usuário (quais tipos receber, silenciar, horários).
- Agrupamento ou categorização de notificações na interface.
- Expiração automática ou deleção de notificações antigas.
- Aplicativo mobile.

## Restrições

- **Stack:** Node.js + Express + Prisma (backend); React + Socket.IO client (frontend). Deve usar a instância Socket.IO já configurada em `server/src/index.ts` e `socketService.ts`.
- **Performance:** notificação deve ser entregue em menos de 2 segundos do evento em condições normais de rede.
- **Banco:** novo modelo `Notification` no schema Prisma com migration; campos mínimos: `id`, `tenantId`, `userId`, `type` (enum), `title`, `body`, `entityType`, `entityId`, `read` (boolean), `createdAt`.
- **Segurança:** todas as queries e eventos Socket.IO devem filtrar por `tenantId` + `userId`. Nenhuma rota de notificação pode retornar dados de outro tenant.
- **Sem Redis adicional:** a geração e entrega de notificações deve ocorrer de forma síncrona ou via chamada direta de serviço — não depender de BullMQ/Redis (que são opcionais no projeto).
- **Autenticação:** rotas de API de notificações seguem o padrão existente: `authMiddleware` + `tenantMiddleware`.

## Casos Extremos

- **Usuário offline no momento do evento:** a notificação é persistida no banco; na reconexão do Socket.IO, o backend emite as notificações não lidas acumuladas para o socket do usuário.
- **Falha no Socket.IO ao tentar entregar:** não relança exceção; o usuário verá a notificação ao abrir o sino manualmente (consultando a API REST).
- **Erro de banco na criação da notificação:** a falha é logada (logger existente), mas não propaga exceção para o fluxo principal que gerou o evento — a notificação pode ser perdida silenciosamente neste caso.
- **Clique em notificação com entidade deletada:** o frontend deve tratar 404 ao navegar e exibir mensagem de erro amigável, sem quebrar o app.
- **Badge com contagem alta (ex.: 99+ notificações):** exibir "99+" no badge para não distorcer o layout.
- **Múltiplas abas abertas:** marcar como lida em uma aba deve refletir nas outras via evento Socket.IO de atualização de badge.
- **Menção inválida (`@usuario` que não existe):** ignorar silenciosamente; não gerar notificação para usuário inexistente.

## Definição de Concluído

- [ ] Um vendedor recebe notificação em menos de 2 segundos quando um lead é atribuído a ele, sem recarregar a página.
- [ ] Um vendedor recebe notificação quando uma task sua vence ou está a menos de 24h do vencimento.
- [ ] Um vendedor recebe notificação quando seu deal é movido de etapa no funil.
- [ ] Um usuário recebe notificação quando é mencionado em um comentário.
- [ ] O ícone de sino no header exibe o número correto de notificações não lidas.
- [ ] Ao clicar em uma notificação de lead, o usuário é redirecionado para a página daquele lead.
- [ ] Ao clicar em uma notificação de deal, o usuário é redirecionado para a página daquele deal.
- [ ] Ao clicar em uma notificação de task, o usuário é redirecionado para a página daquela task.
- [ ] Marcar uma notificação individual como lida decrementa o badge imediatamente.
- [ ] "Marcar todas como lidas" zera o badge e marca todas como lidas no banco.
- [ ] Fechar o browser e reabrir mantém as notificações não lidas visíveis no sino.
- [ ] Usuário A nunca vê notificações do Usuário B, mesmo no mesmo tenant.
- [ ] Usuário de Tenant A nunca vê notificações do Tenant B.
- [ ] Notificações acumuladas durante desconexão são entregues ao reconectar.
- [ ] Badge exibe "99+" quando há 100 ou mais notificações não lidas.
