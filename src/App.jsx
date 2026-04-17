import { useState, useRef, useCallback } from 'react';
import { detectAndTranslate } from './api/translate';
import { transcribeAudio } from './api/transcribe';
import { useMediaRecorder } from './hooks/useMediaRecorder';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import './App.css';

const STATUS = {
  IDLE: 'idle',
  LISTENING: 'listening',       // MediaRecorder is recording
  TRANSCRIBING: 'transcribing', // waiting for Whisper
  TRANSLATING: 'translating',   // waiting for Claude
  DONE: 'done',
  ERROR: 'error',
};

const SPEAK_LANG = { en: 'en-US', lv: 'lv-LV', fi: 'fi-FI', et: 'et-EE' };

const TARGET_LANGS = [
  { code: 'lv', label: 'Latvian', flag: '🇱🇻' },
  { code: 'fi', label: 'Finnish', flag: '🇫🇮' },
  { code: 'et', label: 'Estonian', flag: '🇪🇪' },
];

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

function AnimatedText({ text, className, isSpeaking }) {
  const chars = Array.from(text);
  const perCharDelay = Math.min(16, 380 / chars.length);
  return (
    <p className={`${className}${isSpeaking ? ' is-speaking' : ''}`}>
      {chars.map((char, i) => (
        <span key={i} className="char" style={{ animationDelay: `${i * perCharDelay}ms` }}>
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
  const [errorMsg, setErrorMsg] = useState('');
  const [textInput, setTextInput] = useState('');
  const [targetLang, setTargetLang] = useState('lv');
  const textInputRef = useRef(null);

  const { speak, speaking, cancel } = useSpeechSynthesis();
  const { start: startRecording, stop: stopRecording } = useMediaRecorder();

  const handleTranslate = useCallback(
    async (text) => {
      setTranscript(text);
      setStatus(STATUS.TRANSLATING);
      try {
        const { detectedLang: lang, translation: result } = await detectAndTranslate(text, targetLang);
        setTranslation(result);
        setStatus(STATUS.DONE);
        speak(result, SPEAK_LANG[lang === 'en' ? targetLang : 'en']);
      } catch (err) {
        setErrorMsg(err.message);
        setStatus(STATUS.ERROR);
      }
    },
    [speak, targetLang],
  );

  const handleMicTap = useCallback(async () => {
    // Stop recording → send to Whisper
    if (status === STATUS.LISTENING) {
      setStatus(STATUS.TRANSCRIBING);
      try {
        const blob = await stopRecording();
        const { transcript: text } = await transcribeAudio(blob);
        if (!text?.trim()) {
          setErrorMsg("Didn't catch that, try again.");
          setStatus(STATUS.IDLE);
          return;
        }
        setTextInput(text);
        setStatus(STATUS.IDLE);
        setTimeout(() => textInputRef.current?.focus(), 50);
      } catch (err) {
        setErrorMsg(err.message);
        setStatus(STATUS.ERROR);
      }
      return;
    }

    // Start recording
    if (speaking) cancel();
    setTextInput('');
    setTranscript('');
    setTranslation('');
    setErrorMsg('');
    try {
      await startRecording();
      setStatus(STATUS.LISTENING);
    } catch (err) {
      const msg =
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow it in your browser settings.'
          : err.message ?? 'Could not start recording.';
      setErrorMsg(msg);
      setStatus(STATUS.ERROR);
    }
  }, [status, speaking, cancel, startRecording, stopRecording]);

  const handleTextSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!textInput.trim()) return;
      const text = textInput.trim();
      setTextInput('');
      if (speaking) cancel();
      setTranscript('');
      setTranslation('');
      setErrorMsg('');
      await handleTranslate(text);
    },
    [textInput, speaking, cancel, handleTranslate],
  );

  const statusLabel = {
    [STATUS.IDLE]: '',
    [STATUS.LISTENING]: 'Recording…',
    [STATUS.TRANSCRIBING]: 'Transcribing…',
    [STATUS.TRANSLATING]: '',
    [STATUS.DONE]: '',
    [STATUS.ERROR]: '',
  }[status];

  const busy = status === STATUS.TRANSCRIBING || status === STATUS.TRANSLATING;

  const micClass = [
    'mic-btn',
    status === STATUS.LISTENING   && 'is-listening',
    busy                          && 'is-translating',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-name">Kuldiga Ready</span>
        <div className="lang-selector" role="group" aria-label="Target language">
          {TARGET_LANGS.map(({ code, label, flag }) => (
            <button
              key={code}
              className={`lang-pill${targetLang === code ? ' is-active' : ''}`}
              onClick={() => setTargetLang(code)}
              aria-pressed={targetLang === code}
            >
              <span aria-hidden="true">{flag}</span>
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="result-area">
        {transcript && <p key={transcript} className="transcript">{transcript}</p>}
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
        <div className="mic-wrapper">
          <button
            onClick={handleMicTap}
            disabled={busy}
            className={micClass}
            aria-label={status === STATUS.LISTENING ? 'Stop recording' : 'Start recording'}
          >
            {busy ? (
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
            disabled={!textInput.trim() || busy}
            aria-label="Translate"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 19V5M6 11l6-6 6 6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
        <p className="app-credit">Built by Ayşenur Onaran</p>
      </footer>
    </div>
  );
}
