import type { PlayerQuizProgress, PublicQuestionDatabase, QuestionDatabase } from './questionTypes';

export interface ExplorationObjectiveDef {
  id: string;
  title: string;
  description: string;
  kind:
    | 'solve_subject'
    | 'discover_buildings'
    | 'solve_upper_floor'
    | 'explore_building'
    | 'solve_floor';
  subjectName?: string;
  buildingId?: string;
  minFloor?: number;
  targetFloor?: number;
  targetCount: number;
  rewardPoints: number;
}

export interface ExplorationTrackerState {
  visitedBuildingIds: string[];
  highestFloorVisited: number;
}

export interface ExplorationObjectiveStatus {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  completed: boolean;
  rewardPoints: number;
}

export const DEFAULT_EXPLORATION_OBJECTIVES: ExplorationObjectiveDef[] = [
  {
    id: 'obj_math_5',
    title: 'Mathematics Explorer',
    description: 'Find & solve 5 Mathematics questions across the city.',
    kind: 'solve_subject',
    subjectName: 'Mathematics',
    targetCount: 5,
    rewardPoints: 100,
  },
  {
    id: 'obj_sci_3',
    title: 'Science Investigator',
    description: 'Find & solve 3 Science questions hidden indoors.',
    kind: 'solve_subject',
    subjectName: 'Science',
    targetCount: 3,
    rewardPoints: 80,
  },
  {
    id: 'obj_buildings_2',
    title: 'City Interior Explorer',
    description: 'Discover and enter 2 different buildings.',
    kind: 'discover_buildings',
    targetCount: 2,
    rewardPoints: 50,
  },
  {
    id: 'obj_upper_floor',
    title: 'Upper Floor Scholar',
    description: 'Solve a hidden question on an upper floor (Floor 2+).',
    kind: 'solve_upper_floor',
    minFloor: 2,
    targetCount: 1,
    rewardPoints: 60,
  },
  {
    id: 'obj_city_tower',
    title: 'CITY TOWER Ascent',
    description: 'Enter CITY TOWER and explore its floors.',
    kind: 'explore_building',
    buildingId: 'freedom_tower',
    targetCount: 1,
    rewardPoints: 75,
  },
  {
    id: 'obj_rooftop',
    title: 'Skyline Rooftop Quest',
    description: 'Reach CITY TOWER Rooftop (Floor 22) and solve its hidden challenge.',
    kind: 'solve_floor',
    targetFloor: 22,
    targetCount: 1,
    rewardPoints: 150,
  },
];

export function createInitialExplorationTracker(): ExplorationTrackerState {
  return {
    visitedBuildingIds: [],
    highestFloorVisited: 1,
  };
}

export function recordVisitedBuilding(
  tracker: ExplorationTrackerState,
  buildingId: string,
  floor = 1,
): boolean {
  let changed = false;
  if (buildingId && !tracker.visitedBuildingIds.includes(buildingId)) {
    tracker.visitedBuildingIds.push(buildingId);
    changed = true;
  }
  if (floor > tracker.highestFloorVisited) {
    tracker.highestFloorVisited = floor;
    changed = true;
  }
  return changed;
}

export function evaluateExplorationObjectives(
  db: Pick<QuestionDatabase | PublicQuestionDatabase, 'questions'> & {
    explorationObjectives?: ExplorationObjectiveDef[];
  },
  progress: PlayerQuizProgress,
  tracker: ExplorationTrackerState,
): ExplorationObjectiveStatus[] {
  const defs =
    db.explorationObjectives && db.explorationObjectives.length > 0
      ? db.explorationObjectives
      : DEFAULT_EXPLORATION_OBJECTIVES;

  const completedSet = new Set(progress.completedQuestionIds);
  const completedQuestions = db.questions.filter((q) => completedSet.has(q.id));

  return defs.map((def) => {
    let current = 0;
    if (def.kind === 'solve_subject' && def.subjectName) {
      const targetLower = def.subjectName.trim().toLowerCase();
      current = completedQuestions.filter(
        (q) => q.subjectName.trim().toLowerCase() === targetLower,
      ).length;
    } else if (def.kind === 'discover_buildings') {
      current = tracker.visitedBuildingIds.length;
    } else if (def.kind === 'solve_upper_floor') {
      const minFloor = def.minFloor ?? 2;
      current = completedQuestions.filter(
        (q) => q.floorPlacement !== null && q.floorPlacement >= minFloor,
      ).length;
    } else if (def.kind === 'explore_building' && def.buildingId) {
      current = tracker.visitedBuildingIds.includes(def.buildingId) ? 1 : 0;
    } else if (def.kind === 'solve_floor' && def.targetFloor !== undefined) {
      current = completedQuestions.filter(
        (q) => q.floorPlacement === def.targetFloor,
      ).length;
    }

    const capped = Math.min(def.targetCount, current);
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      current: capped,
      target: def.targetCount,
      completed: current >= def.targetCount,
      rewardPoints: def.rewardPoints,
    };
  });
}
