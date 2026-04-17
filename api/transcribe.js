import OpenAI, { toFile } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { audio, mimeType } = req.body ?? {};
  if (!audio || !mimeType) {
    return res.status(400).json({ error: 'Missing audio or mimeType' });
  }

  try {
    const buffer = Buffer.from(audio, 'base64');
    // Strip codec params, map subtype to a Whisper-accepted extension
    const subtype = mimeType.split('/')[1].split(';')[0].toLowerCase();
    const EXT_MAP = { webm: 'webm', mp4: 'mp4', ogg: 'ogg', mpeg: 'mpeg', wav: 'wav' };
    const ext = EXT_MAP[subtype] ?? subtype;
    const cleanMime = `audio/${subtype}`;
    const file = await toFile(buffer, `recording.${ext}`, { type: cleanMime });

    const { text } = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });

    res.status(200).json({ transcript: text });
  } catch (err) {
    console.error('Transcription error:', err);
    res.status(500).json({ error: err.message ?? 'Transcription failed' });
  }
}
