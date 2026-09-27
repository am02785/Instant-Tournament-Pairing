import { describe, expect, it } from 'vitest';
import { Match, Player } from '../types';
import {
  applyRoyaleResult,
  buildInitialLadder,
  calculateRoyaleRankings,
  computeRoyaleLadder,
  getChallengeBlockReason,
  getEligibleOpponents,
  getRematchBlockReason,
  getRematchStatus,
  getRoyaleResultBlockReason,
} from '../utils/royaleLadder';

function player(id: string, name: string, seed?: number): Player {
  return { id, name, officeDays: ['Mon'], seed };
}

function match(
  player1: Player,
  player2: Player,
  winnerId?: string,
  complete = true,
  completedAt?: string
): Match {
  return {
    id: `${player1.id}-${player2.id}-${winnerId ?? 'pending'}-${completedAt ?? 'none'}`,
    player1,
    player2,
    round: 1,
    stage: 'royale',
    complete,
    winnerId,
    player1Points: winnerId === player1.id ? 2 : 1,
    player2Points: winnerId === player2.id ? 2 : 1,
    completedAt,
  };
}

const alice = player('a', 'Alice', 1);
const bob = player('b', 'Bob', 2);
const carol = player('c', 'Carol', 3);
const dave = player('d', 'Dave', 4);
const eve = player('e', 'Eve');
const frank = player('f', 'Frank');

describe('buildInitialLadder', () => {
  it('ranks seeded players by seed and leaves unseeded players off the ladder', () => {
    expect(buildInitialLadder([eve, dave, alice, frank, bob])).toEqual(['a', 'b', 'd']);
  });

  it('treats null/undefined seed as unranked', () => {
    const noSeed = player('x', 'X');
    const nullSeed = { ...player('y', 'Y'), seed: undefined };
    expect(buildInitialLadder([noSeed, nullSeed, alice])).toEqual(['a']);
  });

  it('breaks seed ties by name', () => {
    const zed = player('z', 'Zed', 1);
    const amy = player('m', 'Amy', 1);
    expect(buildInitialLadder([zed, amy])).toEqual(['m', 'z']);
  });
});

describe('applyRoyaleResult', () => {
  const ladder = ['a', 'b', 'c', 'd'];

  it('does not move anyone when a higher-ranked player beats a lower-ranked player', () => {
    expect(applyRoyaleResult(ladder, 'a', 'd')).toEqual(ladder);
  });

  it('does not move anyone when a ranked player beats an unranked player', () => {
    expect(applyRoyaleResult(ladder, 'a', 'e')).toEqual(ladder);
  });

  it('lets a lower-ranked winner take the loser’s position and shift everyone between them down', () => {
    expect(applyRoyaleResult(ladder, 'd', 'a')).toEqual(['d', 'a', 'b', 'c']);
  });

  it('inserts an unranked winner at the beaten player’s rank and drops that player one place', () => {
    expect(applyRoyaleResult(ladder, 'e', 'b')).toEqual(['a', 'e', 'b', 'c', 'd']);
  });

  it('does not rank anyone when two unranked players play', () => {
    expect(applyRoyaleResult(ladder, 'e', 'f')).toEqual(ladder);
  });
});

describe('computeRoyaleLadder', () => {
  it('replays completed matches by Completed at time', () => {
    const initial = ['a', 'b', 'c', 'd'];
    const matches = [
      match(dave, alice, dave.id, true, '2026-01-01T00:00:00.000Z'),
      match(eve, bob, eve.id, true, '2026-01-02T00:00:00.000Z'),
    ];
    expect(computeRoyaleLadder(initial, matches)).toEqual(['d', 'a', 'e', 'b', 'c']);
  });

  it('uses Completed at even when bracket array order differs', () => {
    const initial = ['a', 'b', 'c', 'd'];
    // Stored newest-first in the array, but Completed at says Dave vs Alice was first
    const matches = [
      match(eve, bob, eve.id, true, '2026-01-02T00:00:00.000Z'),
      match(dave, alice, dave.id, true, '2026-01-01T00:00:00.000Z'),
    ];
    expect(computeRoyaleLadder(initial, matches)).toEqual(['d', 'a', 'e', 'b', 'c']);
  });

  it('ignores incomplete matches', () => {
    const initial = ['a', 'b'];
    expect(computeRoyaleLadder(initial, [match(bob, alice, bob.id, false)])).toEqual(['a', 'b']);
  });
});

