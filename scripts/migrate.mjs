// Migration runner for GachaDash Supabase schema
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vubovpxyuxnrjytmrshw.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'REMOVED_SECRET';

async function runSQL(name, sql) {
  console.log(`\n=== Running: ${name} ===`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  console.log(`Status: ${res.status} | Response: ${text.substring(0, 200)}`);
  return res.status;
}

async function runSQLDirect(name, sql) {
  console.log(`\n=== Running: ${name} ===`);
  // Use the Supabase Management API to execute SQL
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
  // Migration 001 — Extensions and ENUMs
  await runSQLDirect('001-extensions-enums', `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    DO $$ BEGIN
      CREATE TYPE public.game_slug AS ENUM (
        'honkai-star-rail',
        'wuthering-waves',
        'zenless-zone-zero',
        'arknights-endfield'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE public.checklist_category AS ENUM (
        'character',
        'weapon',
        'artifact',
        'story',
        'achievement',
        'other'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // Migration 002 — Table: games
  await runSQLDirect('002-table-games', `
    CREATE TABLE IF NOT EXISTS public.games (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      slug          public.game_slug UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      color_accent  TEXT NOT NULL,
      icon_url      TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
  `);

  // Migration 003 — Table: events
  await runSQLDirect('003-table-events', `
    CREATE TABLE IF NOT EXISTS public.events (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      game_id       UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      description   TEXT,
      start_date    TIMESTAMPTZ NOT NULL,
      end_date      TIMESTAMPTZ NOT NULL,
      rewards       JSONB,
      source_url    TEXT,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

    CREATE INDEX IF NOT EXISTS idx_events_game_active
      ON public.events(game_id, end_date)
      WHERE is_active = TRUE;
  `);

  // Migration 004 — Table: profiles
  await runSQLDirect('004-table-profiles', `
    CREATE TABLE IF NOT EXISTS public.profiles (
      id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      username      TEXT UNIQUE,
      avatar_url    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  `);

  // Migration 005 — Table: checklist_items
  await runSQLDirect('005-table-checklist-items', `
    CREATE TABLE IF NOT EXISTS public.checklist_items (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      game_id       UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      category      public.checklist_category NOT NULL DEFAULT 'other',
      description   TEXT,
      is_permanent  BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

    CREATE INDEX IF NOT EXISTS idx_checklist_items_game
      ON public.checklist_items(game_id, sort_order);
  `);

  // Migration 006 — Table: user_checklist_progress
  await runSQLDirect('006-table-user-progress', `
    CREATE TABLE IF NOT EXISTS public.user_checklist_progress (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      checklist_item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
      completed       BOOLEAN NOT NULL DEFAULT FALSE,
      completed_at    TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, checklist_item_id)
    );
    ALTER TABLE public.user_checklist_progress ENABLE ROW LEVEL SECURITY;

    CREATE INDEX IF NOT EXISTS idx_user_progress_user
      ON public.user_checklist_progress(user_id);
  `);

  console.log('\n=== ALL SCHEMA MIGRATIONS COMPLETE ===');
}

main().catch(console.error);
