# Prysm

Central privada de monitoramento e controle dos sistemas do proprietário.

## Stack inicial

- React + TypeScript + Vite
- Vercel Functions (API)
- Neon PostgreSQL
- Telemetria autenticada por token de ingestão

## Desenvolvimento

```bash
npm install
npm run dev
```

A interface inicial está disponível em `http://localhost:5173`.

## Variáveis de ambiente

Copie `.env.example` para `.env.local`:

- `DATABASE_URL`: conexão pooled do Neon para consultas da aplicação.
- `PRYSM_INGEST_TOKEN`: segredo compartilhado pelos agentes de telemetria.
- `CRON_SECRET`: reservado para execução autenticada de verificações agendadas.

Não versione credenciais. Gere tokens longos e aleatórios e mantenha-os apenas nas variáveis de ambiente.

## Banco de dados

Aplique `db/migrations/0001_initial.sql` no banco Neon antes de habilitar a ingestão. A migration cria os sistemas iniciais e a tabela de eventos.

## API inicial

### GET /api/health

Verificação simples da API. Não depende do banco.

### POST /api/ingest

Recebe um evento de telemetria autenticado:

```http
Authorization: Bearer <PRYSM_INGEST_TOKEN>
Content-Type: application/json
```

```json
{
  "systemKey": "menuza",
  "eventType": "http.check",
  "status": "ok",
  "message": "Endpoint respondeu",
  "durationMs": 143,
  "metadata": { "httpStatus": 200 }
}
```

A chave do sistema precisa existir em `monitored_systems`. A API valida os campos e usa parâmetros SQL vinculados.

## Próximas etapas

1. Configurar o projeto Neon e aplicar a migration.
2. Criar cadastro e autenticação administrativa.
3. Implementar verificação periódica externa dos endpoints.
4. Exibir métricas reais e histórico na interface.
5. Adicionar incidentes, alertas e integrações de erros.

## Arquitetura de monitoramento

A API da Vercel é stateless e não deve ser tratada como um processo worker permanente. As verificações recorrentes devem ser disparadas por um scheduler externo ou serviço de execução contínua. O painel e a API podem continuar na Vercel.
