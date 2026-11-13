# Prysm — System Control

Central privada para monitorar disponibilidade, latência, falhas e eventos dos seus sistemas.

## Stack
- React 19 + TypeScript + Vite
- Vercel Functions
- Neon PostgreSQL
- Sessão administrativa assinada em cookie HttpOnly
- Verificação HTTP sob demanda e ingestão autenticada de telemetria

## Desenvolvimento local

1. Instale dependências: `npm install`
2. Instale/tenha o Vercel CLI disponível: `npm install -g vercel`
3. Copie `.env.example` para `.env.local` e preencha as variáveis.
4. Execute `npm run dev` (usa `vercel dev`, pois o Vite sozinho não executa as funções de API).

Para abrir somente a interface sem API, use `npm run dev:vite`.

## Variáveis de ambiente

- `DATABASE_URL`: conexão pooled do Neon para consultas HTTP/serverless.
- `PRYSM_ADMIN_PASSWORD`: senha de acesso ao painel.
- `PRYSM_SESSION_SECRET`: segredo aleatório longo para assinar sessões.
- `PRYSM_INGEST_TOKEN`: token compartilhado com agentes externos de telemetria.
- `PRYSM_CRON_SECRET`: token para autorizar verificações agendadas.

Gere segredos fortes. Exemplo no PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Não use o mesmo valor para senha e segredos. Não versione `.env.local`.

## Banco de dados

No Neon, execute `db/migrations/0001_initial.sql` usando a conexão direta (sem `-pooler`) em um ambiente de migração. A aplicação usa a conexão pooled em `DATABASE_URL`.

A migration cria:
- `monitored_systems`: sistemas monitorados e endpoints.
- `telemetry_events`: checks, latência, status e metadados.
- Índices para consultas por sistema, status e data.
- Registros iniciais de Menuza, Madevix e Orvix (sem URL para os que ainda não foram configurados).

## Funcionalidades implementadas

- Login administrativo com cookie HttpOnly, SameSite=Lax e sessão HMAC com expiração de 12 horas.
- Visão geral ligada ao banco: sistemas, disponibilidade 24h, falhas, latência média e P95.
- Cadastro, edição, ativação/desativação e exclusão de sistemas.
- Verificação HTTP manual de todos os sistemas ativos com URL configurada.
- Histórico de eventos, filtros por status e lista de incidentes (eventos warning/error).
- Desempenho por sistema e estado das integrações.
- API de ingestão para agentes externos.

## Endpoints

- `GET /api/health`: saúde da API.
- `GET /api/auth`: estado da sessão.
- `POST /api/auth`: login com JSON `{ "password": "..." }`.
- `DELETE /api/auth`: encerra a sessão.
- `GET /api/overview`: resumo e métricas (admin).
- `GET /api/systems` e `POST /api/systems`: listar/criar sistemas (admin).
- `PATCH /api/system?id=<uuid>` e `DELETE /api/system?id=<uuid>`: editar/excluir (admin).
- `GET /api/events?limit=50&status=error`: histórico (admin).
- `POST /api/check`: executa checks HTTP (admin).
- `POST /api/ingest`: recebe telemetria com `Authorization: Bearer <PRYSM_INGEST_TOKEN>`.

Exemplo de ingestão:

```http
POST /api/ingest
Authorization: Bearer <PRYSM_INGEST_TOKEN>
Content-Type: application/json
```

```json
{
  "systemKey": "menuza",
  "eventType": "application.error",
  "status": "error",
  "message": "Falha ao processar pedido",
  "metadata": { "source": "api" }
}
```

## Monitoramento automático

O botão **Verificar agora** executa uma rodada imediata. Para recorrência, configure um scheduler externo para chamar `POST /api/check` com `Authorization: Bearer <PRYSM_CRON_SECRET>`. Ajuste a frequência conforme o plano/limites do provedor. A Vercel Functions é stateless; não mantenha um loop infinito dentro de uma função.

## Limites atuais

- Alertas por e-mail/WhatsApp/Discord ainda não estão conectados.
- Não há worker 3D ou agente de sistema operacional integrado; a aba Workers mostra o estado do coletor HTTP e o que falta integrar.
- A disponibilidade é calculada com base nos checks registrados; não é retroativa.
- A verificação HTTP mede a URL configurada e não substitui testes funcionais autenticados dentro de cada aplicação.
