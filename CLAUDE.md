# Hezekel Traffic — Contexto do Projeto

## Stack
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui, Recharts, react-router-dom v7
- **Backend**: Supabase (PostgreSQL + Edge Functions em Deno)
- **Deploy frontend**: `npx vercel --prod`
- **Deploy edge functions**: `npx supabase functions deploy <nome> --use-api` (sem Docker)

## URLs
- Produção: `https://hezekel-traffic.vercel.app`
- Supabase projeto ref: `ivsqyykwvqbefzlooueb`
- Dashboard Supabase: `https://supabase.com/dashboard/project/ivsqyykwvqbefzlooueb`

## Variáveis de ambiente (`.env`)
```
VITE_SUPABASE_URL=https://ivsqyykwvqbefzlooueb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
Edge functions usam `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` injetados automaticamente pelo Supabase.

## Roteamento URL (react-router-dom v7)

O app usa `BrowserRouter` com rotas declaradas em `src/App.tsx`. O `vercel.json` na raiz garante que o Vercel sirva corretamente a landing e o SPA.

### `vercel.json`
```json
{
  "routes": [
    { "src": "/", "dest": "/landing.html" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### Tabela de rotas do SPA
| URL | Componente | Acesso |
|---|---|---|
| `/` | `landing.html` (estático) | público |
| `/login` | `LoginPage` | público |
| `/dashboard` | `DashboardPage` | todos exceto marketing |
| `/campanhas` | `CampanhasPage` | todos exceto marketing |
| `/campanhas/criar` | `CreateCampaignPage` | todos exceto marketing |
| `/creative` | `CreativeIntelligencePage` | todos |
| `/content-intel` | `ContentIntelligencePage` | todos |
| `/organic-intel` | `OrganicIntelligencePage` | todos |
| `/content` | `ContentPerformancePage` | todos |
| `/reports` | `ReportsPage` | todos |
| `/configuracoes` | `SettingsPage` | super_admin, gestor |
| `/admin` | `AdminPage` | super_admin apenas |

Mapeamentos em `src/components/Layout.tsx` → `PAGE_TO_PATH` e `PATH_TO_PAGE`.

Fallback por role:
- `marketing` → `/content-intel`
- todos os outros → `/dashboard`

## Banco de dados (tabelas principais)
| Tabela | Descrição |
|---|---|
| `clients` | Organizações/clientes |
| `client_users` | Vínculo usuário↔cliente |
| `meta_accounts` | Contas Meta Ads (token + ad_account_id) |
| `meta_ad_insights` | Dados de performance diários (paid) |
| `meta_ad_creatives` | Criativos dos anúncios |
| `creative_scores` | Score dos criativos |
| `user_roles` | Roles dos usuários (inclui campo `email`) |
| `report_templates` | Templates de relatórios salvos |
| `app_settings` | Configurações globais |
| `ig_accounts` | Contas Instagram para orgânico (ig_account_id + token) |
| `ig_organic_posts` | Posts orgânicos do Instagram |

Storage bucket: `avatars` (fotos de perfil dos usuários)

## Roles de usuário e permissões
- `super_admin` — acesso total, incluindo painel Admin
- `gestor` — acesso a todas as páginas
- `gestor_trafego` — todas as páginas exceto Configurações
- `marketing` — apenas: Creative Intelligence, Content Intelligence (Paid), Content Intel. Organic, Métricas Conteúdo, Reports
- `social_media` — apenas: Content Intelligence (Paid), Content Intel. Organic

Lógica em `src/contexts/AuthContext.tsx` → função `canAccess()`.

## Páginas (`src/pages/`)
| Page ID | Componente | URL |
|---|---|---|
| `dashboard` | DashboardPage | `/dashboard` |
| `campaigns` | CampanhasPage | `/campanhas` |
| `create_campaign` | CreateCampaignPage | `/campanhas/criar` |
| `creative` | CreativeIntelligencePage | `/creative` |
| `content_intelligence` | ContentIntelligencePage | `/content-intel` |
| `organic_intelligence` | OrganicIntelligencePage | `/organic-intel` |
| `content` | ContentPerformancePage | `/content` |
| `reports` | ReportsPage | `/reports` |
| `settings` | SettingsPage | `/configuracoes` |
| `admin` | AdminPage | `/admin` |

Navegação definida em `src/components/Layout.tsx` → `NAV_ITEMS`.

## Edge Functions
| Função | Descrição |
|---|---|
| `dashboard-feed` | Dados do dashboard de performance (paid). Retorna vazio sem `account_id`. |
| `report-feed` | Gera relatórios (faz sync inline antes de consultar) |
| `meta-auto-sync` | Sync automático via pg_cron — sincroniza `today` + `last_30d` para cada conta ativa |
| `meta-sync-creative-intelligence` | Sync de dados Meta → Supabase (criativos + insights) |
| `creative-intelligence-feed` | Feed de dados para Creative Intelligence. Retorna vazio sem `account_id`. |
| `creative-score-history` | Histórico de scores de criativos |
| `creative-generate-variation` | Gera variação de criativo (IA) |
| `creative-launch-variation` | Publica variação de criativo no Meta |
| `content-performance-feed` | Feed de métricas de conteúdo paid. Retorna vazio sem `account_id`. `campaign_contains` é opcional e vazio por padrão. |
| `ig-sync-organic` | Sync de posts orgânicos do Instagram |
| `db-setup-ig-organic` | Setup/migração das tabelas de orgânico |
| `meta-test-connection` | Testa conexão com a API Meta |
| `meta-duplicate-ad` | Duplica um anúncio existente no Meta |
| `meta-fetch-ad-template` | Busca template de anúncio para criação de campanha |
| `meta-create-campaign` | Cria campanha no Meta via API |
| `admin-create-user` | Cria usuário + role + vincula ao cliente |
| `admin-delete-user` | Remove usuário |
| `admin-list-users` | Lista todos os usuários (RPC get_all_users) |

### Regra de isolamento de dados nas Edge Functions
Todas as funções usam `service_role` key que bypassa RLS. Por isso, **todo query deve incluir `.eq('account_id', account_id)`**. Se `account_id` vier vazio, a função deve retornar imediatamente com dados vazios (early return) — nunca retornar dados de todas as contas.

## Filtro de campanha (localStorage)
`ContentIntelligencePage` e `ContentPerformancePage` permitem ao usuário configurar um filtro de campanha persistido:
- Chave localStorage: `content_intel_campaign_filter` / `content_perf_campaign_filter`
- Hooks: `useContentIntelligence.ts` e `useContentPerformance.ts` lêem e salvam via `saveCampaignFilter(val)`
- UI: input com botão de salvar + ícone de cadeado + botão de limpar
- Filtro passado como `campaign_contains` para a edge function correspondente

## Autenticação nas Edge Functions
As funções que requerem auth decodificam o JWT manualmente com `atob()`:
```ts
const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
const payload = JSON.parse(atob(base64));
const callerId = payload.sub;
```
Motivo: `supabase.auth.getUser()` era instável no contexto Deno.

## Decisões importantes
- **account_id sempre com prefixo `act_`**: `meta_ad_insights` guarda `account_id` como `act_XXXXXXXXX`. O sync normaliza sempre.
- **report-feed faz sync inline**: garante dados frescos para qualquer `date_preset`, incluindo `today`.
- **admin-create-user usa atob()**: JWT decode manual por instabilidade do auth.getUser() em Deno.
- **client_users insert com verificação de erro**: lança erro explícito se o vínculo falhar.
- **meta-auto-sync via pg_cron**: migração 016 configura sync automático agendado. Sincroniza `today` + `last_30d` para garantir dados do dia atual e histórico recente.
- **Vercel sem git history**: vite.config.ts deriva pseudo-patch do `VERCEL_GIT_COMMIT_SHA` quando `git rev-list` retorna 0.
- **ESLint ignora `supabase/`**: `eslint.config.js` tem `supabase/` em `globalIgnores` para evitar erros ao analisar arquivos Deno com regras de browser/Node.
- **Landing page**: `public/landing.html` é a home pública servida em `/`. O SPA React começa em `/login` e em diante.

## Versionamento (`package.json` → `version`)
Exibido no rodapé do sidebar: `vMAJOR.MINOR.PATCH` — ex: `v1.7.2061`
- `MAJOR.MINOR` vem de `package.json` — editar manualmente antes de deploy de nova feature
- `PATCH` = total de commits do repo (`git rev-list --count HEAD`) — não é sequencial da versão, é cumulativo desde o início do repo
- **Versão atual: `1.7`**

Regras de bump:
- **Bug fix / ajuste pequeno**: não mexe — PATCH já sobe sozinho
- **Nova funcionalidade**: bump do MINOR (`1.7` → `1.8`)
- **Reescrita grande / breaking change**: bump do MAJOR (`1.x` → `2.0`)

## Migrations (001 → 022)
| # | Descrição |
|---|---|
| 001 | Init — tabelas base |
| 002 | IG Organic — estrutura inicial |
| 003 | Missing tables |
| 004 | Clients |
| 005 | Super admin |
| 006 | RLS app_settings |
| 007 | Adiciona account_id |
| 008 | Missing columns |
| 009 | Colunas de vídeo |
| 010 | ad_status |
| 011 | RLS data tables |
| 012 | RPC get_all_users |
| 013 | Grant RPC |
| 014 | destination_url |
| 015 | report_templates |
| 016 | pg_cron auto sync |
| 017 | Fix get_all_users RPC |
| 018 | user_roles add email |
| 019 | Avatars storage bucket |
| 020 | ig_accounts table |
| 021 | RLS ig_organic by client |
| 022 | Fix health account_id |
| 023 | social_media role + user_roles RLS restrita |

## Estrutura de arquivos chave
```
src/
  components/
    Layout.tsx              — sidebar, header, client switcher, account switcher, profile modal
                              exporta PAGE_TO_PATH, PATH_TO_PAGE (mapeamento Page ↔ URL)
    UserManagement.tsx      — gestão de usuários (usado no AdminPage)
    creative/
      CreativePreview.tsx
      CreativeScoreChart.tsx
      CreativeAnalyzePanel.tsx
      DuplicateAdModal.tsx  — modal para duplicar anúncio
  contexts/
    AuthContext.tsx         — autenticação, roles, canAccess()
    ClientContext.tsx       — cliente ativo (localStorage)
    AccountContext.tsx      — conta Meta ativa
  hooks/
    useDashboard.ts
    useReports.ts
    useCreativeIntelligence.ts
    useContentPerformance.ts    — campaignFilter + saveCampaignFilter (localStorage)
    useContentIntelligence.ts   — campaignFilter + saveCampaignFilter (localStorage)
    useOrganicIntelligence.ts
    useAccounts.ts
  pages/
    AdminPage.tsx           — gestão de clientes/usuários/contas Meta + IG
    DashboardPage.tsx
    CampanhasPage.tsx       — lista de anúncios com filtros e duplicação
    CreateCampaignPage.tsx  — criação de campanha no Meta
    CreativeIntelligencePage.tsx
    ContentPerformancePage.tsx  — inclui UI de filtro de campanha configurável
    ContentIntelligencePage.tsx — inclui UI de filtro de campanha configurável
    OrganicIntelligencePage.tsx — Content Intel. Organic (Instagram)
    ReportsPage.tsx
    SettingsPage.tsx
    LoginPage.tsx
  App.tsx                   — BrowserRouter + AppRoutes + ClientRoutes (react-router v7)
  integrations/supabase/
    client.ts               — instância do supabase-js
public/
  landing.html              — home pública (servida em `/` pelo Vercel)
supabase/
  functions/                — edge functions Deno
  migrations/               — SQL aplicado em ordem (001→022)
vercel.json                 — roteamento: `/` → landing.html, `/*` → index.html (SPA)
eslint.config.js            — globalIgnores inclui `supabase/` (arquivos Deno)
vite.config.ts              — injeta __APP_VERSION__ e __BUILD_STAMP__
```

## Comandos frequentes
```bash
# Dev local
npm run dev

# Build
npm run build

# Deploy frontend
npx vercel --prod

# Deploy edge function específica
npx supabase functions deploy <nome> --use-api

# Deploy todas as funções
npx supabase functions deploy --use-api

# Script de deploy com log (evita problemas de git lock)
# Criar em /tmp/deploy.sh e executar com zsh /tmp/deploy.sh
# Output vai para /tmp/deploy.log
```
