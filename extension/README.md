# VYD Engage — Extensão Chrome (Copiloto no WhatsApp)

Extensão **standalone** (Manifest V3) que, ao abrir uma conversa no **WhatsApp Web**,
reconhece o número e mostra o **lead / empresa / negócios / últimas interações** do
VYD Engage, com **ações rápidas** (criar lead, criar tarefa, registrar nota).

Faz parte do épico *Upgrade RD parity* (req 24). Não depende do build do app principal —
tem o seu próprio empacotamento (esbuild).

---

## Como funciona

1. **Content script** (`src/content-script.ts`) roda em `web.whatsapp.com` e detecta o
   número da conversa aberta (heurísticas sobre o cabeçalho/JID, tolerantes a mudanças
   de layout).
2. **Service worker** (`src/service-worker.ts`) guarda a **API Key** do usuário
   (`chrome.storage.local`) e faz as chamadas autenticadas à API por `X-API-Key`.
3. **Popup** (`popup.html` + `src/popup.ts`) resolve o número na API e renderiza o
   contato + botões de ação.

Endpoints da API usados (todos por `X-API-Key`):

| Ação | Método | Rota | Escopo da chave |
|------|--------|------|-----------------|
| Resolver número | `GET` | `/api/v1/contacts/resolve?phone=` | `contacts:read` |
| Criar lead | `POST` | `/api/v1/contacts/leads` | `leads:write` |
| Criar tarefa | `POST` | `/api/v1/contacts/tasks` | `tasks:write` |
| Registrar nota | `POST` | `/api/v1/contacts/notes` | `leads:write` |

> As ações rápidas ficam no grupo `/contacts` (autenticado por `X-API-Key`); as rotas
> padrão `/leads`, `/tasks`, `/interactions` exigem sessão JWT e não aceitam API key.

> **Segurança:** a extensão nunca embute segredos. A API Key é criada pelo usuário nas
> configurações do VYD Engage e vive só no `chrome.storage.local` do navegador dele.
> Rate-limit da chave (1000/min) vale normalmente.

---

## Build

Pré-requisito: Node 18+. O `esbuild` é resolvido do repositório; para rodar isolado:

```bash
cd extension
npm install          # instala esbuild + @types/chrome + typescript (dev)
npm run build        # gera extension/dist/ (extensão descompactada)
npm run watch        # rebuild ao salvar (sourcemap inline)
npm run package      # build + vyd-engage-extension.zip (p/ a Web Store)
npm run typecheck    # tsc --noEmit (checagem de tipos, sem emitir)
```

O resultado fica em **`extension/dist/`** com: `manifest.json`, `popup.html`,
`content-script.js`, `service-worker.js`, `popup.js` e `icons/`.

---

## Instalar no Chrome (modo desenvolvedor)

1. `npm run build` dentro de `extension/`.
2. Abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor** (canto superior direito).
4. **Carregar sem compactação** → selecione a pasta `extension/dist/`.
5. Fixe a extensão na barra. Abra o `web.whatsapp.com`, entre numa conversa e clique no
   ícone da extensão.
6. No popup, informe a **URL da API** (ex.: `https://api.vydengage.com`) e cole a
   **API Key** com o escopo `contacts:read` (e `leads:write` / `tasks:write` para as
   ações rápidas). Salve.

---

## Publicar na Chrome Web Store

1. `npm run package` gera `vyd-engage-extension.zip`.
2. Suba o `.zip` no [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. Ajuste `host_permissions` no `manifest.json` se o domínio de produção da API for
   diferente de `api.vydengage.com`.

---

## Dependências do backend

Todas já implementadas (`server/src/routes/contacts.ts`), autenticadas por `X-API-Key`:

- `GET /api/v1/contacts/resolve` — resolve o número (escopo `contacts:read`).
- **Ações rápidas** — vivem no próprio grupo `/contacts`, cada uma com `apiKeyAuth` +
  escopo próprio (não dependem das rotas JWT `/leads`, `/tasks`, `/interactions`):
  - `POST /api/v1/contacts/leads` — cria lead (escopo `leads:write`).
  - `POST /api/v1/contacts/tasks` — cria tarefa (escopo `tasks:write`).
  - `POST /api/v1/contacts/notes` — registra nota/interação (escopo `leads:write`).
- **Por que a chamada à API funciona:** o `fetch` roda no **service worker** da
  extensão, que declara `host_permissions` para o host da API no `manifest.json`.
  Quando o pedido parte do contexto da extensão para um host com `host_permission`
  concedida, o **Chrome ignora (bypassa) o CORS** — a origin `chrome-extension://`
  não precisa constar em `CORS_ORIGINS` (e, em produção, nunca consta). O
  `allowedHeaders` do backend só define **quais headers o preflight aceita**; ele
  **não** autoriza a origin da extensão.
  > ⚠️ **Atenção:** manter o `fetch` no service worker é intencional. Movê-lo para o
  > content script ou para o popup faria o pedido partir de um contexto sujeito a
  > CORS, **reintroduzindo a barreira** — o navegador voltaria a exigir que a origin
  > estivesse liberada em `CORS_ORIGINS`.

---

## Ícones

Os PNGs em `icons/` são placeholders sólidos (cor de acento VYD). Substitua pelos
ícones definitivos antes da publicação.
