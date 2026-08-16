import { Match, Player, Tournament } from '../types';
import { adjustedSeedForFinish, capToWorldCupFinishRank } from './seedAdjustments';

export const REMATCH_OTHERS_REQUIRED = 2;

export type RematchStatus = {
  hasPlayed: boolean;
  required: number;
  remainingA: number;
  remainingB: number;
  blocked: boolean;
};

export type OpponentEligibility = {
  player: Player;
  eligible: boolean;
  reason: string | null;
  rematch: RematchStatus;
};

export type RoyaleRanking = {
  player: Player;
  rank: number;
  points: number;
  adjustedSeed?: number;
};

export type RoyaleRecord = {
  wins: number;
  losses: number;
};

function hasSeed(player: Player): boolean {
  return typeof player.seed === 'number';
}

function matchPlayers(match: Match): string[] {
  return [match.player1?.id, match.player2?.id].filter((id): id is string => Boolean(id));
}

function isMatchBetween(match: Match, playerAId: string, playerBId: string): boolean {
  const ids = matchPlayers(match);
  return ids.includes(playerAId) && ids.includes(playerBId);
}

function opponentIdInMatch(match: Match, playerId: string): string | undefined {
  if (match.player1?.id === playerId) return match.player2?.id;
  if (match.player2?.id === playerId) return match.player1?.id;
  return undefined;
}

/**
 * Seeded players start ranked (lower seed = higher ladder rank). Unseeded players start unranked.
 */
export function buildInitialLadder(players: Player[]): string[] {
  return players
    .filter(hasSeed)
    .sort((a, b) => {
      const seedDiff = (a.seed as number) - (b.seed as number);
      if (seedDiff !== 0) return seedDiff;
      return a.name.localeCompare(b.name);
    })
    .map((player) => player.id);
}

/**
 * Apply one completed result to a ladder snapshot.
 * Higher-ranked wins (or any win over an unranked player) leave standings unchanged.
 * An unranked or lower-ranked winner takes the loser's position; the loser and everyone
 * originally between them drop one rank (leapfrog).
 */
export function applyRoyaleResult(ladder: string[], winnerId: string, loserId: string): string[] {
  const winnerIndex = ladder.indexOf(winnerId);
  const loserIndex = ladder.indexOf(loserId);

  if (loserIndex === -1) {
    return [...ladder];
  }

  if (winnerIndex !== -1 && winnerIndex < loserIndex) {
    return [...ladder];
  }

  const next = [...ladder];
  if (winnerIndex !== -1) {
    next.splice(winnerIndex, 1);
  }

  const insertAt = next.indexOf(loserId);
  next.splice(insertAt, 0, winnerId);
  return next;
}

/**
 * Replay completed matches in bracket order onto the initial ladder.
 */
export function computeRoyaleLadder(initialLadder: string[], matches: Match[]): string[] {
  let ladder = [...initialLadder];

  for (const match of matches) {
    if (!match?.complete || !match.winnerId || !match.player1?.id || !match.player2?.id) {
      continue;
    }

    const loserId = match.player1.id === match.winnerId ? match.player2.id : match.player1.id;
    ladder = applyRoyaleResult(ladder, match.winnerId, loserId);
  }

  return ladder;
}

export function getUnrankedPlayers(players: Player[], ladder: string[]): Player[] {
  const ranked = new Set(ladder);
  return players.filter((player) => !ranked.has(player.id));
}

export function getRoyaleRecords(matches: Match[]): Map<string, RoyaleRecord> {
  const records = new Map<string, RoyaleRecord>();

  const ensure = (playerId: string): RoyaleRecord => {
    let record = records.get(playerId);
    if (!record) {
      record = { wins: 0, losses: 0 };
      records.set(playerId, record);
    }
    return record;
  };

  for (const match of matches) {
    if (!match?.complete || !match.winnerId || !match.player1?.id || !match.player2?.id) {
      continue;
    }

    const loserId = match.player1.id === match.winnerId ? match.player2.id : match.player1.id;
    ensure(match.winnerId).wins += 1;
    ensure(loserId).losses += 1;
  }

  return records;
}

function completedMatchesInOrder(matches: Match[]): Match[] {
  return matches
    .map((match, index) => ({ match, index }))
    .filter(({ match }) => match?.complete && match.player1?.id && match.player2?.id)
    .sort((a, b) => {
      const aTime = a.match.completedAt;
      const bTime = b.match.completedAt;
      if (aTime && bTime && aTime !== bTime) {
        return aTime.localeCompare(bTime);
      }
      if (Boolean(aTime) !== Boolean(bTime)) {
        return aTime ? 1 : -1;
      }
      return a.index - b.index;
    })
    .map(({ match }) => match);
}

export function hasPendingMatch(matches: Match[], playerAId: string, playerBId: string): boolean {
  return matches.some(
    (match) => match && !match.complete && isMatchBetween(match, playerAId, playerBId)
  );
}

/**
 * After A and B play, they cannot rematch until each has completed matches against
 * two other distinct players since that meeting. Uses finish time (completedAt), not
 * the order challenges were created.
 */
