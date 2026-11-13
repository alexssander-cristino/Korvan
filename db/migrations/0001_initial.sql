CREATE TABLE IF NOT EXISTS monitored_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_key VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500),
  base_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telemetry_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  system_key VARCHAR(64) NOT NULL REFERENCES monitored_systems(system_key) ON DELETE CASCADE,
  event_type VARCHAR(80) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'warning', 'error')),
  message VARCHAR(2000),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telemetry_events_system_created_idx
  ON telemetry_events (system_key, created_at DESC);
CREATE INDEX IF NOT EXISTS telemetry_events_status_created_idx
  ON telemetry_events (status, created_at DESC);

INSERT INTO monitored_systems (system_key, name, description, base_url)
VALUES
  ('menuza', 'Menuza', 'Plataforma de pedidos e cardápios', 'https://menuza-five.vercel.app'),
  ('madevix', 'Madevix', 'Sistema de gestão empresarial', NULL),
  ('orvix', 'Orvix', 'Sistema de agendamentos', NULL)
ON CONFLICT (system_key) DO NOTHING;