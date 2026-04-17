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
    // Extract bare subtype: "audio/webm;codecs=opus" → "webm"
    const ext = mimeType.split('/')[1].split(';')[0];
    const file = await toFile(buffer, `recording.${ext}`, { type: mimeType });

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
