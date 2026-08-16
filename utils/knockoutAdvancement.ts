import { Match, Player } from '../types';

/**
 * True when another knockout match still needs to finish before this match
 * can have both players (or be treated as a bye).
 */
export function hasIncompleteFeeders(match: Match, knockoutMatches: Match[]): boolean {
  if (!match?.id) return false;
  return knockoutMatches.some((m) => m?.futureMatchId === match.id && !m.complete);
}

/**
 * A knockout match with one player, no opponent, and no unfinished matches
 * feeding into it (round 1 odd pairing, or a later round with a single feeder).
 */
export function isTrueByeMatch(match: Match, knockoutMatches: Match[]): boolean {
  if (match?.stage !== 'knockout') return false;
  if (!match.player1?.id) return false;
  if (match.player2?.id) return false;
  return !hasIncompleteFeeders(match, knockoutMatches);
}

function getMatchWinner(match: Match): Player | undefined {
  if (!match.winnerId) return undefined;
  if (match.player1?.id === match.winnerId) return match.player1;
  if (match.player2?.id === match.winnerId) return match.player2;
  return undefined;
}

function samePlayerId(a?: Player, b?: Player): boolean {
  return (a?.id || undefined) === (b?.id || undefined);
}

/**
 * Place winners into later-round slots and auto-complete true BYE matches so
 * those players advance. Repeats until the bracket is stable.
 */
export function applyKnockoutAdvancement(bracket: Match[]): { bracket: Match[]; changed: boolean } {
  let current = [...bracket];
  let overallChanged = false;
  let iterationChanged = true;
  let guard = 0;

  while (iterationChanged && guard++ < 50) {
    iterationChanged = false;
    const knockoutMatches = current.filter((m) => m?.stage === 'knockout');
    const completedWithFuture = knockoutMatches.filter(
      (m) => m?.complete && m?.winnerId && m?.futureMatchId
    );

    current = current.map((match) => {
      if (!match || match.stage !== 'knockout') return match;

      const feedingMatches = completedWithFuture.filter((cm) => cm.futureMatchId === match.id);
      if (feedingMatches.length === 0) return match;

      const winners = feedingMatches
        .map(getMatchWinner)
        .filter((winner): winner is Player => Boolean(winner?.id));

      if (winners.length === 0) return match;

      const nextPlayer1 = winners[0];
      const nextPlayer2 = winners[1];

      if (samePlayerId(match.player1, nextPlayer1) && samePlayerId(match.player2, nextPlayer2)) {
        return match;
      }

      iterationChanged = true;
      const resetResult =
        match.complete || match.winnerId
          ? {
              complete: false,
              winnerId: undefined,
              player1Points: 0,
              player2Points: 0
            }
          : {};

      return {
        ...match,
        player1: nextPlayer1,
        player2: nextPlayer2,
        ...resetResult
      };
    });

    const knockoutAfterAdvance = current.filter((m) => m?.stage === 'knockout');
    current = current.map((match) => {
      if (!isTrueByeMatch(match, knockoutAfterAdvance)) return match;
      if (match.complete && match.winnerId === match.player1.id) return match;

      iterationChanged = true;
      return {
        ...match,
        complete: true,
        winnerId: match.player1.id,
        player1Points: 1,
        player2Points: 0
      };
    });

    if (iterationChanged) overallChanged = true;
  }

  return { bracket: current, changed: overallChanged };
}
