export interface SLFArtist {
  mbid: string;
  name: string;
  sortName: string;
  disambiguation?: string;
  url: string;
}

export interface SLFArtistSearchResponse {
  type: string;
  itemsPerPage: number;
  page: number;
  total: number;
  artist: SLFArtist[];
}

export interface SLFSong {
  name: string;
  info?: string;
  tape?: boolean;
  cover?: { mbid: string; name: string };
}

export interface SLFSet {
  name?: string;
  encore?: number;
  song: SLFSong[];
}

export interface SLFSetlist {
  id: string;
  versionId?: string;
  eventDate: string;
  lastUpdated: string;
  artist: { mbid: string; name: string; sortName: string; url: string };
  venue: {
    id: string;
    name: string;
    city: {
      id: string;
      name: string;
      stateCode?: string;
      country: { code: string; name: string };
    };
    url: string;
  };
  sets: { set: SLFSet[] };
  url: string;
  info?: string;
}

export interface SLFSetlistsResponse {
  type: string;
  itemsPerPage: number;
  page: number;
  total: number;
  setlist: SLFSetlist[];
}
