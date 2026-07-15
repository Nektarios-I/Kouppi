import { containsProfanity, filterProfanity } from "./profanity.js";

const URL_PATTERN = /https?:\/\/\S+/gi;
const HTML_TAG_PATTERN = /<[^>]*>/g;
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Strip control chars, HTML, profanity, and clamp display names. */
export function sanitizeDisplayName(name: string): string {
  const cleaned = name
    .replace(CONTROL_CHARS, "")
    .replace(HTML_TAG_PATTERN, "")
    .trim()
    .slice(0, 32);
  if (!cleaned || containsProfanity(cleaned)) return "";
  return filterProfanity(cleaned);
}

/** Strip HTML, links, profanity, and control chars from chat; preserve length cap. */
export function sanitizeChatText(message: string): string {
  return filterProfanity(
    message
      .replace(CONTROL_CHARS, "")
      .replace(HTML_TAG_PATTERN, "")
      .replace(URL_PATTERN, "[link removed]")
      .trim()
      .slice(0, 500)
  );
}

/** Basic emote cleanup — emoji/symbol only, short. */
export function sanitizeEmote(emote: string): string {
  return emote.replace(CONTROL_CHARS, "").replace(HTML_TAG_PATTERN, "").trim().slice(0, 32);
}
