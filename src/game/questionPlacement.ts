import type {
  CollectibleVisualStyle,
  PlacementCategory,
  PlayerQuizProgress,
  PublicQuestionDatabase,
  PublicQuestionRecord,
  QuestionDatabase,
  QuestionRecord,
  QuizKioskPlacement,
} from './questionTypes';
import type { BuildingCategory, BuildingEntranceSpec, CityLayout, InteriorBlueprint } from './types';
import { getGroundHeightAt } from './worldData';

export type AnyQuestionDatabase = QuestionDatabase | PublicQuestionDatabase;
export type AnyQuestionRecord = QuestionRecord | PublicQuestionRecord;

export function getActiveQuestions(db: AnyQuestionDatabase): AnyQuestionRecord[] {
  const activeSetIds = new Set(db.questionSets.filter((s) => s.isActive).map((s) => s.id));
  return db.questions.filter(
    (q) => q.status !== 'inactive' && activeSetIds.has(q.questionSetId),
  );
}

function getSubjectColor(db: AnyQuestionDatabase, q: AnyQuestionRecord | undefined): string {
  if (!q) return '#38bdf8';
  const subj = db.subjects.find(
    (s) => s.id === q.subjectId || s.name.toLowerCase() === q.subjectName.toLowerCase(),
  );
  return subj?.color || '#38bdf8';
}

function pickNextUnanswered(
  questions: AnyQuestionRecord[],
  progress: PlayerQuizProgress,
): { next: AnyQuestionRecord | null; remainingCount: number; allCompleted: boolean } {
  if (questions.length === 0) {
    return { next: null, remainingCount: 0, allCompleted: false };
  }
  const completed = new Set(progress.completedQuestionIds);
  const locked = new Set(progress.lockedQuestionIds);
  const available = questions.filter((q) => !completed.has(q.id) && !locked.has(q.id));
  if (available.length > 0) {
    return {
      next: available[0],
      remainingCount: available.length,
      allCompleted: false,
    };
  }
  return {
    next: questions[0],
    remainingCount: 0,
    allCompleted: questions.every((q) => completed.has(q.id)),
  };
}

export function getQuestionsForPlacement(
  db: AnyQuestionDatabase,
  category: BuildingCategory,
  floorNumber?: number | null,
): AnyQuestionRecord[] {
  const active = getActiveQuestions(db);
  return active.filter((q) => {
    const catMatch = q.buildingCategory === category || q.buildingCategory === 'any';
    if (!catMatch) return false;
    if (floorNumber === undefined || floorNumber === null) return true;
    return q.floorPlacement === null || q.floorPlacement === floorNumber;
  });
}

interface OutdoorKioskAnchor {
  id: string;
  label: string;
  x: number;
  z: number;
  rotY: number;
  category: PlacementCategory;
}

const OUTDOOR_KIOSK_ANCHORS: OutdoorKioskAnchor[] = [
  {
    id: 'kiosk_avenue_hub',
    label: 'City Avenue Knowledge Hub',
    x: -6.8,
    z: 16.0,
    rotY: Math.PI * 0.5,
    category: 'any',
  },
  {
    id: 'kiosk_commercial_mart',
    label: 'Urban Mart Study Terminal',
    x: 9.2,
    z: 11.1,
    rotY: -Math.PI * 0.4,
    category: 'commercial',
  },
  {
    id: 'kiosk_business_tower',
    label: 'CITY TOWER Study Terminal',
    x: -16.8,
    z: -16.4,
    rotY: 0.2,
    category: 'business',
  },
  {
    id: 'kiosk_residential_park',
    label: 'Residential Study Terminal',
    x: -19.2,
    z: 25.4,
    rotY: 0.35,
    category: 'residential',
  },
  {
    id: 'kiosk_industrial_port',
    label: 'Industrial Zone Study Terminal',
    x: 16.5,
    z: -15.2,
    rotY: -0.3,
    category: 'industrial',
  },
];

export function createOutdoorKioskPlacements(
  db: AnyQuestionDatabase,
  progress: PlayerQuizProgress,
  layout: CityLayout,
): QuizKioskPlacement[] {
  const active = getActiveQuestions(db);
  if (active.length === 0) return [];

  const placements: QuizKioskPlacement[] = [];
  for (const anchor of OUTDOOR_KIOSK_ANCHORS) {
    const matched =
      anchor.category === 'any'
        ? active
        : active.filter(
            (q) => q.buildingCategory === anchor.category || q.buildingCategory === 'any',
          );
    if (matched.length === 0) continue;

    const picked = pickNextUnanswered(matched, progress);
    const nextQ = picked.next;
    placements.push({
      id: anchor.id,
      label: anchor.label,
      x: anchor.x,
      y: getGroundHeightAt(anchor.x, anchor.z, layout),
      z: anchor.z,
      rotY: anchor.rotY,
      buildingCategory: anchor.category,
      floorNumber: null,
      questionIds: matched.map((q) => q.id),
      nextQuestionId: nextQ?.id || null,
      nextSubjectColor: getSubjectColor(db, nextQ || undefined),
      nextSubjectName: nextQ?.subjectName || 'Study Quiz',
      remainingCount: picked.remainingCount,
      allCompleted: picked.allCompleted,
    });
  }

  return placements;
}

