import { z } from "zod";

export const EventContentSchema = z.object({
  seo_title: z.string().max(70),
  seo_description: z.string().max(160),
  h1_title: z.string().max(100),
  context_text: z.string().max(600),
  faq: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .min(2)
    .max(5),
});

export const ArtistContentSchema = z.object({
  bio_es: z.string().max(800),
});

export const VenueContentSchema = z.object({
  description_es: z.string().max(400),
});

export type EventContent = z.infer<typeof EventContentSchema>;
export type ArtistContent = z.infer<typeof ArtistContentSchema>;
export type VenueContent = z.infer<typeof VenueContentSchema>;
