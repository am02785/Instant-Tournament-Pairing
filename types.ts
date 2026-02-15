export type Player = {
  id: string;
  name: string;
  officeDays: string[];
  seed?: number;
};

export type Match = {
  id?: string;
  player1: Player;
  player2?: Player;
  player1Points?: number;
  player2Points?: number;
  winnerId?: string;
  round: number;
  complete?: boolean;
  stage: 'group' | 'knockout'; // Added stage identifier
  groupId?: string; // For group stage matches
  futureMatchId?: string | null; // ID of the match this winner advances to (null for group stage or final)
  // Knockout first round: which group/place each player came from (for display)
  player1GroupId?: string;
  player2GroupId?: string;
  player1GroupPlace?: 1 | 2;
  player2GroupPlace?: 1 | 2;
};

export type Bracket = Match[];

export type Tournament = {
  id?: string;
  name: string;
  createdBy: string;
  players: Player[];
  bracket: Bracket;
  complete?: boolean;
  createdAt?: any; // For Firestore timestamp
  finalRankings?: { player: Player; rank: number; points: number }[];
};