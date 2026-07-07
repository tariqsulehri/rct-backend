export type StarRating = 1 | 2 | 3 | 4 | 5;

export type StarRatingBand = {
  minInclusive: number;
  rating: StarRating;
};

export const COMPETENCY_STAR_RATING_BANDS: StarRatingBand[] = [
  { minInclusive: 0.95, rating: 5 },
  { minInclusive: 0.65, rating: 4 },
  { minInclusive: 0.40, rating: 3 },
  { minInclusive: 0.20, rating: 2 },
  { minInclusive: Number.NEGATIVE_INFINITY, rating: 1 },
];

export const PROMOTION_STAR_RATING_BANDS: StarRatingBand[] = [
  { minInclusive: 0.95, rating: 5 },
  { minInclusive: 0.75, rating: 4 },
  { minInclusive: 0.60, rating: 3 },
  { minInclusive: 0.40, rating: 2 },
  { minInclusive: Number.NEGATIVE_INFINITY, rating: 1 },
];

export const SKILL_SUMMARY_STAR_RATING_BANDS: StarRatingBand[] = [
  { minInclusive: 0.95, rating: 5 },
  { minInclusive: 0.90, rating: 4 },
  { minInclusive: 0.75, rating: 3 },
  { minInclusive: 0.60, rating: 2 },
  { minInclusive: Number.NEGATIVE_INFINITY, rating: 1 },
];

export function scoreToStarRatingBand(score: number, bands: StarRatingBand[]): StarRating {
  return bands.find((band) => score >= band.minInclusive)?.rating ?? 1;
}
