/**
 * Deterministic per-user shuffle. Same `userKey` always produces the same
 * order for the same input list, but two different users see different orders.
 *
 * Why: judges may not get through every submission. If everyone sees them
 * alphabetically, the projects at the bottom never get votes. Hashing
 * `(userKey, itemKey)` distributes attention so each project lands somewhere
 * different in each judge's queue.
 */

function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // 32-bit FNV prime multiplication
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function shuffleForUser<T>(
  items: T[],
  userKey: string,
  itemKey: (item: T) => string,
): T[] {
  return items
    .map((item) => ({ item, h: fnv1a32(`${userKey}::${itemKey(item)}`) }))
    .sort((a, b) => a.h - b.h)
    .map(({ item }) => item);
}
