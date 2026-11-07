import type { Player, Team } from '@/types';

export function isGoalkeeper(position: string): boolean {
  return ['حارس مرمى', 'حارس', 'goalkeeper', 'gk'].includes(position.trim().toLowerCase());
}

/** Goalkeeper training is additional to the player's registered age category. */
export function categoryPlayers(team: Team, players: Player[]): Player[] {
  return team.categoryKind === 'goalkeeper'
    ? players.filter(player => isGoalkeeper(player.position))
    : players.filter(player => player.teamId === team.id);
}

export function canAssignCategory(team: Team, currentTeamId?: string): boolean {
  return team.categoryKind !== 'goalkeeper' && (team.status !== 'inactive' || team.id === currentTeamId);
}