describe('rematch and eligibility', () => {
  const ranked = [alice, bob, carol, dave];
  const ladder = ['a', 'b', 'c', 'd'];

  it('blocks a rematch until the challenger has played two other distinct opponents', () => {
    const matches = [match(dave, carol, dave.id, true, '2026-01-01T00:00:00.000Z')];
    const currentLadder = computeRoyaleLadder(ladder, matches);
    const status = getRematchStatus(dave.id, carol.id, matches);
    expect(status).toMatchObject({ hasPlayed: true, blocked: true, remaining: 2 });
    expect(getRematchBlockReason(dave.id, carol.id, matches)).toMatch(/needs 2 more/);
    expect(getEligibleOpponents(dave, ranked, currentLadder, matches).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('counts remaining opponents for the last-meeting challenger only', () => {
    const matches = [
      match(dave, carol, dave.id, true, '2026-01-01T00:00:00.000Z'),
      match(dave, alice, dave.id, true, '2026-01-02T00:00:00.000Z'),
    ];
    expect(getRematchStatus(dave.id, carol.id, matches)).toMatchObject({
      blocked: true,
      remaining: 1,
      cooldownPlayerId: dave.id,
    });
  });

  it('keeps cooldown on the previous challenger when the ladder flips', () => {
    // Dave challenges Carol and loses; then Dave beats Bob and climbs above Carol.
    const matches = [
      match(dave, carol, carol.id, true, '2026-01-01T00:00:00.000Z'),
      match(dave, bob, dave.id, true, '2026-01-02T00:00:00.000Z'),
    ];
    const currentLadder = computeRoyaleLadder(ladder, matches);
    expect(currentLadder.indexOf(dave.id)).toBeLessThan(currentLadder.indexOf(carol.id));

    // Pair cooldown still tracks Dave's remaining others — not a fresh 2 for Carol.
    expect(getRematchStatus(carol.id, dave.id, matches)).toMatchObject({
      blocked: true,
      remaining: 1,
      cooldownPlayerId: dave.id,
    });
    expect(getRematchStatus(dave.id, carol.id, matches)).toMatchObject({
      blocked: true,
      remaining: 1,
      cooldownPlayerId: dave.id,
    });
    expect(getChallengeBlockReason(carol, dave, currentLadder, matches)).toMatch(/Dave needs 1 more/);
  });

  it('allows either direction once the previous challenger has played two others', () => {
    const matches = [
      match(dave, alice, dave.id, true, '2026-01-01T00:00:00.000Z'),
      match(dave, bob, dave.id, true, '2026-01-02T00:00:00.000Z'),
      match(dave, carol, dave.id, true, '2026-01-03T00:00:00.000Z'),
    ];
    const currentLadder = computeRoyaleLadder(ladder, matches);
    expect(getRematchStatus(dave.id, alice.id, matches).blocked).toBe(false);
    expect(getRematchBlockReason(dave.id, alice.id, matches)).toBeNull();
    // Alice may challenge Dave (now above her) without needing her own two others
    expect(getChallengeBlockReason(alice, dave, currentLadder, matches)).toBeNull();
  });

  it('does not require the previous opponent to play other matches', () => {
    const matches = [
      match(dave, alice, dave.id, true, '2026-01-01T00:00:00.000Z'),
      match(dave, bob, dave.id, true, '2026-01-02T00:00:00.000Z'),
      match(dave, carol, dave.id, true, '2026-01-03T00:00:00.000Z'),
    ];
    // Alice has played nobody else since the Dave match, but rematch is still allowed
    expect(getRematchStatus(dave.id, alice.id, matches)).toMatchObject({
      blocked: false,
      remaining: 0,
    });
  });

  it('uses finish time so earlier-created matches completed later still start the cooldown', () => {
    const matches = [
      match(dave, carol, dave.id, true, '2026-01-05T00:00:00.000Z'),
      match(dave, alice, dave.id, true, '2026-01-01T00:00:00.000Z'),
      match(dave, bob, dave.id, true, '2026-01-02T00:00:00.000Z'),
      match(carol, alice, carol.id, true, '2026-01-03T00:00:00.000Z'),
      match(carol, bob, carol.id, true, '2026-01-04T00:00:00.000Z'),
    ];
    expect(getRematchStatus(dave.id, carol.id, matches)).toMatchObject({
      blocked: true,
      remaining: 2,
      cooldownPlayerId: dave.id,
    });
  });

  it('does not allow challenging down or challenging an unranked player', () => {
    expect(getChallengeBlockReason(alice, bob, ladder, [])).toMatch(/above you/);
    expect(getChallengeBlockReason(alice, eve, ladder, [])).toMatch(/ranked player/);
  });

  it('lets an unranked player challenge any ranked player', () => {
    expect(getEligibleOpponents(eve, [...ranked, eve, frank], ladder, []).map((p) => p.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('lets a ranked player challenge anyone above them', () => {
    expect(getEligibleOpponents(dave, ranked, ladder, []).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('blocks a second pending match against the same pair', () => {
    const pending = [match(dave, alice, undefined, false)];
    expect(getChallengeBlockReason(dave, alice, ladder, pending)).toMatch(/pending/);
  });
});

describe('getRoyaleResultBlockReason', () => {
  const ladder = ['a', 'b', 'c', 'd'];

  it('allows a pending rematch when Completed at is after two other matches', () => {
    const pending = match(dave, carol, undefined, false);
    // Dave stays below Carol (loses the intervening matches) so challenging up is still legal
    const matches = [
      match(dave, carol, carol.id, true, '2026-01-01T00:00:00.000Z'),
      match(dave, alice, alice.id, true, '2026-01-02T00:00:00.000Z'),
      match(dave, bob, bob.id, true, '2026-01-03T00:00:00.000Z'),
      pending,
    ];

    expect(
      getRoyaleResultBlockReason(pending, ladder, matches, '2026-01-04T00:00:00.000Z')
    ).toBeNull();
  });

  it('rejects a rematch when Completed at is before two other matches', () => {
    const pending = match(dave, carol, undefined, false);
    const matches = [
      match(dave, carol, carol.id, true, '2026-01-01T00:00:00.000Z'),
      match(dave, alice, alice.id, true, '2026-01-02T00:00:00.000Z'),
      match(dave, bob, bob.id, true, '2026-01-03T00:00:00.000Z'),
      pending,
    ];

    expect(
      getRoyaleResultBlockReason(pending, ladder, matches, '2026-01-01T12:00:00.000Z')
    ).toMatch(/needs 2 more/);
  });

  it('rejects challenging down based on ladder state at Completed at', () => {
    const pending = match(alice, dave, undefined, false);
    const matches = [pending];

    expect(
      getRoyaleResultBlockReason(pending, ladder, matches, '2026-01-01T00:00:00.000Z')
    ).toMatch(/ranked above you/);
  });
});

describe('calculateRoyaleRankings', () => {
  it('applies World Cup +/- seed adjustments and leaves never-ranked players unseeded', () => {
    const players = [alice, bob, carol, dave, eve, frank];
    const initial = buildInitialLadder(players);
    const matches = [match(eve, bob, eve.id)];
    const rankings = calculateRoyaleRankings(players, initial, matches);

    expect(rankings.map((r) => ({ id: r.player.id, rank: r.rank, seed: r.adjustedSeed }))).toEqual([
      { id: 'a', rank: 1, seed: -4 },
      { id: 'e', rank: 2, seed: 2 },
      { id: 'b', rank: 3, seed: 2 },
      { id: 'c', rank: 4, seed: 5 },
      { id: 'd', rank: 5, seed: 8 },
      { id: 'f', rank: 6, seed: undefined },
    ]);
  });

  it('caps seed adjustments at World Cup rank 7 so a long ladder is not harsher', () => {
    const extra = [
      player('g', 'Gina', 5),
      player('h', 'Hal', 6),
      player('i', 'Ivy', 7),
      player('j', 'Jon', 8),
    ];
    const players = [alice, bob, carol, dave, ...extra];
    const rankings = calculateRoyaleRankings(players, buildInitialLadder(players), []);

    expect(rankings.find((r) => r.player.id === 'i')?.adjustedSeed).toBe(7 + 8);
    expect(rankings.find((r) => r.player.id === 'j')?.adjustedSeed).toBe(8 + 8);
  });
});
