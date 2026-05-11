import type { SourcePlatform } from "./types";

type Params = Record<string, string>;

const PARAMS_BY_PLATFORM: Record<string, Params> = {
  eventbrite: { aff: "tickethub" },
  ticketmaster: {
    utm_source: "tickethub",
    utm_medium: "aff",
    utm_campaign: "mx",
  },
  stubhub: { utm_source: "tickethub", utm_medium: "affiliate" },
  boletia: { ref: "tickethub" },
  superboletos: { ref: "tickethub" },
};

const DEFAULT_PARAMS: Params = { ref: "tickethub" };

/**
 * Append affiliate / tracking params to a vendor URL based on platform.
 * Returns the original input unchanged if it can't be parsed as a URL.
 */
export function buildAffiliateUrl(
  url: string,
  platform: SourcePlatform | string,
): string {
  if (!url) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const params = PARAMS_BY_PLATFORM[platform] ?? DEFAULT_PARAMS;
  for (const [k, v] of Object.entries(params)) {
    parsed.searchParams.set(k, v);
  }
  return parsed.toString();
}