export function getRematchStatus(
  playerAId: string,
  playerBId: string,
  matches: Match[]
): RematchStatus {
  const ordered = completedMatchesInOrder(matches);
  let lastIndex = -1;
  for (let i = 0; i < ordered.length; i++) {
    if (isMatchBetween(ordered[i], playerAId, playerBId)) {
      lastIndex = i;
    }
  }

  if (lastIndex === -1) {
    return {
      hasPlayed: false,
      required: REMATCH_OTHERS_REQUIRED,
      remainingA: 0,
      remainingB: 0,
      blocked: false,
    };
  }

  const othersA = new Set<string>();
  const othersB = new Set<string>();
  for (let i = lastIndex + 1; i < ordered.length; i++) {
    const otherA = opponentIdInMatch(ordered[i], playerAId);
    if (otherA && otherA !== playerBId) {
      othersA.add(otherA);
    }
    const otherB = opponentIdInMatch(ordered[i], playerBId);
    if (otherB && otherB !== playerAId) {
      othersB.add(otherB);
    }
  }

  const remainingA = Math.max(0, REMATCH_OTHERS_REQUIRED - othersA.size);
  const remainingB = Math.max(0, REMATCH_OTHERS_REQUIRED - othersB.size);

  return {
    hasPlayed: true,
    required: REMATCH_OTHERS_REQUIRED,
    remainingA,
    remainingB,
    blocked: remainingA > 0 || remainingB > 0,
  };
}

export function formatRematchProgress(
  status: RematchStatus,
  challengerName: string,
  opponentName: string
): string | null {
  if (!status.hasPlayed) {
    return null;
  }
  if (!status.blocked) {
    return 'Rematch ready';
  }

  const parts: string[] = [];
  if (status.remainingA > 0) {
    parts.push(
      `${challengerName} needs ${status.remainingA} more opponent${status.remainingA === 1 ? '' : 's'}`
    );
  }
  if (status.remainingB > 0) {
    parts.push(
      `${opponentName} needs ${status.remainingB} more opponent${status.remainingB === 1 ? '' : 's'}`
    );
  }
  return `Rematch: ${parts.join('; ')}`;
}

export function getRematchBlockReason(
  playerAId: string,
  playerBId: string,
  matches: Match[]
): string | null {
  const status = getRematchStatus(playerAId, playerBId, matches);
  return status.blocked ? formatRematchProgress(status, 'Challenger', 'Opponent') : null;
}

export function getChallengeBlockReason(
  challenger: Player,
  opponent: Player,
  ladder: string[],
  matches: Match[]
): string | null {
  if (challenger.id === opponent.id) {
    return 'Cannot challenge yourself';
  }

  const challengerIndex = ladder.indexOf(challenger.id);
  const opponentIndex = ladder.indexOf(opponent.id);

  if (opponentIndex === -1) {
    return 'Can only challenge a ranked player';
  }

  if (challengerIndex !== -1 && challengerIndex <= opponentIndex) {
    return 'You can only challenge someone ranked above you';
  }

  if (hasPendingMatch(matches, challenger.id, opponent.id)) {
    return 'A match against this player is already pending';
  }

  return getRematchBlockReason(challenger.id, opponent.id, matches);
}

export function getEligibleOpponents(
  challenger: Player,
  players: Player[],
  ladder: string[],
  matches: Match[]
): Player[] {
  return players.filter(
    (player) => getChallengeBlockReason(challenger, player, ladder, matches) === null
  );
}

export function getOpponentEligibility(
  challenger: Player,
  players: Player[],
  ladder: string[],
  matches: Match[]
): OpponentEligibility[] {
  return players
    .filter((player) => player.id !== challenger.id)
    .map((player) => {
      const reason = getChallengeBlockReason(challenger, player, ladder, matches);
      return {
        player,
        eligible: reason === null,
        reason,
        rematch: getRematchStatus(challenger.id, player.id, matches),
      };
    });
}

/**
 * Final Royale ranking: current ladder order, then unranked players by wins then name.
 * Seeded players get the same +/- finish adjustments as World Cup. Players who climbed
 * onto the ladder without a seed get a base seed from place. Places below 7 use the
 * same adjustment as World Cup group 4th (+8 / base seed 12). Players who never ranked
 * keep no seed.
 */
export function calculateRoyaleRankings(
  players: Player[],
  initialLadder: string[],
  matches: Match[]
): RoyaleRanking[] {
  const ladder = computeRoyaleLadder(initialLadder, matches);
  const records = getRoyaleRecords(matches);
  const playerById = new Map(players.map((player) => [player.id, player]));
  const rankedIds = new Set(ladder);
  const rankings: RoyaleRanking[] = [];

  ladder.forEach((playerId, index) => {
    const player = playerById.get(playerId);
    if (!player) return;
    const rank = index + 1;
    rankings.push({
      player,
      rank,
      points: records.get(playerId)?.wins ?? 0,
      adjustedSeed: adjustedSeedForFinish(player, capToWorldCupFinishRank(rank)),
    });
  });

  const unranked = players
    .filter((player) => !rankedIds.has(player.id))
    .sort((a, b) => {
      const winsDiff = (records.get(b.id)?.wins ?? 0) - (records.get(a.id)?.wins ?? 0);
      if (winsDiff !== 0) return winsDiff;
      return a.name.localeCompare(b.name);
    });

  unranked.forEach((player, index) => {
    const rank = ladder.length + index + 1;
    rankings.push({
      player,
      rank,
      points: records.get(player.id)?.wins ?? 0,
    });
  });

  return rankings;
}

export function isRoyaleTournament(tournament: Pick<Tournament, 'type'> | null | undefined): boolean {
  return tournament?.type === 'royale';
}
