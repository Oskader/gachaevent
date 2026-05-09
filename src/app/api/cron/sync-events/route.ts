import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GAME_SOURCES = [
  {
    game_slug: 'honkai-star-rail',
    url: 'https://honkai-star-rail.fandom.com/api.php?action=parse&page=Events&format=json',
    isMediaWiki: true
  },
  {
    game_slug: 'zenless-zone-zero',
    url: 'https://zenless-zone-zero.fandom.com/api.php?action=parse&page=Events&format=json',
    isMediaWiki: true
  },
  {
    game_slug: 'wuthering-waves',
    url: 'https://wutheringwaves.gg/events/',
    isMediaWiki: false
  },
  {
    game_slug: 'arknights-endfield',
    url: 'https://arknights.wiki.gg/api.php?action=parse&page=Event&format=json',
    isMediaWiki: true
  }
];

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = [];

    for (const source of GAME_SOURCES) {
      let rawText = '';
      
      try {
        if (source.isMediaWiki) {
          const res = await fetch(source.url, {
            headers: { 'User-Agent': 'GachaDashBot/1.0' }
          });
          const json = await res.json();
          const html = json?.parse?.text?.['*'] || '';
          const $ = cheerio.load(html);
          
          $('script, style, table.navbox, .mw-editsection, .toc').remove();
          rawText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 10000);
        } else {
          const res = await fetch(source.url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          const html = await res.text();
          const $ = cheerio.load(html);
          $('script, style, nav, footer, header').remove();
          rawText = $('main, body').text().replace(/\s+/g, ' ').trim().substring(0, 10000);
        }

        if (!rawText) continue;

        // Groq Extractor
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are an expert Data Extraction AI. Extract the CURRENTLY ACTIVE AND UPCOMING events, banners, and endgame modes from the text.
              Return STRICTLY a JSON object with this structure:
              {
                "events": [
                  {
                    "title": "Event Name",
                    "type": "event" | "banner" | "endgame",
                    "start_date": "ISO8601 string or null",
                    "end_date": "ISO8601 string or null",
                    "details": { "featured_characters": [], "rewards": [] }
                  }
                ]
              }
              Do not include any Markdown wrappers like \`\`\`json.`
            },
            {
              role: 'user',
              content: `Game: ${source.game_slug}\n\nData:\n${rawText}`
            }
          ],
          model: 'llama-3.1-8b-instant',
          temperature: 0,
          response_format: { type: "json_object" }
        });

        const content = completion.choices[0]?.message?.content;
        const extractedJson = content ? JSON.parse(content) : { events: [] };

        // Supabase Upsert Logic
        const { data: gameData } = await supabaseAdmin
          .from('games')
          .select('id')
          .eq('slug', source.game_slug)
          .single();

        if (!gameData) {
          results.push({ game_slug: source.game_slug, error: 'Game not found in DB' });
          continue;
        }

        let insertedCount = 0;
        let updatedCount = 0;

        for (const event of extractedJson.events) {
          const payload = {
            game_id: gameData.id,
            title: event.title,
            description: `Type: ${event.type}`,
            start_date: event.start_date || new Date().toISOString(),
            end_date: event.end_date || new Date(Date.now() + 86400000 * 14).toISOString(),
            rewards: {
              _type: event.type,
              ...event.details
            },
            source_url: source.url,
            is_active: true,
            updated_at: new Date().toISOString()
          };

          // Find existing event
          const { data: existingEvent } = await supabaseAdmin
            .from('events')
            .select('id')
            .eq('game_id', gameData.id)
            .eq('title', event.title)
            .maybeSingle();

          if (existingEvent) {
            await supabaseAdmin
              .from('events')
              .update(payload)
              .eq('id', existingEvent.id);
            updatedCount++;
          } else {
            await supabaseAdmin
              .from('events')
              .insert(payload);
            insertedCount++;
          }
        }

        results.push({ 
          game_slug: source.game_slug, 
          extracted: extractedJson.events.length, 
          inserted: insertedCount,
          updated: updatedCount
        });
      } catch (err: any) {
        results.push({ game_slug: source.game_slug, error: err.message });
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (error: any) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
