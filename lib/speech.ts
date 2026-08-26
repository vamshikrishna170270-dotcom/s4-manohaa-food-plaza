interface IWindow extends Window {
  SpeechRecognition: any;
  webkitSpeechRecognition: any;
}

export class SpeechRecognitionService {
  private recognition: any = null;
  private isSupported: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const { SpeechRecognition, webkitSpeechRecognition } = window as unknown as IWindow;
      const SpeechRecognitionAPI = SpeechRecognition || webkitSpeechRecognition;

      if (SpeechRecognitionAPI) {
        this.isSupported = true;
        this.recognition = new SpeechRecognitionAPI();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-IN'; // Optimized for Indian English
      }
    }
  }

  public checkSupport(): boolean { return this.isSupported; }

  public start(onResult: (transcript: string) => void, onError: (error: string) => void, onEnd: () => void) {
    if (!this.isSupported || !this.recognition) {
      onError('Speech recognition is not supported in this browser.');
      return;
    }
    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        else interimTranscript += event.results[i][0].transcript;
      }
      const currentText = finalTranscript || interimTranscript;
      if (currentText) onResult(currentText);
    };
    this.recognition.onerror = (event: any) => onError(`Speech error: ${event.error}`);
    this.recognition.onend = () => onEnd();
    try { this.recognition.start(); } catch (err: any) { console.error(err); }
  }

  public stop() {
    if (this.recognition) { try { this.recognition.stop(); } catch (e) {} }
  }
}

export const speechService = new SpeechRecognitionService();