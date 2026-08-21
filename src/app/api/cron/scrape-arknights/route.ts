import { createCronScraper } from '@/lib/scraper/cron-route'

export const maxDuration = 60

// OJO: endfield.wiki.gg, no arknights.wiki.gg. El segundo es el Arknights
// original (tower defense), un juego distinto: apuntaba ahí y guardaba
// eventos del juego equivocado bajo el slug arknights-endfield.
export const GET = createCronScraper({
  gameSlug: 'arknights-endfield',
  sourceUrl:
    'https://endfield.wiki.gg/api.php?action=parse&page=Event&format=json',
})
