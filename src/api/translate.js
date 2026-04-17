export async function detectAndTranslate(text, targetLang = 'lv') {
  if (!text?.trim()) throw new Error('No text to translate');

  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, targetLang }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error ?? 'Translation failed');
  }

  return res.json(); // { detectedLang, translation }
}
