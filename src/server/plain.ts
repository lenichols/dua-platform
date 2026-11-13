// Rows leave the server layer with dates as ISO strings, so they can be
// passed straight to client components and compared as text.

export type Plain<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | null
      ? string | null
      : T[K];
};

export function plain<T extends Record<string, unknown>>(row: T): Plain<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out as Plain<T>;
}

export function plainAll<T extends Record<string, unknown>>(rows: T[]): Plain<T>[] {
  return rows.map(plain);
}
