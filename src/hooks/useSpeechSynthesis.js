import { useState, useCallback } from 'react';

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(null);

  const speak = useCallback((text, lang = 'lv-LV') => {
    if (!window.speechSynthesis) {
      setError('Speech synthesis not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = (event) => {
      setError(event.error);
      setSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speaking, error, speak, cancel };
}
