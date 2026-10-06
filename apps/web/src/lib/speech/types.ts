// Provider abstraction for speech (spec §18) so the browser Web Speech API can later be swapped
// for a server-side or third-party provider without touching the UI. Text input is always the
// fallback, so these are optional capabilities.

export interface SttHandlers {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

export interface SpeechToTextProvider {
  isSupported(): boolean;
  start(handlers: SttHandlers): void;
  stop(): void;
}

export interface TextToSpeechProvider {
  isSupported(): boolean;
  speak(text: string): void;
  cancel(): void;
}
