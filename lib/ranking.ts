/** Competition ranking: ties share a rank and the next rank skips (1, 1, 3). */
export function assignRanks<T extends { points: number }>(
  rows: readonly T[],
): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points);
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || row.points !== sorted[i - 1].points) rank = i + 1;
    return { ...row, rank };
  });
}
