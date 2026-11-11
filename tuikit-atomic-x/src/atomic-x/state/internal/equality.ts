const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Map);

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && Object.is(a[key], b[key]));
}

export function mapEqual<K, V>(a: Map<K, V> | null, b: Map<K, V> | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (!b.has(key) || !Object.is(b.get(key), value)) return false;
  }
  return true;
}
