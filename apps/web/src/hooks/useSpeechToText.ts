import { useCallback, useEffect, useRef, useState } from 'react';
import { WebSpeechToText } from '@/lib/speech/web-speech';

/**
 * Speech-to-text hook. `onFinalTranscript` fires once the user stops speaking. Interim text is
 * exposed for a live caption. Degrades silently when unsupported (text input remains the fallback).
 */
export function useSpeechToText(onFinalTranscript: (text: string) => void) {
  const providerRef = useRef(new WebSpeechToText());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const supported = providerRef.current.isSupported();

  const start = useCallback(() => {
    setError(null);
    setInterim('');
    providerRef.current.start({
      onResult: (transcript, isFinal) => {
        if (isFinal) {
          setInterim('');
          if (transcript.length > 0) onFinalTranscript(transcript);
        } else {
          setInterim(transcript);
        }
      },
      onError: (message) => {
        setError(message);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
    setListening(true);
  }, [onFinalTranscript]);

  const stop = useCallback(() => {
    providerRef.current.stop();
    setListening(false);
  }, []);

  useEffect(() => {
    const provider = providerRef.current;
    return () => provider.stop();
  }, []);

  return { supported, listening, interim, error, start, stop };
}
