// RLS Policies + Trigger + Seed for GachaDash
async function runSQL(name, sql) {
  console.log(`\n=== Running: ${name} ===`);
  const res = await fetch('https://api.supabase.com/v1/projects/vubovpxyuxnrjytmrshw/database/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || 'REMOVED_TOKEN'}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (res.status === 201 || res.status === 200) {
    console.log(`✅ ${name} succeeded`);
  } else {
    console.log(`❌ Status: ${res.status} | ${text.substring(0, 300)}`);
  }
  return res.status;
}

async function main() {
  // === FASE 2: RLS POLICIES ===

  await runSQL('rls-games', `
    CREATE POLICY "games_public_read"
      ON public.games FOR SELECT
      USING (TRUE);
  `);

  await runSQL('rls-events', `
    CREATE POLICY "events_public_read"
      ON public.events FOR SELECT
      USING (is_active = TRUE);
  `);

  await runSQL('rls-checklist-items', `
    CREATE POLICY "checklist_items_public_read"
      ON public.checklist_items FOR SELECT
      USING (TRUE);
  `);

  await runSQL('rls-profiles-read', `
    CREATE POLICY "profiles_owner_read"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);
  `);

  await runSQL('rls-profiles-update', `
    CREATE POLICY "profiles_owner_update"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  `);

  await runSQL('rls-progress-read', `
    CREATE POLICY "progress_owner_read"
      ON public.user_checklist_progress FOR SELECT
      USING (auth.uid() = user_id);
  `);

  await runSQL('rls-progress-insert', `
    CREATE POLICY "progress_owner_insert"
      ON public.user_checklist_progress FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  `);

  await runSQL('rls-progress-update', `
    CREATE POLICY "progress_owner_update"
      ON public.user_checklist_progress FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  `);

  await runSQL('rls-progress-delete', `
    CREATE POLICY "progress_owner_delete"
      ON public.user_checklist_progress FOR DELETE
      USING (auth.uid() = user_id);
  `);

  // === FASE 3: TRIGGER + SEED ===

  await runSQL('trigger-new-user', `
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      INSERT INTO public.profiles (id, username, avatar_url)
      VALUES (
        NEW.id,
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'avatar_url'
      );
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  `);

  await runSQL('seed-games', `
    INSERT INTO public.games (slug, name, color_accent, icon_url) VALUES
      ('honkai-star-rail',    'Honkai: Star Rail',    '#F59E0B', NULL),
      ('wuthering-waves',     'Wuthering Waves',      '#06B6D4', NULL),
      ('zenless-zone-zero',   'Zenless Zone Zero',    '#22C55E', NULL),
      ('arknights-endfield',  'Arknights: Endfield',  '#EF4444', NULL)
    ON CONFLICT (slug) DO NOTHING;
  `);

  // === VERIFICACIÓN ===
  await runSQL('verify-games', `SELECT slug, name, color_accent FROM public.games;`);
  await runSQL('verify-trigger', `
    SELECT tgname, tgrelid::regclass, tgtype
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created';
  `);

  console.log('\n=== ALL RLS + TRIGGER + SEED COMPLETE ===');
}

main().catch(console.error);
