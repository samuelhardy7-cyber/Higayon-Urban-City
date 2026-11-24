import type { ChallengeModeSettings } from './questionTypes';
import type {
  ChallengeLeaderboardEntry,
  ChallengeSessionState,
  RemotePlayerState,
  SocialGroupSnapshot,
  TeamScoreEntry,
} from './multiplayerTypes';

export const DEFAULT_CHALLENGE_SETTINGS: ChallengeModeSettings = {
  mode: 'knowledge_race',
  title: 'City Knowledge Challenge',
  durationMinutes: 20,
  targetQuestions: 5,
  subjectFilter: 'All Subjects',
};

export interface PlayerChallengeMetrics {
  playerId: string;
  displayName: string;
  kpEarned: number;
  questionsCompleted: number;
  buildingsVisited: number;
  towerMaxFloor: number;
}

export function buildChallengeSessionState(
  settings: ChallengeModeSettings | null | undefined,
  players: RemotePlayerState[],
  groups: SocialGroupSnapshot[],
  metricsByUid: Record<string, Partial<PlayerChallengeMetrics>>,
  timeRemainingSeconds: number,
): ChallengeSessionState {
  const cfg = settings || DEFAULT_CHALLENGE_SETTINGS;
  const groupByMember = new Map<string, SocialGroupSnapshot>();
  for (const g of groups) {
    for (const m of g.memberPlayerIds) {
      groupByMember.set(m, g);
    }
  }

  const rawEntries: ChallengeLeaderboardEntry[] = players.map((p) => {
    const m = metricsByUid[p.playerId];
    const grp = groupByMember.get(p.playerId) || null;
    const kpEarned = Math.max(0, m?.kpEarned ?? p.pointsEarned ?? 0);
    const questionsCompleted = Math.max(0, m?.questionsCompleted ?? p.questionsCompleted ?? 0);
    const buildingsVisited = Math.max(0, m?.buildingsVisited ?? 0);
    const towerMaxFloor = Math.max(1, m?.towerMaxFloor ?? p.currentFloor ?? 1);

    let completed = false;
    if (cfg.mode === 'city_tower_challenge') {
      completed = towerMaxFloor >= 22 && questionsCompleted >= Math.min(3, cfg.targetQuestions);
    } else if (cfg.targetQuestions > 0) {
      completed = questionsCompleted >= cfg.targetQuestions;
    }

    return {
      playerId: p.playerId,
      displayName: p.displayName,
      groupId: grp?.id || p.groupId || null,
      groupName: grp?.name || p.groupName || null,
      kpEarned,
      questionsCompleted,
      buildingsVisited,
      towerMaxFloor,
      completionStatus: completed ? 'completed' : 'in_progress',
      rank: 0,
    };
  });

  rawEntries.sort((a, b) => {
    if (cfg.mode === 'city_tower_challenge' && b.towerMaxFloor !== a.towerMaxFloor) {
      return b.towerMaxFloor - a.towerMaxFloor;
    }
    if (b.kpEarned !== a.kpEarned) return b.kpEarned - a.kpEarned;
    if (b.questionsCompleted !== a.questionsCompleted) {
      return b.questionsCompleted - a.questionsCompleted;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  const leaderboard = rawEntries.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));

  const teamMap = new Map<string, TeamScoreEntry>();
  for (const entry of leaderboard) {
    if (!entry.groupId || !entry.groupName) continue;
    const existing = teamMap.get(entry.groupId);
    if (!existing) {
      teamMap.set(entry.groupId, {
        groupId: entry.groupId,
        groupName: entry.groupName,
        memberCount: 1,
        totalKp: entry.kpEarned,
        totalQuestions: entry.questionsCompleted,
        rank: 0,
      });
    } else {
      existing.memberCount += 1;
      existing.totalKp += entry.kpEarned;
      existing.totalQuestions += entry.questionsCompleted;
    }
  }

  const teamScores = [...teamMap.values()]
    .sort((a, b) => b.totalKp - a.totalKp || b.totalQuestions - a.totalQuestions)
    .map((t, idx) => ({ ...t, rank: idx + 1 }));

  return {
    mode: cfg.mode,
    title: cfg.title || 'City Knowledge Challenge',
    subjectFilter: cfg.subjectFilter || 'All Subjects',
    targetQuestions: cfg.targetQuestions,
    timeRemainingSeconds: Math.max(0, Math.round(timeRemainingSeconds)),
    leaderboard,
    teamScores,
  };
}
