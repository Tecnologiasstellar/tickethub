export interface TMImage {
  url: string;
  width: number;
  height: number;
  ratio: "16_9" | "3_2" | "4_3" | string;
  fallback?: boolean;
}

export interface TMClassification {
  primary: boolean;
  segment: { id: string; name: string };
  genre?: { id: string; name: string };
  subGenre?: { id: string; name: string };
}

export interface TMAttraction {
  id: string;
  name: string;
  type: string;
  images?: TMImage[];
  classifications?: TMClassification[];
}

export interface TMVenue {
  id: string;
  name: string;
  city?: { name: string };
  state?: { name: string };
  country?: { countryCode: string; name: string };
  address?: { line1: string };
  location?: { latitude: string; longitude: string };
}

export interface TMEvent {
  id: string;
  name: string;
  type: string;
  url: string;
  images: TMImage[];
  dates: {
    start: { localDate: string; localTime?: string; dateTime?: string };
    status: { code: "onsale" | "offsale" | "cancelled" | "postponed" | string };
  };
  priceRanges?: Array<{
    type: string;
    currency: string;
    min: number;
    max: number;
  }>;
  _embedded?: {
    venues?: TMVenue[];
    attractions?: TMAttraction[];
  };
}

export interface TMEventsResponse {
  _embedded?: {
    events: TMEvent[];
  };
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}
