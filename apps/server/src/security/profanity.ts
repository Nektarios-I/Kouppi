/** Compact profanity list for names and chat (case-insensitive whole-word match). */
const BLOCKED_WORDS = [
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "cunt",
  "damn",
  "dick",
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "nigger",
  "nigga",
  "piss",
  "pussy",
  "shit",
  "slut",
  "twat",
  "whore",
];

const WORD_PATTERN = new RegExp(
  `\\b(${BLOCKED_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi"
);

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  WORD_PATTERN.lastIndex = 0;
  return WORD_PATTERN.test(text);
}

/** Replace profane words with asterisks; preserves word length roughly. */
export function filterProfanity(text: string): string {
  if (!text) return text;
  return text.replace(WORD_PATTERN, (match) => "*".repeat(Math.min(match.length, 8)));
}
