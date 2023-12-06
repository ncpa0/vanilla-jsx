export function sigProxy(s: JSX.Signal) {
  if ("remove" in s) {
    return {
      add: (cb: (value: JSX.SignalValue) => void) => {
        s.add(cb);
        return {
          detach() {
            s.remove(cb);
          },
        };
      },
    };
  }

  return s;
}