function isInteriorPointWalkable(
  x: number,
  y: number,
  z: number,
  blueprint: InteriorBlueprint,
): boolean {
  const r = 0.65;
  if (
    x < blueprint.bounds.minX + 1.0 ||
    x > blueprint.bounds.maxX - 1.0 ||
    z < blueprint.bounds.minZ + 1.0 ||
    z > blueprint.bounds.maxZ - 1.0
  ) {
    return false;
  }

  const onSlab = blueprint.floorSlabs.some(
    (s) =>
      Math.abs(s.y - y) < 0.2 &&
      x >= s.minX + r &&
      x <= s.maxX - r &&
      z >= s.minZ + r &&
      z <= s.maxZ - r,
  );
  if (!onSlab) return false;

  // Avoid blocking spawn or exit door
  if (Math.hypot(x - blueprint.spawn.x, z - blueprint.spawn.z) < 1.8 && Math.abs(y - blueprint.spawn.y) < 0.3) {
    return false;
  }

  // Avoid walls
  for (const w of blueprint.walls) {
    if (w.maxY <= y + 0.1 || w.minY >= y + 2.0) continue;
    if (
      x >= w.minX - r &&
      x <= w.maxX + r &&
      z >= w.minZ - r &&
      z <= w.maxZ + r
    ) {
      return false;
    }
  }

  // Avoid furniture
  for (const f of blueprint.furniture) {
    if (Math.abs(f.y - y) > 1.2) continue;
    const rot90 = Math.abs(Math.sin(f.rotY)) > 0.7;
    const hw = (rot90 ? f.depth : f.width) * 0.5 + r;
    const hd = (rot90 ? f.width : f.depth) * 0.5 + r;
    if (x >= f.x - hw && x <= f.x + hw && z >= f.z - hd && z <= f.z + hd) {
      return false;
    }
  }

  // Avoid staircases
  for (const st of blueprint.staircases) {
    if (y >= st.yStart - 0.5 && y <= st.yEnd + 0.5) {
      if (x >= st.minX - r && x <= st.maxX + r && z >= st.minZ - r && z <= st.maxZ + r) {
        return false;
      }
    }
  }

  // Avoid elevators
  for (const el of blueprint.elevators) {
    if (Math.hypot(x - el.x, z - el.z) < 2.2) {
      return false;
    }
  }

  return true;
}

const COLLECTIBLE_STYLES: CollectibleVisualStyle[] = [
  'book',
  'tablet',
  'card',
  'crystal',
  'artifact',
];

function pickCollectibleStyle(
  buildingId: string,
  floorNum: number,
  index: number,
): CollectibleVisualStyle {
  if (index === 0 && floorNum === 1) return 'terminal';
  const hash =
    buildingId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) +
    floorNum * 7 +
    index * 3;
  return COLLECTIBLE_STYLES[hash % COLLECTIBLE_STYLES.length];
}

function getCollectibleDisplayTitle(style: CollectibleVisualStyle): string {
  switch (style) {
    case 'book':
      return 'Study Textbook';
    case 'tablet':
      return 'Learning Tablet';
    case 'card':
      return 'Knowledge Card';
    case 'crystal':
      return 'Knowledge Orb';
    case 'artifact':
      return 'Academic Artifact';
    default:
      return 'Study Terminal';
  }
}

