import type { Attendance } from '@/types';

type Entry = Omit<Attendance, 'id'>;

/** Linked sessions are unique per player even if a stale client has another date. */
export function attendanceKey(row: Entry): string {
  const sessionId = row.sessionType === 'match' ? row.matchId : row.trainingId;
  return JSON.stringify([row.playerId, row.sessionType, sessionId ? 'linked' : 'date', sessionId || row.sessionDate]);
}

export function assertNewAttendance(existing: Attendance[], incoming: Entry[], ar = false): void {
  const keys = new Set(existing.map(attendanceKey));
  for (const row of incoming) {
    const key = attendanceKey(row);
    if (keys.has(key)) {
      throw new Error(ar
        ? 'حضور هذا اللاعب مسجل لهذه الجلسة بالفعل. راجع السجل الموجود.'
        : 'Attendance already recorded for this player and session. Review the existing record.');
    }
    keys.add(key);
  }
}
