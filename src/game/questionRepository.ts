import {
  createDefaultTeacherConfig,
  createInitialPlayerQuizProgress,
  createSeedQuestionDatabase,
} from './questionBank';
import type {
  AnswerKey,
  FloorPlacement,
  PlacementCategory,
  PlayerAnswerAttempt,
  PlayerQuizProgress,
  QuestionDatabase,
  QuestionDifficulty,
  QuestionRecord,
  QuestionSet,
  QuestionType,
  SubjectDefinition,
} from './questionTypes';
import type { StorageLike } from './saveSystem';

export const QUESTION_DB_STORAGE_KEY = 'urban_life_question_bank_v1';
export const PLAYER_QUIZ_PROGRESS_KEY = 'urban_life_player_quiz_v1';

export interface QuestionBankAdapter {
  loadDatabase: () => QuestionDatabase;
  saveDatabase: (db: QuestionDatabase) => boolean;
  loadPlayerProgress: () => PlayerQuizProgress;
  savePlayerProgress: (progress: PlayerQuizProgress) => boolean;
  resetDatabaseToSeed: () => QuestionDatabase;
  resetPlayerProgress: () => PlayerQuizProgress;
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

const VALID_ANSWERS: AnswerKey[] = ['A', 'B', 'C', 'D'];
const VALID_TYPES: QuestionType[] = ['multiple_choice', 'true_false'];
const VALID_DIFFS: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const VALID_CATS: PlacementCategory[] = ['residential', 'commercial', 'business', 'industrial', 'any'];

function sanitizeFloor(val: unknown): FloorPlacement {
  if (typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 22) {
    return val;
  }
  return null;
}

export function parseQuestionDatabase(raw: string): QuestionDatabase | null {
  try {
    const parsed = JSON.parse(raw) as Partial<QuestionDatabase> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return null;
    }

    const seed = createSeedQuestionDatabase();
    const subjects: SubjectDefinition[] = Array.isArray(parsed.subjects)
      ? parsed.subjects
          .filter((s): s is SubjectDefinition => Boolean(s && typeof s.id === 'string' && typeof s.name === 'string'))
          .map((s) => ({
            id: s.id,
            name: s.name,
            color: typeof s.color === 'string' ? s.color : '#38bdf8',
            topics: Array.isArray(s.topics)
              ? s.topics.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
              : [],
          }))
      : seed.subjects;

    const questionSets: QuestionSet[] = Array.isArray(parsed.questionSets)
      ? parsed.questionSets
          .filter((qs): qs is QuestionSet => Boolean(qs && typeof qs.id === 'string' && typeof qs.name === 'string'))
          .map((qs) => ({
            id: qs.id,
            name: qs.name,
            description: typeof qs.description === 'string' ? qs.description : '',
            isActive: typeof qs.isActive === 'boolean' ? qs.isActive : true,
            createdAt: typeof qs.createdAt === 'number' ? qs.createdAt : Date.now(),
          }))
      : seed.questionSets;

    if (questionSets.length === 0) {
      questionSets.push(...seed.questionSets);
    }

    const questions: QuestionRecord[] = Array.isArray(parsed.questions)
      ? parsed.questions
          .filter((q): q is QuestionRecord => Boolean(q && typeof q.id === 'string' && typeof q.questionText === 'string'))
          .map((q) => {
            const type = VALID_TYPES.includes(q.type) ? q.type : 'multiple_choice';
            const correctAnswer = VALID_ANSWERS.includes(q.correctAnswer) ? q.correctAnswer : 'A';
            return {
              id: q.id,
              subjectId: typeof q.subjectId === 'string' ? q.subjectId : subjects[0]?.id || 'subj_general',
              subjectName: typeof q.subjectName === 'string' ? q.subjectName : 'General Knowledge',
              topic: typeof q.topic === 'string' ? q.topic : 'General',
              type,
              questionText: q.questionText,
              optionA: typeof q.optionA === 'string' ? q.optionA : '',
              optionB: typeof q.optionB === 'string' ? q.optionB : '',
              optionC: type === 'true_false' ? '' : typeof q.optionC === 'string' ? q.optionC : '',
              optionD: type === 'true_false' ? '' : typeof q.optionD === 'string' ? q.optionD : '',
              correctAnswer: type === 'true_false' && correctAnswer !== 'A' && correctAnswer !== 'B' ? 'A' : correctAnswer,
              explanation: typeof q.explanation === 'string' ? q.explanation : '',
              difficulty: VALID_DIFFS.includes(q.difficulty) ? q.difficulty : 'easy',
              points: typeof q.points === 'number' && Number.isFinite(q.points) ? Math.max(1, Math.round(q.points)) : 20,
              buildingCategory: VALID_CATS.includes(q.buildingCategory) ? q.buildingCategory : 'any',
              floorPlacement: sanitizeFloor(q.floorPlacement),
              questionSetId: typeof q.questionSetId === 'string' ? q.questionSetId : questionSets[0].id,
              createdAt: typeof q.createdAt === 'number' ? q.createdAt : Date.now(),
              updatedAt: typeof q.updatedAt === 'number' ? q.updatedAt : Date.now(),
            };
          })
      : seed.questions;

    const baseCfg = createDefaultTeacherConfig();
    const rawCfg = parsed.teacherConfig || baseCfg;
    const teacherConfig = {
      allowRetryOnWrong:
        typeof rawCfg.allowRetryOnWrong === 'boolean' ? rawCfg.allowRetryOnWrong : baseCfg.allowRetryOnWrong,
      awardCityCashBonus:
        typeof rawCfg.awardCityCashBonus === 'boolean' ? rawCfg.awardCityCashBonus : baseCfg.awardCityCashBonus,
      cashPerPoint:
        typeof rawCfg.cashPerPoint === 'number' && Number.isFinite(rawCfg.cashPerPoint)
          ? Math.max(0, Math.min(20, rawCfg.cashPerPoint))
          : baseCfg.cashPerPoint,
      showExplanationOnWrong:
        typeof rawCfg.showExplanationOnWrong === 'boolean'
          ? rawCfg.showExplanationOnWrong
          : baseCfg.showExplanationOnWrong,
    };

    return {
      version: 1,
      subjects,
      questionSets,
      questions,
      teacherConfig,
      explorationObjectives: Array.isArray(parsed.explorationObjectives)
        ? parsed.explorationObjectives
        : seed.explorationObjectives,
    };
  } catch {
    return null;
  }
}

