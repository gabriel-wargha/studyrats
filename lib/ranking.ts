/**
 * Standard competition ranking: equal points share a rank and the next rank
 * skips (10, 10, 8 points give ranks 1, 1, 3). Input order is kept, so sort
 * in SQL first (points desc, name asc).
 */
export function assignRanks<T extends { points: number }>(
  rows: readonly T[],
): Array<T & { rank: number }> {
  const out: Array<T & { rank: number }> = [];
  rows.forEach((row, i) => {
    const prev = out[i - 1];
    const rank = prev && prev.points === row.points ? prev.rank : i + 1;
    out.push({ ...row, rank });
  });
  return out;
}
