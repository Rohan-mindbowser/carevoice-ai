import { useCallback, useRef, useState } from 'react';
import { WebTextToSpeech } from '@/lib/speech/web-speech';

/** Text-to-speech hook with an on/off toggle; speaking only happens when enabled. */
export function useTextToSpeech() {
  const providerRef = useRef(new WebTextToSpeech());
  const [enabled, setEnabled] = useState(false);
  const supported = providerRef.current.isSupported();

  const speak = useCallback(
    (text: string) => {
      if (enabled) providerRef.current.speak(text);
    },
    [enabled],
  );

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      if (prev) providerRef.current.cancel();
      return !prev;
    });
  }, []);

  return { supported, enabled, toggle, speak };
}
