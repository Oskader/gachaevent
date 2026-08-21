import { createCronScraper } from '@/lib/scraper/cron-route'

export const maxDuration = 60

// La página de esta wiki es "Events" en plural; en las otras tres es singular.
// Verificado contra la API en vivo — no unificar sin comprobar.
export const GET = createCronScraper({
  gameSlug: 'honkai-star-rail',
  sourceUrl:
    'https://honkai-star-rail.fandom.com/api.php?action=parse&page=Events&format=json',
})
