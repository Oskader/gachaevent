// Create the scraper-fallbacks storage bucket in Supabase
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
}

async function main() {
  await runSQL('create-bucket', `
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('scraper-fallbacks', 'scraper-fallbacks', false)
    ON CONFLICT (id) DO NOTHING;
  `);

  await runSQL('bucket-upload-policy', `
    CREATE POLICY "service_role_upload"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'scraper-fallbacks');
  `);

  // Also add unique constraint on events for upsert to work
  await runSQL('events-unique-constraint', `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_events_game_title
    ON public.events(game_id, title);
  `);

  console.log('\n=== BUCKET SETUP COMPLETE ===');
}

main().catch(console.error);
