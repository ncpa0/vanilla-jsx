import { SignalInteropInterface } from "./_interface";

type MiniSignalNodeRef = {
  [key: symbol]: symbol;
};

type MiniSignal = {
  readonly _symbol: unique symbol;
  add(cb: (value: any) => any): MiniSignalNodeRef;
  detach(cb: MiniSignalNodeRef): void;
};

export class MiniSignalInterop implements SignalInteropInterface<MiniSignal> {
  is(signal: unknown): signal is MiniSignal {
    return typeof signal === "object" && signal != null
      && "_symbol" in signal && typeof signal._symbol === "symbol"
      && signal._symbol.toString() === "Symbol(MiniSignal)";
  }

  add(signal: MiniSignal, cb: (value: any) => any): () => void {
    const b = signal.add(cb);
    return () => signal.detach(b);
  }
}
