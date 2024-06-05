import { SignalInteropInterface } from "./_interface";

type JsSignal = {
  add(cb: (value: any) => any): { detach(): void };
};

export class JsSignalInterop implements SignalInteropInterface<JsSignal> {
  is(signal: unknown): signal is JsSignal {
    return typeof signal === "object" && signal != null
      && signal.toString().startsWith("[Signal active:");
  }

  add(signal: JsSignal, cb: (value: any) => any): () => void {
    const b = signal.add(cb);
    return b.detach;
  }
}
