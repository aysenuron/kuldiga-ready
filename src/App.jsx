import { useState, useRef, useCallback } from 'react';
import { detectAndTranslate } from './api/translate';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import './App.css';

const STATUS = {
  IDLE: 'idle',
  LISTENING: 'listening',
  TRANSLATING: 'translating',
  DONE: 'done',
  ERROR: 'error',
};

const SPEAK_LANG = { en: 'en-US', lv: 'lv-LV' };

function MicIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="white" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="22" x2="16" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

// Splits text into per-character spans with staggered animation-delay.
// Adaptive delay: shorter texts get more dramatic stagger, longer texts finish faster.
function AnimatedText({ text, className, isSpeaking }) {
  const chars = Array.from(text);
  const perCharDelay = Math.min(16, 380 / chars.length);

  return (
    <p className={`${className}${isSpeaking ? ' is-speaking' : ''}`}>
      {chars.map((char, i) => (
        <span
          key={i}
          className="char"
          style={{ animationDelay: `${i * perCharDelay}ms` }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </p>
  );
}

export default function App() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [detectedLang, setDetectedLang] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [textInput, setTextInput] = useState('');
  const lvSupportedRef = useRef(null);
  const textInputRef = useRef(null);

  const { speak, speaking, cancel } = useSpeechSynthesis();
  const recognitionRef = useRef(null);

  const handleTranscript = useCallback(
    async (text) => {
      setTranscript(text);
      setStatus(STATUS.TRANSLATING);
      try {
        const { detectedLang: lang, translation: result } = await detectAndTranslate(text);
        setDetectedLang(lang);
        setTranslation(result);
        setStatus(STATUS.DONE);
        speak(result, SPEAK_LANG[lang === 'en' ? 'lv' : 'en']);
      } catch (err) {
        setErrorMsg(err.message);
        setStatus(STATUS.ERROR);
      }
    },
    [speak],
  );

  const startRecognition = useCallback(
    (lang) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        setErrorMsg('Speech recognition is not supported in this browser. Please type below.');
        setStatus(STATUS.ERROR);
        return;
      }

      const rec = new SR();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onresult = (e) => {
        const { transcript, confidence } = e.results[0][0];
        // confidence is 0 when the browser doesn't report it — skip threshold in that case
        if (confidence > 0 && confidence < 0.7) {
          setErrorMsg("Didn't catch that, try again.");
          setStatus(STATUS.IDLE);
          return;
        }
        setTextInput(transcript);
        setStatus(STATUS.IDLE);
        setTimeout(() => textInputRef.current?.focus(), 50);
      };

      rec.onerror = (e) => {
        const isLangError =
          e.error === 'language-not-supported' || e.error === 'service-not-allowed';
        if (isLangError && lang === 'lv-LV') {
          lvSupportedRef.current = false;
          startRecognition('en-US');
          return;
        }
        if (e.error === 'no-speech') {
          setStatus(STATUS.IDLE);
          return;
        }
        setErrorMsg(e.error);
        setStatus(STATUS.ERROR);
      };

      rec.onend = () => {
        setStatus((prev) => (prev === STATUS.LISTENING ? STATUS.IDLE : prev));
      };

      recognitionRef.current = rec;
      rec.start();
      setStatus(STATUS.LISTENING);
    },
    [],
  );

  const handleMicTap = useCallback(() => {
    if (status === STATUS.LISTENING) {
      recognitionRef.current?.stop();
      setStatus(STATUS.IDLE);
      return;
    }
    if (speaking) cancel();
    setTextInput('');
    setTranscript('');
    setTranslation('');
    setDetectedLang(null);
    setErrorMsg('');
    startRecognition(lvSupportedRef.current === false ? 'en-US' : 'lv-LV');
  }, [status, speaking, cancel, startRecognition]);

  const handleTextSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!textInput.trim()) return;
      const text = textInput.trim();
      setTextInput('');
      if (speaking) cancel();
      setTranscript('');
      setTranslation('');
      setDetectedLang(null);
      setErrorMsg('');
      await handleTranscript(text);
    },
    [textInput, speaking, cancel, handleTranscript],
  );

  const statusLabel = {
    [STATUS.IDLE]:
      lvSupportedRef.current === false
        ? 'Tap to speak — using English recognition'
        : 'Tap to speak',
    [STATUS.LISTENING]: 'Listening…',
    [STATUS.TRANSLATING]: 'Translating…',
    [STATUS.DONE]:
      detectedLang === 'en'
        ? 'English → Latvian'
        : detectedLang === 'lv'
          ? 'Latvian → English'
          : '',
    [STATUS.ERROR]: '',
  }[status];

  const micClass = [
    'mic-btn',
    status === STATUS.LISTENING  && 'is-listening',
    status === STATUS.TRANSLATING && 'is-translating',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-name">Kuldiga Ready</span>
      </header>

      <main className="result-area">
        {/* key prop forces remount so fade-slide replays on each new transcript */}
        {transcript && <p key={transcript} className="transcript">{transcript}</p>}

        {/* key prop forces AnimatedText to remount and restagger on each new translation */}
        {translation && (
          <AnimatedText
            key={translation}
            text={translation}
            className="translation"
            isSpeaking={speaking}
          />
        )}

        {errorMsg && <p key={errorMsg} className="error-msg">{errorMsg}</p>}
      </main>

      <div className="mic-area">
        {/* Wrapper owns the one-time drop-in on mount */}
        <div className="mic-wrapper">
          <button
            onClick={handleMicTap}
            disabled={status === STATUS.TRANSLATING}
            className={micClass}
            aria-label={status === STATUS.LISTENING ? 'Stop listening' : 'Start listening'}
          >
            {status === STATUS.TRANSLATING ? (
              <span className="spinner" />
            ) : status === STATUS.LISTENING ? (
              <StopIcon />
            ) : (
              <MicIcon />
            )}
          </button>
        </div>

        <p className="status-label">{statusLabel}</p>
      </div>

      <footer className="app-footer">
        <form className="text-form" onSubmit={handleTextSubmit}>
          <div className="text-input-wrap">
            <input
              ref={textInputRef}
              type="text"
              className="text-input"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="or type here"
            />
          </div>
          <button
            type="submit"
            className="text-submit"
            disabled={!textInput.trim() || status === STATUS.TRANSLATING}
            aria-label="Translate"
          >
            →
          </button>
        </form>
      </footer>
    </div>
  );
}
