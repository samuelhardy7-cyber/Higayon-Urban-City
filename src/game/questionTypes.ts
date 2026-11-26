import type { BuildingCategory } from './types';

export type QuestionType = 'multiple_choice' | 'true_false';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard' | 'special';

export type AnswerKey = 'A' | 'B' | 'C' | 'D';

export type PlacementCategory = BuildingCategory | 'any';

export type PlacementScope = 'both' | 'indoor' | 'outdoor';

export type FloorPlacement = number | null;

export type CollectibleVisualStyle = 'terminal' | 'book' | 'tablet' | 'card' | 'crystal' | 'artifact';

export interface SubjectDefinition {
  id: string;
  name: string;
  color: string;
  topics: string[];
}

export interface QuestionSet {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: number;
}

export interface QuestionRecord {
  id: string;
  subjectId: string;
  subjectName: string;
  topic: string;
  type: QuestionType;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: AnswerKey;
  explanation: string;
  difficulty: QuestionDifficulty;
  points: number;
  buildingCategory: PlacementCategory;
  floorPlacement: FloorPlacement;
  placementScope?: PlacementScope;
  targetBuildingId?: string | null;
  questionSetId: string;
  status?: 'active' | 'inactive';
  createdAt: number;
  updatedAt: number;
}

export type PublicQuestionRecord = Omit<QuestionRecord, 'correctAnswer' | 'explanation'>;

export type ChallengeModeKind =
  | 'none'
  | 'knowledge_race'
  | 'team_exploration'
  | 'city_tower_challenge'
  | 'subject_challenge';

export interface KpDifficultyRewards {
  easy: number;
  medium: number;
  hard: number;
  special: number;
}

export interface ShopItemOverride {
  priceKp?: number;
  enabled?: boolean;
}

export interface SocialModerationConfig {
  chatEnabled: boolean;
  groupsEnabled: boolean;
  emoteWheelEnabled: boolean;
  leaderboardVisible: boolean;
  groupMinimapMarkers: boolean;
}

export interface ChallengeModeSettings {
  mode: ChallengeModeKind;
  title: string;
  durationMinutes: number;
  targetQuestions: number;
  subjectFilter: string;
}

export interface TeacherConfig {
  allowRetryOnWrong: boolean;
  awardCityCashBonus: boolean;
  cashPerPoint: number;
  showExplanationOnWrong: boolean;
  useDifficultyKpTable?: boolean;
  kpRewards?: KpDifficultyRewards;
  shopItemOverrides?: Record<string, ShopItemOverride>;
  socialConfig?: SocialModerationConfig;
  challengeConfig?: ChallengeModeSettings;
}

export interface QuestionDatabase {
  version: 1;
  subjects: SubjectDefinition[];
  questionSets: QuestionSet[];
  questions: QuestionRecord[];
  teacherConfig: TeacherConfig;
  explorationObjectives?: Array<{
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
  }>;
}

export interface PublicQuestionDatabase {
  version: 1;
  subjects: SubjectDefinition[];
  questionSets: QuestionSet[];
  questions: PublicQuestionRecord[];
  teacherConfig: TeacherConfig;
  explorationObjectives?: QuestionDatabase['explorationObjectives'];
}

export interface PlayerAnswerAttempt {
  questionId: string;
  selectedAnswer: AnswerKey;
  isCorrect: boolean;
  pointsAwarded: number;
  attemptedAt: number;
}

export interface PlayerQuizProgress {
  completedQuestionIds: string[];
  lockedQuestionIds: string[];
  earnedPoints: number;
  history: PlayerAnswerAttempt[];
}

/**
 * Sanitized player-facing challenge DTO.
 * Strictly omits `correctAnswer` and `explanation` before submission.
 */
export interface PlayerQuestionChallenge {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  topic: string;
  type: QuestionType;
  questionText: string;
  options: Array<{ key: AnswerKey; text: string }>;
  difficulty: QuestionDifficulty;
  points: number;
  buildingCategory: PlacementCategory;
  floorPlacement: FloorPlacement;
  placementScope?: PlacementScope;
  targetBuildingId?: string | null;
  questionSetName: string;
  allowRetry: boolean;
  alreadyCompleted: boolean;
}

export interface PlayerSubmissionOutcome {
  isCorrect: boolean;
  pointsAwarded: number;
  cashBonusAwarded: number;
  allowRetry: boolean;
  locked: boolean;
  alreadyCompleted: boolean;
  explanation: string | null;
}

export interface QuestionDraftInput {
  id: string;
  subjectId: string;
  subjectName?: string;
  topic: string;
  type: QuestionType;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: AnswerKey | '';
  explanation: string;
  difficulty: QuestionDifficulty;
  points: number;
  buildingCategory: PlacementCategory;
  floorPlacement: FloorPlacement;
  placementScope?: PlacementScope;
  targetBuildingId?: string | null;
  questionSetId: string;
  status?: 'active' | 'inactive';
}

export interface QuestionValidationResult {
  valid: boolean;
  errors: string[];
  fieldErrors: Record<string, string>;
}

export interface BulkImportRowError {
  rowNumber: number;
  questionId: string;
  messages: string[];
}

export interface BulkImportPreviewResult {
  format: 'csv' | 'json';
  totalRows: number;
  validRows: QuestionDraftInput[];
  errors: BulkImportRowError[];
}

export interface QuizKioskPlacement {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  buildingCategory: PlacementCategory;
  floorNumber: number | null;
  questionIds: string[];
  nextQuestionId: string | null;
  nextSubjectColor: string;
  nextSubjectName: string;
  remainingCount: number;
  allCompleted: boolean;
  visualStyle?: CollectibleVisualStyle;
}
