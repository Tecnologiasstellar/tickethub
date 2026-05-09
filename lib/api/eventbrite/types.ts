export interface EBMultiLang {
  text: string;
  html: string;
}

export interface EBMoney {
  currency: string;
  /** Numeric value in major units (MXN, USD). */
  value: number;
  display: string;
}

export interface EBVenue {
  id: string;
  name: string;
  address: {
    city?: string;
    region?: string;
    country?: string;
    address_1?: string;
    localized_address_display?: string;
  };
}

export interface EBTicketAvailability {
  has_available_tickets: boolean;
  is_sold_out: boolean;
  minimum_ticket_price?: EBMoney;
  maximum_ticket_price?: EBMoney;
}

export interface EBEvent {
  id: string;
  name: EBMultiLang;
  description?: EBMultiLang;
  url: string;
  start: { timezone: string; local: string; utc: string };
  end: { timezone: string; local: string; utc: string };
  status: "live" | "draft" | "cancelled" | "completed";
  listed: boolean;
  logo?: { url: string; original?: { url: string } };
  venue?: EBVenue;
  ticket_availability?: EBTicketAvailability;
  category_id?: string;
  /** Populated only for organizer-expand requests. */
  organizer?: { name: string };
}

export interface EBSearchResponse {
  events: EBEvent[];
  pagination: {
    object_count: number;
    page_number: number;
    page_size: number;
    page_count: number;
    continuation?: string;
    has_more_items: boolean;
  };
}
