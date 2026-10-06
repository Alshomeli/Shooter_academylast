import type { Staff, Team, Player, Parent, Subscription, Attendance, Match, Training, Transaction, Tournament } from '@/types';
import type { UploadedFile } from '@/lib/uploads';

export interface AIContext {
  revenue: number;
  expenses: number;
  net: number;
  currency: string;
  activePlayers: number;
  inactivePlayers: number;
  paidSubs: Subscription[];
  unpaidSubs: Subscription[];
  paidAmount: number;
  unpaidAmount: number;
  completedMatches: Match[];
  wins: number;
  draws: number;
  losses: number;
  scheduled: Match[];
  winRate: number;
  goalsScored: number;
  goalsConceded: number;
  positionCounts: Record<string, number>;
  totalSessions: number;
  staffCount: number;
  teamsCount: number;
  players: Player[];
  teams: Team[];
  staff: Staff[];
  matches: Match[];
  trainings: Training[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  tournaments: Tournament[];
  parents: Parent[];
  attendance: Attendance[];
  documents: UploadedFile[];
}
