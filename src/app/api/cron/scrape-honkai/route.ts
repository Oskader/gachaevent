import { createCronScraper } from '@/lib/scraper/cron-route'

export const maxDuration = 60

// La fuente y el porqué de la fuente están en src/lib/scraper/sources.ts
export const GET = createCronScraper('honkai-star-rail')
