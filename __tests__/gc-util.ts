import { setFlagsFromString } from "v8";
import { runInNewContext } from "vm";
import { sleep } from "./utils";

setFlagsFromString("--expose_gc");
const rawGC = runInNewContext("gc");
export async function gc() {
  await sleep(0);
  rawGC();
  await sleep(0);
}
