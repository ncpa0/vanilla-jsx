import { Signal, VSignal } from "../signals";
import { SignalInteropInterface } from "./_interface";

export class VanillaJSXSignalInterop
  implements SignalInteropInterface<Signal<any>>
{
  is(signal: unknown): signal is Signal<any> {
    return signal instanceof VSignal;
  }

  add(signal: Signal<any>, cb: (value: any) => any): () => void {
    const b = signal.add(cb);
    return b.detach;
  }
}
