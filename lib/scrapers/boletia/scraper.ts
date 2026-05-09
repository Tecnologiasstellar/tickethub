import { chromium, type Page } from "playwright";
import { delay } from "../../utils/http";
import type { BoletiaRawEvent } from "./types";

const BASE = "https://boletia.com";
const DELAY_BETWEEN_PAGES_MS = 800;
const DELAY_BETWEEN_EVENTS_MS = 500;

async function extractEventLinks(page: Page): Promise<string[]> {
  // Boletia event cards link to /eventos/<slug> or /e/<slug>
  const hrefs = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];
    return links
      .map((a) => a.href)
      .filter((href) => /boletia\.com\/(evento|e)\/[^/]+$/.test(href));
  });
  return [...new Set(hrefs)];
}

async function scrapeEventPage(
  page: Page,
  url: string
): Promise<BoletiaRawEvent | null> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await delay(500);

  return page.evaluate((pageUrl) => {
    // Try JSON-LD first (most reliable)
    const ldScripts = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    );
    for (const script of ldScripts) {
      try {
        const data = JSON.parse(script.textContent ?? "");
        if (data["@type"] === "MusicEvent" || data["@type"] === "Event") {
          const performer = Array.isArray(data.performer)
            ? data.performer[0]?.name
            : data.performer?.name;
          const location = data.location;
          const slug = pageUrl.split("/").pop() ?? pageUrl;
          return {
            url: pageUrl,
            title: data.name ?? "",
            artistName: performer ?? data.name ?? "",
            venueName: location?.name ?? "Por confirmar",
            cityName:
              location?.address?.addressLocality ??
              location?.address?.addressRegion ??
              "",
            dateIso: data.startDate ?? "",
            imageUrl: data.image ?? undefined,
            minPrice: data.offers?.lowPrice ?? undefined,
            maxPrice: data.offers?.highPrice ?? undefined,
            currency: data.offers?.priceCurrency ?? "MXN",
            sourceId: slug,
          };
        }
      } catch {}
    }

    // Fallback: extract from visible DOM
    const title =
      document.querySelector("h1")?.textContent?.trim() ?? "";
    const dateEl = document.querySelector("[data-date], .event-date, time");
    const dateIso = dateEl?.getAttribute("datetime") ?? dateEl?.textContent?.trim() ?? "";
    const priceEl = document.querySelector(".price, .ticket-price, [data-price]");
    const priceText = priceEl?.textContent?.trim() ?? "";
    const priceNum = parseFloat(priceText.replace(/[^0-9.]/g, ""));

    const slug = pageUrl.split("/").pop() ?? pageUrl;
    return {
      url: pageUrl,
      title,
      artistName: title,
      venueName: "Por confirmar",
      cityName: "",
      dateIso,
      minPrice: isNaN(priceNum) ? undefined : priceNum,
      sourceId: slug,
    };
  }, url);
}

export async function scrapeBoletia(maxEvents = 100): Promise<BoletiaRawEvent[]> {
  const browser = await chromium.launch({ headless: true });
  const results: BoletiaRawEvent[] = [];

  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (compatible; TicketHubBot/1.0; +https://tickethub.mx/bot)",
    });

    // Collect event links from the main listing and a music category page
    const listingUrls = [
      `${BASE}/conciertos`,
      `${BASE}/musica`,
      `${BASE}/eventos`,
    ];

    const allLinks: string[] = [];
    for (const listingUrl of listingUrls) {
      try {
        await page.goto(listingUrl, { waitUntil: "networkidle", timeout: 20_000 });
        await delay(1000);
        const links = await extractEventLinks(page);
        console.log(`[boletia] ${listingUrl}: ${links.length} event links`);
        allLinks.push(...links);
      } catch (err) {
        console.warn(
          `[boletia] failed to load listing ${listingUrl}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      await delay(DELAY_BETWEEN_PAGES_MS);
    }

    const uniqueLinks = [...new Set(allLinks)].slice(0, maxEvents);
    console.log(`[boletia] scraping ${uniqueLinks.length} unique event pages`);

    for (const link of uniqueLinks) {
      try {
        const ev = await scrapeEventPage(page, link);
        if (ev && ev.title) {
          results.push(ev);
        }
      } catch (err) {
        console.warn(
          `[boletia] error on ${link}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      await delay(DELAY_BETWEEN_EVENTS_MS);
    }
  } finally {
    await browser.close();
  }

  return results;
}