export function sanitizePlayerQuizProgress(raw: unknown): PlayerQuizProgress {
  const base = createInitialPlayerQuizProgress();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<PlayerQuizProgress>;
  const completedQuestionIds = Array.isArray(obj.completedQuestionIds)
    ? [...new Set(obj.completedQuestionIds.filter((id): id is string => typeof id === 'string'))]
    : [];
  const lockedQuestionIds = Array.isArray(obj.lockedQuestionIds)
    ? [...new Set(obj.lockedQuestionIds.filter((id): id is string => typeof id === 'string'))]
    : [];
  const earnedPoints =
    typeof obj.earnedPoints === 'number' && Number.isFinite(obj.earnedPoints)
      ? Math.max(0, Math.round(obj.earnedPoints))
      : 0;
  const history: PlayerAnswerAttempt[] = Array.isArray(obj.history)
    ? obj.history
        .filter((h): h is PlayerAnswerAttempt => Boolean(h && typeof h.questionId === 'string'))
        .map((h) => ({
          questionId: h.questionId,
          selectedAnswer: VALID_ANSWERS.includes(h.selectedAnswer) ? h.selectedAnswer : 'A',
          isCorrect: Boolean(h.isCorrect),
          pointsAwarded:
            typeof h.pointsAwarded === 'number' && Number.isFinite(h.pointsAwarded)
              ? Math.max(0, Math.round(h.pointsAwarded))
              : 0,
          attemptedAt: typeof h.attemptedAt === 'number' ? h.attemptedAt : Date.now(),
        }))
    : [];

  return {
    completedQuestionIds,
    lockedQuestionIds,
    earnedPoints,
    history,
  };
}

export function createLocalQuestionRepository(
  storage: StorageLike | null = getDefaultStorage(),
): QuestionBankAdapter {
  return {
    loadDatabase: () => {
      if (!storage) return createSeedQuestionDatabase();
      const raw = storage.getItem(QUESTION_DB_STORAGE_KEY);
      if (!raw) {
        const seed = createSeedQuestionDatabase();
        try {
          storage.setItem(QUESTION_DB_STORAGE_KEY, JSON.stringify(seed));
        } catch {
          // ignore storage quota failures
        }
        return seed;
      }
      return parseQuestionDatabase(raw) || createSeedQuestionDatabase();
    },

    saveDatabase: (db: QuestionDatabase) => {
      if (!storage) return false;
      try {
        storage.setItem(QUESTION_DB_STORAGE_KEY, JSON.stringify(db));
        return true;
      } catch {
        return false;
      }
    },

    loadPlayerProgress: () => {
      if (!storage) return createInitialPlayerQuizProgress();
      try {
        const raw = storage.getItem(PLAYER_QUIZ_PROGRESS_KEY);
        if (!raw) return createInitialPlayerQuizProgress();
        return sanitizePlayerQuizProgress(JSON.parse(raw));
      } catch {
        return createInitialPlayerQuizProgress();
      }
    },

    savePlayerProgress: (progress: PlayerQuizProgress) => {
      if (!storage) return false;
      try {
        storage.setItem(PLAYER_QUIZ_PROGRESS_KEY, JSON.stringify(progress));
        return true;
      } catch {
        return false;
      }
    },

    resetDatabaseToSeed: () => {
      const seed = createSeedQuestionDatabase();
      if (storage) {
        try {
          storage.setItem(QUESTION_DB_STORAGE_KEY, JSON.stringify(seed));
        } catch {
          // ignore
        }
      }
      return seed;
    },

    resetPlayerProgress: () => {
      const clean = createInitialPlayerQuizProgress();
      if (storage) {
        try {
          storage.setItem(PLAYER_QUIZ_PROGRESS_KEY, JSON.stringify(clean));
        } catch {
          // ignore
        }
      }
      return clean;
    },
  };
}
