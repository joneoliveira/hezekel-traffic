# Hezekel Traffic — Contexto do Projeto

## Stack
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui, Recharts
- **Backend**: Supabase (PostgreSQL + Edge Functions em Deno)
- **Deploy frontend**: Vercel → `npx vercel --prod`
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

## Banco de dados (tabelas principais)
| Tabela | Descrição |
|---|---|
| `clients` | Organizações/clientes |
| `client_users` | Vínculo usuário↔cliente |
| `meta_accounts` | Contas Meta Ads (token + ad_account_id) |
| `meta_ad_insights` | Dados de performance diários |
| `meta_ad_creatives` | Criativos dos anúncios |
| `creative_scores` | Score dos criativos |
| `user_roles` | Roles dos usuários |
| `report_templates` | Templates de relatórios salvos |
| `app_settings` | Configurações globais (token Meta, account ID) |

## Roles de usuário
- `super_admin` — acesso total, painel Admin
- `gestor` — gerencia clientes
- `gestor_trafego` — gestor de tráfego
- `marketing` — time de marketing

## Edge Functions
| Função | Descrição |
|---|---|
| `meta-sync-creative-intelligence` | Sincroniza dados Meta → Supabase |
| `report-feed` | Gera relatórios (chama sync inline antes de consultar) |
| `admin-create-user` | Cria usuário + role + vincula ao cliente |
| `admin-delete-user` | Remove usuário |
| `meta-test-connection` | Testa conexão com a API Meta |

## Autenticação nas Edge Functions
As funções que requerem auth decodificam o JWT manualmente com `atob()` (mais confiável que `supabase.auth.getUser()` em Deno):
```ts
const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
const payload = JSON.parse(atob(base64));
const callerId = payload.sub;
```

## Decisões importantes tomadas
- **account_id sempre com prefixo `act_`**: a tabela `meta_ad_insights` guarda o campo `account_id` como `act_XXXXXXXXX`. O sync normaliza sempre para ter o prefixo.
- **report-feed faz sync inline**: garante dados frescos para qualquer `date_preset`, incluindo `today`.
- **admin-create-user usa atob()**: `auth.getUser()` era instável no contexto Deno da função; JWT decode manual resolveu.
- **client_users insert com verificação de erro**: o insert que vincula usuário ao cliente agora lança erro explícito se falhar.

## Versionamento
- Exibido no rodapé do sidebar: `vMAJOR.MINOR.PATCH` (ex: `v1.4.37`)
  - `MAJOR.MINOR` vem de `package.json` — editar manualmente
  - `PATCH` é o número de commits git — incrementa automaticamente a cada deploy
- Regras de bump no `package.json`:
  - **Bug fix / ajuste pequeno**: não mexe — o PATCH já sobe sozinho
  - **Nova funcionalidade**: bump do MINOR (`1.4` → `1.5`)
  - **Reescrita grande / breaking change**: bump do MAJOR (`1.x` → `2.0`)

## Estrutura de arquivos chave
```
src/
  components/
    Layout.tsx          — sidebar, header, navegação
  contexts/
    AuthContext.tsx     — autenticação, roles
    ClientContext.tsx   — cliente ativo (localStorage)
    AccountContext.tsx  — conta Meta ativa
  hooks/
    useDashboard.ts     — dados do dashboard
    useReports.ts       — templates + geração de relatórios
  pages/
    AdminPage.tsx       — gestão de clientes/usuários/contas
    DashboardPage.tsx   — dashboard de performance
    ReportsPage.tsx     — templates e geração de relatórios
    CreativeIntelligencePage.tsx
supabase/
  functions/
    admin-create-user/
    admin-delete-user/
    meta-sync-creative-intelligence/
    report-feed/
    meta-test-connection/
  migrations/           — SQL aplicado em ordem (001→016)
```

## Comandos frequentes
```bash
# Deploy frontend
npx vercel --prod

# Deploy edge function específica
npx supabase functions deploy <nome> --use-api

# Deploy todas as funções
npx supabase functions deploy --use-api
```
