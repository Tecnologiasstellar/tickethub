import slugify from "slugify";
import { query } from "../lib/db";

interface CitySeed {
  name: string;
  tier: 1 | 2;
  lat?: number;
  lng?: number;
}

const CITIES: CitySeed[] = [
  // Hero (tier 1)
  { name: "Ciudad de Mexico", tier: 1, lat: 19.4326, lng: -99.1332 },
  { name: "Guadalajara", tier: 1, lat: 20.6597, lng: -103.3496 },
  { name: "Monterrey", tier: 1, lat: 25.6866, lng: -100.3161 },
  { name: "Puebla", tier: 1, lat: 19.0414, lng: -98.2063 },
  { name: "Queretaro", tier: 1, lat: 20.5888, lng: -100.3899 },
  // Tier 2
  { name: "Tijuana", tier: 2, lat: 32.5149, lng: -117.0382 },
  { name: "Leon", tier: 2, lat: 21.122, lng: -101.6826 },
  { name: "Cancun", tier: 2, lat: 21.1619, lng: -86.8515 },
  { name: "Merida", tier: 2, lat: 20.9674, lng: -89.5926 },
  { name: "San Luis Potosi", tier: 2, lat: 22.1565, lng: -100.9855 },
  { name: "Toluca", tier: 2, lat: 19.2826, lng: -99.6557 },
  { name: "Aguascalientes", tier: 2, lat: 21.8853, lng: -102.2916 },
];

function citySlug(name: string): string {
  return slugify(name, { lower: true, strict: true, locale: "es" });
}

async function main() {
  console.log(`[seed-cities] upserting ${CITIES.length} cities`);

  let inserted = 0;
  let updated = 0;

  for (const c of CITIES) {
    const slug = citySlug(c.name);
    const result = await query<{ inserted: boolean }>(
      `INSERT INTO cities (name, slug, country, tier, lat, lng)
       VALUES ($1, $2, 'MX', $3, $4, $5)
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name,
             tier = EXCLUDED.tier,
             lat  = COALESCE(EXCLUDED.lat, cities.lat),
             lng  = COALESCE(EXCLUDED.lng, cities.lng)
       RETURNING (xmax = 0) AS inserted`,
      [c.name, slug, c.tier, c.lat ?? null, c.lng ?? null]
    );
    if (result[0]?.inserted) inserted++;
    else updated++;
  }

  const counts = await query<{ tier: number; count: string }>(
    `SELECT tier, COUNT(*)::text AS count FROM cities GROUP BY tier ORDER BY tier`
  );

  console.log(`[seed-cities] done. inserted=${inserted} updated=${updated}`);
  for (const row of counts) {
    console.log(`  tier ${row.tier}: ${row.count}`);
  }
}

main().catch((err) => {
  console.error("[seed-cities] failed:", err);
  process.exit(1);
});
