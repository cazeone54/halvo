// Pure rating maths, kept out of the DB glue so it's directly testable.
export type RatingSummary = {
  count: number;
  average: number; // 0 when there are no ratings
  rounded: number; // nearest half, for star display
};

export function summarizeRatings(ratings: number[]): RatingSummary {
  const valid = ratings.filter((r) => Number.isFinite(r) && r >= 1 && r <= 5);
  if (valid.length === 0) return { count: 0, average: 0, rounded: 0 };

  const average = valid.reduce((sum, r) => sum + r, 0) / valid.length;
  return {
    count: valid.length,
    // One decimal is what people expect to read ("4.7"), and rounding the
    // display value to the nearest half keeps star rendering honest rather
    // than showing a full star for 4.6.
    average: Math.round(average * 10) / 10,
    rounded: Math.round(average * 2) / 2,
  };
}
