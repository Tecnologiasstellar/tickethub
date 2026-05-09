export interface SKArtist {
  id: number;
  displayName: string;
  uri: string;
  identifier?: Array<{ mbid: string; href: string }>;
}

export interface SKPerformance {
  id: number;
  displayName: string;
  billing: "headline" | "support";
  billingIndex: number;
  artist: SKArtist;
}

export interface SKVenue {
  id: number;
  displayName: string;
  uri: string;
  lat?: number | null;
  lng?: number | null;
  metroArea?: {
    id: number;
    displayName: string;
    country: { displayName: string };
  };
  city?: {
    displayName: string;
    country: { displayName: string };
  };
}

export interface SKEvent {
  id: number;
  displayName: string;
  type: "Concert" | "Festival";
  uri: string;
  status: "ok" | "cancelled";
  start: { date: string | null; datetime: string | null; time: string | null };
  performance: SKPerformance[];
  venue: SKVenue;
  ageRestriction?: string | null;
}

export interface SKEventsResponse {
  resultsPage: {
    status: string;
    results: { event?: SKEvent[] };
    totalEntries: number;
    perPage: number;
    page: number;
  };
}
