import chromium from '@sparticuz/chromium'
import playwright from 'playwright-core'

export async function getBrowser() {
  const browser = await playwright.chromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
  return browser
}

export async function scrapeHTML(url: string): Promise<string> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  await page.setExtraHTTPHeaders({
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  })

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 6000,
    })
    // Wait for dynamic JS content to render (SPA pages)
    await page.waitForTimeout(2000)
    return await page.content()
  } finally {
    await browser.close()
  }
}
