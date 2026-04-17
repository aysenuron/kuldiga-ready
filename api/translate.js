import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, targetLang = 'lv' } = req.body ?? {};
  if (!text?.trim()) {
    return res.status(400).json({ error: 'No text provided' });
  }

  const targetNames = { lv: 'Latvian', fi: 'Finnish', et: 'Estonian' };
  const targetName = targetNames[targetLang] ?? 'Latvian';

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Detect whether the following text is English or ${targetName}. If it is English, translate it to ${targetName}. If it is ${targetName} (or any non-English language), translate it to English. Respond with only valid JSON, exactly: {"detectedLang":"en","translation":"..."} or {"detectedLang":"${targetLang}","translation":"..."}\n\nText: ${text}`,
        },
      ],
    });

    const raw = message.content[0].text.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Unexpected API response format');

    const { detectedLang, translation } = JSON.parse(match[0]);
    res.status(200).json({ detectedLang, translation });
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ error: err.message ?? 'Translation failed' });
  }
}
