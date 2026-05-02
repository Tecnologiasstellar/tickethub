export interface SuperboletosRawEvent {
  url: string;
  title: string;
  artistName: string;
  venueName: string;
  cityName: string;
  dateIso: string;
  imageUrl?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  sourceId: string;
}
