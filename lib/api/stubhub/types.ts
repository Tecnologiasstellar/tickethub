export interface SHTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface SHPerformer {
  id: number;
  name: string;
  primaryAct: boolean;
}

export interface SHVenue {
  id: number;
  name: string;
  city: string;
  state: string;
  country: string;
  lat?: number;
  lon?: number;
}

export interface SHTicketInfo {
  minPrice: number;
  maxPrice: number;
  currency: string;
  totalTickets: number;
}

export interface SHEvent {
  id: number;
  name: string;
  dateLocal: string;          // "YYYY-MM-DDTHH:mm:ss"
  status: "Active" | "Cancelled" | "Postponed";
  performers: SHPerformer[];
  venue: SHVenue;
  eventUrl: string;
  imageUrl?: string;
  ticketInfo?: SHTicketInfo;
}

export interface SHEventsResponse {
  events: SHEvent[];
  totalResults: number;
  page: number;
  pageSize: number;
}
