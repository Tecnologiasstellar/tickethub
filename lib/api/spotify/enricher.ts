import { queryOne } from "../../db";
import type { SpotifyArtist } from "./types";

/**
 * Persist Spotify data to an artist row.
 * Uses COALESCE so existing non-null fields are preserved.
 */
export async function enrichArtistFromSpotify(
  artistId: string,
  sp: SpotifyArtist
): Promise<void> {
  const bestImage =
    sp.images.find((i) => i.width && i.width >= 300) ?? sp.images[0];

  await queryOne(
    `UPDATE artists
     SET spotify_id  = COALESCE(spotify_id, $2),
         image_url   = COALESCE(image_url, $3),
         genres      = COALESCE(genres, $4),
         popularity  = COALESCE(popularity, $5),
         updated_at  = NOW()
     WHERE id = $1`,
    [
      artistId,
      sp.id,
      bestImage?.url ?? null,
      sp.genres.length > 0 ? sp.genres : null,
      sp.popularity,
    ]
  );
}
