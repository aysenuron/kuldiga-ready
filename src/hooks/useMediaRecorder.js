import { useState, useRef, useCallback } from 'react';

function preferredMimeType() {
  // audio/mp4 first: required on iOS/Safari where webm is unsupported
  const candidates = ['audio/mp4', 'audio/webm', 'audio/ogg'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export function useMediaRecorder() {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = preferredMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }, []);

  // Returns a Promise that resolves with the recorded Blob when the recorder stops.
  const stop = useCallback(
    () =>
      new Promise((resolve, reject) => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === 'inactive') {
          resolve(null);
          return;
        }

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          recorder.stream.getTracks().forEach((t) => t.stop());
          setRecording(false);
          resolve(blob);
        };

        recorder.onerror = (e) => {
          setRecording(false);
          reject(e.error ?? new Error('Recording failed'));
        };

        recorder.stop();
      }),
    [],
  );

  return { recording, start, stop };
}
