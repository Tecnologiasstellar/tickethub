/** Raw event data extracted from Boletia HTML. */
export interface BoletiaRawEvent {
  /** Event page URL on boletia.com */
  url: string;
  title: string;
  artistName: string;
  venueName: string;
  cityName: string;
  dateIso: string;         // "YYYY-MM-DDTHH:mm:ss"
  imageUrl?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  sourceId: string;        // extracted from URL slug or data-id
}
