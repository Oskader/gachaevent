import { createCronScraper } from '@/lib/scraper/cron-route'

export const maxDuration = 60

export const GET = createCronScraper({
  gameSlug: 'zenless-zone-zero',
  sourceUrl:
    'https://zenless-zone-zero.fandom.com/api.php?action=parse&page=Event&format=json',
})
