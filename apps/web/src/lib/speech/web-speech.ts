import type { SpeechToTextProvider, SttHandlers, TextToSpeechProvider } from './types';

function getRecognitionCtor(): SpeechRecognitionConstructor | undefined {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

/** Speech-to-text via the browser Web Speech API. */
export class WebSpeechToText implements SpeechToTextProvider {
  private recognition?: SpeechRecognition;

  isSupported(): boolean {
    return Boolean(getRecognitionCtor());
  }

  start(handlers: SttHandlers): void {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      handlers.onError('Speech recognition is not supported in this browser.');
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let transcript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        transcript += result[0]?.transcript ?? '';
        if (result.isFinal) isFinal = true;
      }
      handlers.onResult(transcript.trim(), isFinal);
    };
    recognition.onerror = (event) => handlers.onError(event.error || 'speech recognition error');
    recognition.onend = () => handlers.onEnd();

    this.recognition = recognition;
    recognition.start();
  }

  stop(): void {
    this.recognition?.stop();
  }
}

/** Text-to-speech via the browser SpeechSynthesis API. */
export class WebTextToSpeech implements TextToSpeechProvider {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  speak(text: string): void {
    if (!this.isSupported() || text.trim().length === 0) return;
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    if (this.isSupported()) window.speechSynthesis.cancel();
  }
}
