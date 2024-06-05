export type MaybeArray<T> = T | T[];

export function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function isArray<T, O>(maybeArray: T[] | O): maybeArray is T[] {
  return Array.isArray(maybeArray);
}
