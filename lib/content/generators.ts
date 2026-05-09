import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import {
  EventContentSchema,
  ArtistContentSchema,
  VenueContentSchema,
  type EventContent,
  type ArtistContent,
  type VenueContent,
} from "./schemas";
import {
  buildEventMessages,
  buildArtistMessages,
  buildVenueMessages,
  type EventPromptData,
  type ArtistPromptData,
  type VenuePromptData,
} from "./prompts";

const MODEL = "gpt-4o-mini";

export function createOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function generateEventContent(
  data: EventPromptData,
  client: OpenAI,
): Promise<EventContent> {
  const messages = buildEventMessages(data);
  const response = await client.beta.chat.completions.parse({
    model: MODEL,
    messages,
    response_format: zodResponseFormat(EventContentSchema, "event_content"),
  });
  const parsed = response.choices[0]?.message.parsed;
  if (!parsed) throw new Error("OpenAI returned no parsed content for event");
  return parsed;
}

export async function generateArtistContent(
  data: ArtistPromptData,
  client: OpenAI,
): Promise<ArtistContent> {
  const messages = buildArtistMessages(data);
  const response = await client.beta.chat.completions.parse({
    model: MODEL,
    messages,
    response_format: zodResponseFormat(ArtistContentSchema, "artist_content"),
  });
  const parsed = response.choices[0]?.message.parsed;
  if (!parsed) throw new Error("OpenAI returned no parsed content for artist");
  return parsed;
}

export async function generateVenueContent(
  data: VenuePromptData,
  client: OpenAI,
): Promise<VenueContent> {
  const messages = buildVenueMessages(data);
  const response = await client.beta.chat.completions.parse({
    model: MODEL,
    messages,
    response_format: zodResponseFormat(VenueContentSchema, "venue_content"),
  });
  const parsed = response.choices[0]?.message.parsed;
  if (!parsed) throw new Error("OpenAI returned no parsed content for venue");
  return parsed;
}
