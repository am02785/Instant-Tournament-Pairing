import { Player } from '../types';

const SEED_ADJUSTMENTS: { [rank: number]: number } = {
  1: -5,
  2: -2,
  3: 0,
  4: 2,
  5: 4,
  6: 6,
  7: 8,
};

const BASE_SEEDS: { [rank: number]: number } = {
  1: 1,
  2: 2,
  3: 3,
  4: 5,
  5: 7,
  6: 10,
  7: 12,
};

export function getSeedAdjustment(rank: number): number {
  if (SEED_ADJUSTMENTS[rank] !== undefined) {
    return SEED_ADJUSTMENTS[rank];
  }
  return 8 + (rank - 7) * 2;
}

export function getBaseSeedForRank(rank: number): number {
  if (BASE_SEEDS[rank] !== undefined) {
    return BASE_SEEDS[rank];
  }
  return 12 + (rank - 7) * 2;
}

/** World Cup seed table is built for places 1–7. Royale caps here so a long ladder is not harsher. */
export const WORLD_CUP_MAX_FINISH_RANK = 7;

export function capToWorldCupFinishRank(rank: number): number {
  return Math.min(rank, WORLD_CUP_MAX_FINISH_RANK);
}

export function playerHasSeed(player: Player): boolean {
  return typeof player.seed === 'number';
}

/**
 * New global seed after a finish. Seeded players get +/- against their current seed.
 * Unseeded players who earned a finish get a base seed from place.
 */
export function adjustedSeedForFinish(player: Player, rank: number): number {
  if (playerHasSeed(player)) {
    return (player.seed as number) + getSeedAdjustment(rank);
  }
  return getBaseSeedForRank(rank);
}
