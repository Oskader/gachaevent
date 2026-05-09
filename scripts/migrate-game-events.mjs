// Migration runner for game_events table
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vubovpxyuxnrjytmrshw.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'REMOVED_SECRET';

async function runSQLDirect(name, sql) {
  console.log(`\n=== Running: ${name} ===`);
  const res = await fetch(`https://api.supabase.com/v1/projects/vubovpxyuxnrjytmrshw/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || 'REMOVED_TOKEN'}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  console.log(`Status: ${res.status}`);
  if (res.status === 201 || res.status === 200) {
    console.log(`✅ ${name} succeeded`);
  } else {
    console.log(`Response: ${text.substring(0, 300)}`);
  }
  return res.status;
}

async function main() {
  await runSQLDirect('create-game-events-table', `
    CREATE TABLE IF NOT EXISTS public.game_events (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      game_id       UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      type          TEXT NOT NULL CHECK (type IN ('event', 'banner', 'endgame')),
      start_date    TIMESTAMPTZ,
      end_date      TIMESTAMPTZ,
      details       JSONB,
      source_url    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(game_id, name, type)
    );
    ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "game_events_public_read"
      ON public.game_events FOR SELECT
      USING (TRUE);
  `);

  console.log('\n=== GAME EVENTS MIGRATION COMPLETE ===');
}

main().catch(console.error);
