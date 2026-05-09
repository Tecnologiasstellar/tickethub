import type { SLFSetlist } from "./types";

/** Shape written to the `setlists` table. */
export interface SetlistInsert {
  artistId: string;
  setlistfmId: string;
  eventDate: string;       // "YYYY-MM-DD"
  venueName: string;
  cityName: string;
  country: string;
  songs: Array<{ name: string; info?: string; isCover: boolean }>;
  sourceUrl: string;
}

/**
 * Convert a Setlist.fm setlist response to a DB-ready shape.
 * eventDate from SLF is "DD-MM-YYYY" → we convert to "YYYY-MM-DD".
 */
export function normalizeSetlist(
  sl: SLFSetlist,
  artistId: string
): SetlistInsert | null {
  if (!sl.id) return null;

  // Parse "DD-MM-YYYY" → "YYYY-MM-DD"
  const [dd, mm, yyyy] = sl.eventDate.split("-");
  if (!dd || !mm || !yyyy) return null;
  const eventDate = `${yyyy}-${mm}-${dd}`;

  // Flatten all songs from all sets
  const songs = sl.sets.set.flatMap((s) =>
    (s.song ?? []).map((song) => ({
      name: song.name,
      info: song.info,
      isCover: !!song.cover,
    }))
  );

  return {
    artistId,
    setlistfmId: sl.id,
    eventDate,
    venueName: sl.venue.name,
    cityName: sl.venue.city.name,
    country: sl.venue.city.country.code,
    songs,
    sourceUrl: sl.url,
  };
}