export function createInteriorKioskPlacements(
  blueprint: InteriorBlueprint,
  entrance: BuildingEntranceSpec,
  db: AnyQuestionDatabase,
  progress: PlayerQuizProgress,
): QuizKioskPlacement[] {
  const placements: QuizKioskPlacement[] = [];
  const active = getActiveQuestions(db);
  if (active.length === 0) return placements;

  const floorNumbers = [...new Set(blueprint.floorSlabs.map((s) => s.floorNumber))].sort(
    (a, b) => a - b,
  );

  for (const floorNum of floorNumbers) {
    const exactQuestions = active.filter((q) => {
      const catMatch = q.buildingCategory === entrance.category;
      const floorMatch =
        q.floorPlacement === floorNum || (q.floorPlacement === null && floorNum === 1);
      return catMatch && floorMatch;
    });

    const fallbackAnyCat =
      exactQuestions.length > 0
        ? exactQuestions
        : active.filter(
            (q) =>
              q.buildingCategory === 'any' &&
              (q.floorPlacement === floorNum || (q.floorPlacement === null && floorNum === 1)),
          );

    if (fallbackAnyCat.length === 0) continue;

    const slab = blueprint.floorSlabs.find((s) => s.floorNumber === floorNum);
    if (!slab) continue;

    // Candidate clear spots around floor slab & near furniture edges
    const floorFurniture = blueprint.furniture.filter((f) => Math.abs(f.y - slab.y) < 0.8);
    const furnitureAnchors: Array<[number, number]> = floorFurniture
      .filter((f) => f.kind === 'desk' || f.kind === 'dining_table' || f.kind === 'conference_table' || f.kind === 'shelf_rack' || f.kind === 'workbench' || f.kind === 'coffee_table')
      .map((f) => [f.x + (f.x > 0 ? -1.15 : 1.15), f.z + (f.z > 0 ? -0.95 : 0.95)] as [number, number]);

    const candidates: Array<[number, number]> = [
      ...furnitureAnchors,
      [slab.minX + 1.5, slab.maxZ - 1.6],
      [slab.maxX - 1.5, slab.maxZ - 1.6],
      [slab.minX + 1.5, slab.minZ + 1.6],
      [(slab.minX + slab.maxX) * 0.5, (slab.minZ + slab.maxZ) * 0.5],
      [slab.minX + 1.9, (slab.minZ + slab.maxZ) * 0.5],
      [slab.maxX - 1.9, (slab.minZ + slab.maxZ) * 0.5],
    ];

    const usedSpots: Array<[number, number]> = [];
    const findClearSpot = (): [number, number] | null => {
      for (const [cx, cz] of candidates) {
        if (
          usedSpots.every(([ux, uz]) => Math.hypot(cx - ux, cz - uz) >= 2.1) &&
          isInteriorPointWalkable(cx, slab.y, cz, blueprint)
        ) {
          usedSpots.push([cx, cz]);
          return [cx, cz];
        }
      }
      for (let gx = slab.minX + 1.3; gx <= slab.maxX - 1.3; gx += 1.15) {
        for (let gz = slab.minZ + 1.3; gz <= slab.maxZ - 1.3; gz += 1.15) {
          if (
            usedSpots.every(([ux, uz]) => Math.hypot(gx - ux, gz - uz) >= 2.1) &&
            isInteriorPointWalkable(gx, slab.y, gz, blueprint)
          ) {
            usedSpots.push([gx, gz]);
            return [gx, gz];
          }
        }
      }
      return null;
    };

    // Place a primary study item + up to 2 hidden educational collectibles per floor when floor has multiple questions
    const maxItemsOnFloor = Math.min(2, fallbackAnyCat.length);
    for (let itemIdx = 0; itemIdx < maxItemsOnFloor; itemIdx++) {
      const spot = findClearSpot();
      if (!spot) break;

      const slice =
        maxItemsOnFloor === 1
          ? fallbackAnyCat
          : fallbackAnyCat.filter((_, qi) => qi % maxItemsOnFloor === itemIdx);
      const bucket = slice.length > 0 ? slice : fallbackAnyCat;

      const picked = pickNextUnanswered(bucket, progress);
      const nextQ = picked.next;
      const visualStyle = pickCollectibleStyle(blueprint.buildingId, floorNum, itemIdx);
      const styleLabel = getCollectibleDisplayTitle(visualStyle);
      const floorLabel = floorNum === 22 ? 'Rooftop' : `Floor ${floorNum}`;

      placements.push({
        id: `int_kiosk_${blueprint.buildingId}_f${floorNum}_${itemIdx}`,
        label: `${entrance.name} · ${floorLabel} ${styleLabel}`,
        x: spot[0],
        y: slab.y,
        z: spot[1],
        rotY: itemIdx * 0.65,
        buildingCategory: entrance.category,
        floorNumber: floorNum,
        questionIds: bucket.map((q) => q.id),
        nextQuestionId: nextQ?.id || null,
        nextSubjectColor: getSubjectColor(db, nextQ || undefined),
        nextSubjectName: nextQ?.subjectName || 'Study Quiz',
        remainingCount: picked.remainingCount,
        allCompleted: picked.allCompleted,
        visualStyle,
      });
    }
  }

  return placements;
}

export function findNearestQuizKiosk(
  x: number,
  y: number,
  z: number,
  kiosks: QuizKioskPlacement[],
  maxDist = 2.65,
): QuizKioskPlacement | null {
  let best: QuizKioskPlacement | null = null;
  let bestDist = maxDist;
  for (let i = 0; i < kiosks.length; i++) {
    const k = kiosks[i];
    if (Math.abs(y - k.y) > 1.8) continue;
    const d = Math.hypot(x - k.x, z - k.z);
    if (d <= bestDist) {
      bestDist = d;
      best = k;
    }
  }
  return best;
}
