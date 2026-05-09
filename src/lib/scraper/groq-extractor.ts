import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy_key_for_build' })

export interface ExtractedEvent {
  title: string
  description: string | null
  start_date: string // ISO 8601
  end_date: string // ISO 8601
  rewards: string[] | null
  source_url: string
}

const SYSTEM_PROMPT = `You are a gacha videogame data extractor.
You analyze text from wiki or news pages and return ONLY valid JSON.
No extra text, no markdown, no explanations.
ALWAYS respond with this exact format:
{"events": [{"title": string, "description": string|null, "start_date": "YYYY-MM-DDTHH:mm:ssZ", "end_date": "YYYY-MM-DDTHH:mm:ssZ", "rewards": string[]|null}]}
If you cannot find events with clear dates, return: {"events": []}
Current date is: ${new Date().toISOString()}`

async function callGroqWithRetry(
  text: string,
  gameSlug: string,
  attempt = 1
): Promise<ExtractedEvent[]> {
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Game: ${gameSlug}\n\nContent:\n${text}` },
      ],
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(content)
    return parsed.events ?? []
  } catch (error) {
    if (attempt >= 3) throw error
    // Exponential backoff: 500ms, 1000ms
    await new Promise((r) => setTimeout(r, 500 * attempt))
    return callGroqWithRetry(text, gameSlug, attempt + 1)
  }
}

export { callGroqWithRetry }
