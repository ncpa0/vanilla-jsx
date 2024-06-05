import { SignalInteropInterface } from "./_interface";

type PreactSignal = {
  subscribe(cb: (value: any) => any): () => void;
};

export class PreactSignalInterop
  implements SignalInteropInterface<PreactSignal>
{
  is(signal: unknown): signal is PreactSignal {
    return typeof signal === "object" && signal != null
      && "subscribe" in signal && typeof signal.subscribe === "function"
      && "_version" in signal && signal._version === 0;
  }
  add(
    signal: PreactSignal,
    cb: (value: any) => any,
  ): () => void {
    const detach = signal.subscribe(cb);
    return detach;
  }
}
