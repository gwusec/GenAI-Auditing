// Small, dependency-free deterministic hash (FNV-1a, 32-bit) rendered as hex.
// Used to fingerprint the canonical text of an event so annotations can assert
// the text hasn't drifted. Not cryptographic — collision-resistance enough for
// change detection, and it runs identically in the browser and in Node.

export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619, kept in 32-bit range via Math.imul
    hash = Math.imul(hash, 0x01000193);
  }
  // >>> 0 coerces to an unsigned 32-bit int
  return (hash >>> 0).toString(16).padStart(8, "0");
}
