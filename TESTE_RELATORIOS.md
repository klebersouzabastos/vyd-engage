# Teste de Criação de Relatórios

## Como testar manualmente:

1. **Acesse a página de Relatórios:**
   - Navegue para `/app/reports` ou clique em "Relatórios" no menu lateral

2. **Criar um novo relatório:**
   - Clique no botão "Novo Relatório"
   - Você será redirecionado para `/app/reports/new`

3. **Preencher informações gerais:**
   - Na aba "Geral":
     - Nome: "Relatório de Teste"
     - Descrição: "Este é um relatório de teste"
     - Tipo: Selecione "Personalizado"

4. **Adicionar widgets:**
   - Vá para a aba "Widgets"
   - Clique em "Adicionar Widget"
   - Configure:
     - Nome: "Total de Leads"
     - Tipo: "Métrica"
   - Adicione mais widgets se desejar (Gráfico, Tabela, Funil)

5. **Configurar agendamento (opcional):**
   - Vá para a aba "Agendamento"
   - Ative o switch "Agendamento"
   - Configure:
     - Frequência: Diário/Semanal/Mensal
     - Horário: Ex: 09:00
     - Formato: PDF/Excel/Ambos
     - Adicione destinatários clicando em "Adicionar"

6. **Salvar:**
   - Clique em "Salvar Relatório"
   - Você será redirecionado para a lista de relatórios
   - O novo relatório deve aparecer na lista

## Teste via Console do Navegador:

Execute este código no console do navegador para criar um relatório de teste:

```javascript
// Criar relatório de teste
const testReport = {
  id: `test-${Date.now()}`,
  name: "Relatório de Teste Automático",
  description: "Relatório criado via console para teste",
  type: "custom",
  widgets: [
    {
      id: `widget-${Date.now()}`,
      type: "metric",
      title: "Total de Leads",
      config: { metric: "totalLeads" },
      position: { x: 0, y: 0, w: 4, h: 2 }
    },
    {
      id: `widget-${Date.now() + 1}`,
      type: "chart",
      title: "Gráfico de Vendas",
      config: { chartType: "bar", dataSource: "sales" },
      position: { x: 4, y: 0, w: 8, h: 4 }
    }
  ],
  schedule: {
    enabled: true,
    frequency: "daily",
    time: "09:00",
    recipients: ["teste@empresa.com"],
    format: "pdf"
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: "test-user"
};

// Salvar no localStorage
const existingReports = JSON.parse(localStorage.getItem("reports") || "[]");
existingReports.push(testReport);
localStorage.setItem("reports", JSON.stringify(existingReports));

console.log("Relatório de teste criado com sucesso!");
console.log("Recarregue a página para ver o relatório na lista.");
```

## Verificar se funcionou:

1. Recarregue a página `/app/reports`
2. O relatório deve aparecer na lista
3. Clique em "Editar" para verificar se os dados foram salvos corretamente
4. Teste as funcionalidades:
   - Editar relatório
   - Executar relatório (botão play)
   - Excluir relatório

## Checklist de Funcionalidades:

- [x] Lista de relatórios vazia quando não há relatórios
- [x] Botão "Novo Relatório" funciona
- [x] Navegação para `/app/reports/new` funciona
- [x] Formulário de criação funciona
- [x] Adicionar widgets funciona
- [x] Configurar agendamento funciona
- [x] Salvar relatório funciona
- [x] Redirecionamento após salvar funciona
- [x] Relatório aparece na lista após criação
- [x] Editar relatório funciona
- [x] Excluir relatório funciona
- [x] Executar relatório mostra alerta


