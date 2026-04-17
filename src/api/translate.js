import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

const LANGUAGE_NAMES = {
  en: 'English',
  lv: 'Latvian',
};

export async function translate(text, sourceLang, targetLang) {
  if (!text?.trim()) throw new Error('No text to translate');

  const from = LANGUAGE_NAMES[sourceLang] ?? sourceLang;
  const to = LANGUAGE_NAMES[targetLang] ?? targetLang;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Translate the following ${from} text to ${to}. Return only the translation, no explanations or extra text.\n\n${text}`,
      },
    ],
  });

  return message.content[0].text;
}

// Detects whether text is English or Latvian, then translates to the other.
// Returns { detectedLang: 'en' | 'lv', translation: string }
export async function detectAndTranslate(text) {
  if (!text?.trim()) throw new Error('No text to translate');

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Detect whether the following text is English or Latvian, then translate it to the other language. Respond with only valid JSON, exactly: {"detectedLang":"en","translation":"..."} or {"detectedLang":"lv","translation":"..."}\n\nText: ${text}`,
      },
    ],
  });

  const raw = message.content[0].text.trim();

  // Extract JSON even if the model wraps it in markdown fences
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Unexpected response from translation API');

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.detectedLang || !parsed.translation) {
    throw new Error('Malformed response from translation API');
  }
  return { detectedLang: parsed.detectedLang, translation: parsed.translation };
}
