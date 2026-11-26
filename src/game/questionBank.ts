import { DEFAULT_CHALLENGE_SETTINGS } from './challengeSystem';
import { DEFAULT_EXPLORATION_OBJECTIVES } from './explorationObjectives';
import { DEFAULT_KP_DIFFICULTY_REWARDS, resolveQuestionKpReward } from './rewardShopCatalog';
import { DEFAULT_SOCIAL_CONFIG } from './socialSystem';
import type {
  AnswerKey,
  BulkImportPreviewResult,
  BulkImportRowError,
  FloorPlacement,
  PlacementCategory,
  PlayerQuestionChallenge,
  PlayerQuizProgress,
  PlayerSubmissionOutcome,
  PublicQuestionDatabase,
  PublicQuestionRecord,
  QuestionDatabase,
  QuestionDifficulty,
  QuestionDraftInput,
  QuestionRecord,
  QuestionSet,
  QuestionType,
  QuestionValidationResult,
  SubjectDefinition,
  TeacherConfig,
} from './questionTypes';

const SUBJECT_PALETTE = [
  '#38bdf8',
  '#34d399',
  '#f59e0b',
  '#a78bfa',
  '#fb7185',
  '#2dd4bf',
  '#f97316',
  '#60a5fa',
];

export function createDefaultTeacherConfig(): TeacherConfig {
  return {
    allowRetryOnWrong: true,
    awardCityCashBonus: true,
    cashPerPoint: 1,
    showExplanationOnWrong: false,
    useDifficultyKpTable: true,
    kpRewards: { ...DEFAULT_KP_DIFFICULTY_REWARDS },
    shopItemOverrides: {},
    socialConfig: { ...DEFAULT_SOCIAL_CONFIG },
    challengeConfig: { ...DEFAULT_CHALLENGE_SETTINGS },
  };
}

export function createInitialPlayerQuizProgress(): PlayerQuizProgress {
  return {
    completedQuestionIds: [],
    lockedQuestionIds: [],
    earnedPoints: 0,
    history: [],
  };
}

export function createSeedSubjects(): SubjectDefinition[] {
  return [
    {
      id: 'subj_math',
      name: 'Mathematics',
      color: '#38bdf8',
      topics: ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Fractions'],
    },
    {
      id: 'subj_science',
      name: 'Science',
      color: '#34d399',
      topics: ['Matter', 'Energy', 'Human body', 'Environment'],
    },
    {
      id: 'subj_english',
      name: 'English',
      color: '#a78bfa',
      topics: ['Grammar', 'Vocabulary', 'Reading Comprehension'],
    },
    {
      id: 'subj_indonesian',
      name: 'Indonesian Language',
      color: '#fb7185',
      topics: ['Tata Bahasa', 'Kosakata', 'Pemahaman Bacaan'],
    },
    {
      id: 'subj_social',
      name: 'Social Studies',
      color: '#f97316',
      topics: ['Civics', 'Community', 'Geography'],
    },
    {
      id: 'subj_christian',
      name: 'Christian Education',
      color: '#f59e0b',
      topics: ['Bible knowledge', 'Christian values', 'Biblical characters'],
    },
    {
      id: 'subj_general',
      name: 'General Knowledge',
      color: '#2dd4bf',
      topics: ['Urban Safety', 'World Geography', 'Logic'],
    },
  ];
}

export function createSeedQuestionSets(): QuestionSet[] {
  const now = 1732300000000;
  return [
    {
      id: 'set_city_core',
      name: 'City Explorer Core Set',
      description: 'Balanced starter questions placed across every district and building category.',
      isActive: true,
      createdAt: now,
    },
    {
      id: 'set_values_stem',
      name: 'STEM & Character Values',
      description: 'Science, Mathematics, and Christian Education challenges for multi-floor buildings.',
      isActive: true,
      createdAt: now + 1,
    },
  ];
}

export function createSeedQuestions(): QuestionRecord[] {
  const now = 1732300000000;
  return [
    {
      id: 'MATH-101',
      subjectId: 'subj_math',
      subjectName: 'Mathematics',
      topic: 'Multiplication',
      type: 'multiple_choice',
      questionText: 'At Urban Mart, 4 boxes each hold 8 juice bottles. How many juice bottles are there in total?',
      optionA: '24',
      optionB: '32',
      optionC: '28',
      optionD: '36',
      correctAnswer: 'B',
      explanation: '4 × 8 = 32 juice bottles in total.',
      difficulty: 'easy',
      points: 20,
      buildingCategory: 'commercial',
      floorPlacement: 1,
      questionSetId: 'set_city_core',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'MATH-102',
      subjectId: 'subj_math',
      subjectName: 'Mathematics',
      topic: 'Fractions',
      type: 'multiple_choice',
      questionText: 'A warehouse shifts 3/4 of 40 crates onto delivery trucks. How many crates were loaded?',
      optionA: '25',
      optionB: '28',
      optionC: '30',
      optionD: '32',
      correctAnswer: 'C',
      explanation: '(3 / 4) × 40 = 3 × 10 = 30 crates.',
      difficulty: 'medium',
      points: 30,
      buildingCategory: 'industrial',
      floorPlacement: 2,
      questionSetId: 'set_values_stem',
      createdAt: now + 1,
      updatedAt: now + 1,
    },
    {
      id: 'SCI-101',
      subjectId: 'subj_science',
      subjectName: 'Science',
      topic: 'Energy',
      type: 'multiple_choice',
      questionText: 'Solar panels on a modern office roof convert sunlight directly into which form of energy?',
      optionA: 'Electrical energy',
      optionB: 'Nuclear energy',
      optionC: 'Sound energy',
      optionD: 'Chemical fossil energy',
      correctAnswer: 'A',
      explanation: 'Photovoltaic solar cells convert light energy into electrical energy.',
      difficulty: 'easy',
      points: 20,
      buildingCategory: 'business',
      floorPlacement: 2,
      questionSetId: 'set_values_stem',
      createdAt: now + 2,
      updatedAt: now + 2,
    },
    {
      id: 'SCI-102',
      subjectId: 'subj_science',
      subjectName: 'Science',
      topic: 'Matter',
      type: 'true_false',
      questionText: 'Water changes from a liquid state into gas (water vapor) during evaporation.',
      optionA: 'True',
      optionB: 'False',
      optionC: '',
      optionD: '',
      correctAnswer: 'A',
      explanation: 'Evaporation is the phase change where liquid water becomes water vapor at the surface.',
      difficulty: 'easy',
      points: 15,
      buildingCategory: 'residential',
      floorPlacement: 1,
      questionSetId: 'set_city_core',
      createdAt: now + 3,
      updatedAt: now + 3,
    },
    {
      id: 'ENG-101',
      subjectId: 'subj_english',
      subjectName: 'English',
      topic: 'Grammar',
      type: 'multiple_choice',
      questionText: 'Choose the grammatically correct sentence for a business reception sign:',
      optionA: 'The office open at eight every morning.',
      optionB: 'The office opens at eight every morning.',
      optionC: 'The office opening at eight every morning.',
      optionD: 'The office are open at eight every morning.',
      correctAnswer: 'B',
      explanation: '"The office" is singular third-person, so the present simple verb takes -s: "opens".',
      difficulty: 'easy',
      points: 20,
      buildingCategory: 'business',
      floorPlacement: 1,
      questionSetId: 'set_city_core',
      createdAt: now + 4,
      updatedAt: now + 4,
    },
    {
      id: 'IND-101',
      subjectId: 'subj_indonesian',
      subjectName: 'Indonesian Language',
      topic: 'Kosakata',
      type: 'multiple_choice',
      questionText: 'Dalam bahasa Indonesia, kata baku yang tepat untuk tempat pejalan kaki di tepi jalan adalah...',
      optionA: 'Trotoar',
      optionB: 'Trotoir',
      optionC: 'Trotoer',
      optionD: 'Tratoar',
      correctAnswer: 'A',
      explanation: 'Menurut KBBI, penulisan kata baku yang benar adalah "trotoar".',
      difficulty: 'medium',
      points: 25,
      buildingCategory: 'commercial',
      floorPlacement: null,
      questionSetId: 'set_city_core',
      createdAt: now + 5,
      updatedAt: now + 5,
    },
    {
      id: 'SOC-101',
      subjectId: 'subj_social',
      subjectName: 'Social Studies',
      topic: 'Civics',
      type: 'true_false',
      questionText: 'Stopping at red traffic lights and yielding at crosswalks helps protect everyone in the community.',
      optionA: 'True',
      optionB: 'False',
      optionC: '',
      optionD: '',
      correctAnswer: 'A',
      explanation: 'Traffic laws exist as civic responsibilities to keep pedestrians, cyclists, and drivers safe.',
      difficulty: 'easy',
      points: 15,
      buildingCategory: 'any',
      floorPlacement: null,
      questionSetId: 'set_city_core',
      createdAt: now + 6,
      updatedAt: now + 6,
    },
    {
      id: 'CHR-101',
      subjectId: 'subj_christian',
      subjectName: 'Christian Education',
      topic: 'Christian values',
      type: 'multiple_choice',
      questionText: 'In the Parable of the Good Samaritan, which value is highlighted through helping a stranger in need?',
      optionA: 'Seeking fame from others',
      optionB: 'Compassionate love for our neighbor',
      optionC: 'Avoiding people outside our neighborhood',
      optionD: 'Measuring rewards before helping',
      correctAnswer: 'B',
      explanation: 'Jesus taught that loving our neighbor means showing mercy and practical care to anyone in need.',
      difficulty: 'easy',
      points: 25,
      buildingCategory: 'residential',
      floorPlacement: 2,
      questionSetId: 'set_values_stem',
      createdAt: now + 7,
      updatedAt: now + 7,
    },
    {
      id: 'CHR-102',
      subjectId: 'subj_christian',
      subjectName: 'Christian Education',
      topic: 'Biblical characters',
      type: 'true_false',
      questionText: 'David played the harp and later became king of Israel after trusting God.',
      optionA: 'True',
      optionB: 'False',
      optionC: '',
      optionD: '',
      correctAnswer: 'A',
      explanation: 'David served Saul by playing the harp and later reigned as king over Israel.',
      difficulty: 'easy',
      points: 20,
      buildingCategory: 'residential',
      floorPlacement: 3,
      questionSetId: 'set_values_stem',
      createdAt: now + 8,
      updatedAt: now + 8,
    },
    {
      id: 'GEN-101',
      subjectId: 'subj_general',
      subjectName: 'General Knowledge',
      topic: 'Urban Safety',
      type: 'multiple_choice',
      questionText: 'Which safety gear should always be worn by workers inside a noisy manufacturing factory?',
      optionA: 'Sunglasses only',
      optionB: 'Hearing protection and safety helmet',
      optionC: 'Loose scarves near machinery',
      optionD: 'Flip-flops',
      correctAnswer: 'B',
      explanation: 'Personal protective equipment (PPE) such as helmets and ear protection prevents workplace injuries.',
      difficulty: 'easy',
      points: 20,
      buildingCategory: 'industrial',
      floorPlacement: 1,
      questionSetId: 'set_city_core',
      createdAt: now + 9,
      updatedAt: now + 9,
    },
    {
      id: 'MATH-103',
      subjectId: 'subj_math',
      subjectName: 'Mathematics',
      topic: 'Geometry',
      type: 'multiple_choice',
      questionText: 'A rectangular cafe table is 2.5 m long and 1.2 m wide. What is its surface area in square meters?',
      optionA: '3.0 m²',
      optionB: '3.7 m²',
      optionC: '2.8 m²',
      optionD: '4.2 m²',
      correctAnswer: 'A',
      explanation: 'Area = length × width = 2.5 × 1.2 = 3.0 m².',
      difficulty: 'easy',
      points: 20,
      buildingCategory: 'commercial',
      floorPlacement: 1,
      questionSetId: 'set_city_core',
      createdAt: now + 10,
      updatedAt: now + 10,
    },
    {
      id: 'MATH-104',
      subjectId: 'subj_math',
      subjectName: 'Mathematics',
      topic: 'Algebra',
      type: 'multiple_choice',
      questionText: 'An elevator climbs 3.6 meters per floor. How many meters high is Floor 11 above Floor 1?',
      optionA: '32.4 m',
      optionB: '36.0 m',
      optionC: '39.6 m',
      optionD: '40.0 m',
      correctAnswer: 'B',
      explanation: 'From Floor 1 to Floor 11 is 10 intervals: 10 × 3.6 m = 36.0 meters.',
      difficulty: 'medium',
      points: 35,
      buildingCategory: 'business',
      floorPlacement: 5,
      questionSetId: 'set_values_stem',
      createdAt: now + 11,
      updatedAt: now + 11,
    },
    {
      id: 'MATH-105',
      subjectId: 'subj_math',
      subjectName: 'Mathematics',
      topic: 'Percentages',
      type: 'multiple_choice',
      questionText: 'An observation lounge has 80 seats and 65% are occupied by visiting students. How many seats are taken?',
      optionA: '48',
      optionB: '50',
      optionC: '52',
      optionD: '56',
      correctAnswer: 'C',
      explanation: '0.65 × 80 = 52 occupied seats.',
      difficulty: 'medium',
      points: 30,
      buildingCategory: 'business',
      floorPlacement: 15,
      questionSetId: 'set_values_stem',
      createdAt: now + 12,
      updatedAt: now + 12,
    },
    {
      id: 'SCI-103',
      subjectId: 'subj_science',
      subjectName: 'Science',
      topic: 'Atmospheric Physics',
      type: 'multiple_choice',
      questionText: 'At the open-air Rooftop of a tall skyscraper, how does atmospheric air pressure compare with street level?',
      optionA: 'Slightly lower because less air column sits above',
      optionB: 'Twice as high due to wind speed',
      optionC: 'Exactly zero at 75 meters',
      optionD: 'Unchanged at any altitude',
      correctAnswer: 'A',
      explanation: 'Air pressure decreases gently with altitude as the weight of overlying air decreases.',
      difficulty: 'medium',
      points: 50,
      buildingCategory: 'business',
      floorPlacement: 22,
      questionSetId: 'set_values_stem',
      createdAt: now + 13,
      updatedAt: now + 13,
    },
    {
      id: 'SCI-104',
      subjectId: 'subj_science',
      subjectName: 'Science',
      topic: 'Engineering & Mechanics',
      type: 'multiple_choice',
      questionText: 'Why do modern high-speed skyscraper elevators use heavy counterweights opposite the cabin?',
      optionA: 'To balance gravity and reduce motor energy needed to lift passengers',
      optionB: 'To stop radio signals inside the shaft',
      optionC: 'To prevent doors from sliding horizontally',
      optionD: 'To warm the cables in winter',
      correctAnswer: 'A',
      explanation: 'A counterweight balances the cabin + average load weight, dramatically lowering motor work.',
      difficulty: 'medium',
      points: 35,
      buildingCategory: 'business',
      floorPlacement: 9,
      questionSetId: 'set_values_stem',
      createdAt: now + 14,
      updatedAt: now + 14,
    },
  ];
}

export function createSeedQuestionDatabase(): QuestionDatabase {
  return {
    version: 1,
    subjects: createSeedSubjects(),
    questionSets: createSeedQuestionSets(),
    questions: createSeedQuestions(),
    teacherConfig: createDefaultTeacherConfig(),
    explorationObjectives: DEFAULT_EXPLORATION_OBJECTIVES.map((o) => ({ ...o })),
  };
}

export function slugifyId(prefix: string, label: string): string {
  const clean = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
  return `${prefix}_${clean || 'item'}_${Math.random().toString(36).slice(2, 6)}`;
}

export function suggestNextQuestionId(questions: QuestionRecord[], subjectName: string): string {
  const code =
    subjectName
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 4) || 'QUES';
  let seq = questions.length + 101;
  const used = new Set(questions.map((q) => q.id.toUpperCase()));
  while (used.has(`${code}-${seq}`)) {
    seq++;
  }
  return `${code}-${seq}`;
}

export function pickSubjectColor(index: number): string {
  return SUBJECT_PALETTE[Math.abs(index) % SUBJECT_PALETTE.length];
}

export function validateQuestionInput(
  draft: QuestionDraftInput,
  existingQuestions: QuestionRecord[],
  editingOriginalId?: string | null,
): QuestionValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  const trimmedId = draft.id.trim();
  if (!trimmedId) {
    fieldErrors.id = 'Question ID is required.';
    errors.push('Question ID cannot be empty.');
  } else {
    const norm = trimmedId.toUpperCase();
    const dup = existingQuestions.some(
      (q) =>
        q.id.toUpperCase() === norm &&
        (!editingOriginalId || q.id.toUpperCase() !== editingOriginalId.toUpperCase()),
    );
    if (dup) {
      fieldErrors.id = `Duplicate Question ID "${trimmedId}".`;
      errors.push(`Question ID "${trimmedId}" already exists.`);
    }
  }

  if (!draft.subjectId.trim() && !draft.subjectName?.trim()) {
    fieldErrors.subjectId = 'Subject is required.';
    errors.push('Subject is required.');
  }

  if (!draft.topic.trim()) {
    fieldErrors.topic = 'Topic is required.';
    errors.push('Topic is required.');
  }

  if (!draft.questionText.trim()) {
    fieldErrors.questionText = 'Question text cannot be empty.';
    errors.push('Question text cannot be empty.');
  }

  const optA = draft.optionA.trim();
  const optB = draft.optionB.trim();
  const optC = draft.optionC.trim();
  const optD = draft.optionD.trim();

  if (draft.type === 'true_false') {
    if (!optA || !optB) {
      fieldErrors.options = 'True/False questions require both Option A and Option B.';
      errors.push('Answer options A and B are required for True/False.');
    }
    if (draft.correctAnswer !== 'A' && draft.correctAnswer !== 'B') {
      fieldErrors.correctAnswer = 'Correct answer must be A or B for True/False.';
      errors.push('Correct answer is missing or invalid (must be A or B).');
    }
  } else {
    if (!optA || !optB || !optC || !optD) {
      fieldErrors.options = 'Multiple choice questions require all four options (A, B, C, D).';
      errors.push('Answer options A, B, C, and D must all be filled.');
    }
    if (
      draft.correctAnswer !== 'A' &&
      draft.correctAnswer !== 'B' &&
      draft.correctAnswer !== 'C' &&
      draft.correctAnswer !== 'D'
    ) {
      fieldErrors.correctAnswer = 'Select a valid correct answer (A, B, C, or D).';
      errors.push('Correct answer is missing.');
    }
  }

  if (!Number.isFinite(draft.points) || draft.points < 1 || draft.points > 10000) {
    fieldErrors.points = 'Points must be between 1 and 10,000.';
    errors.push('Point value must be between 1 and 10,000.');
  }

  if (!draft.questionSetId.trim()) {
    fieldErrors.questionSetId = 'Question set is required.';
    errors.push('Question set is required.');
  }

  return {
    valid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

export function toPublicQuestion(q: QuestionRecord): PublicQuestionRecord {
  const { correctAnswer: _ca, explanation: _ex, ...sanitized } = q;
  return {
    ...sanitized,
    status: q.status || 'active',
  };
}

export function toPublicQuestionDatabase(db: QuestionDatabase): PublicQuestionDatabase {
  return {
    version: db.version,
    subjects: db.subjects.map((s) => ({ ...s, topics: [...s.topics] })),
    questionSets: db.questionSets.map((s) => ({ ...s })),
    questions: db.questions.map(toPublicQuestion),
    teacherConfig: { ...db.teacherConfig },
    explorationObjectives: db.explorationObjectives
      ? db.explorationObjectives.map((o) => ({ ...o }))
      : DEFAULT_EXPLORATION_OBJECTIVES.map((o) => ({ ...o })),
  };
}

/**
 * Security sanitizer: removes `correctAnswer` and `explanation` completely
 * before handing a challenge to any Player UI component.
 */
export function toPlayerQuestion(
  question: QuestionRecord | PublicQuestionRecord,
  db: QuestionDatabase | PublicQuestionDatabase,
  progress: PlayerQuizProgress,
): PlayerQuestionChallenge {
  const subj = db.subjects.find(
    (s) => s.id === question.subjectId || s.name.toLowerCase() === question.subjectName.toLowerCase(),
  );
  const qSet = db.questionSets.find((s) => s.id === question.questionSetId);

  const options =
    question.type === 'true_false'
      ? [
          { key: 'A' as const, text: question.optionA || 'True' },
          { key: 'B' as const, text: question.optionB || 'False' },
        ]
      : [
          { key: 'A' as const, text: question.optionA },
          { key: 'B' as const, text: question.optionB },
          { key: 'C' as const, text: question.optionC },
          { key: 'D' as const, text: question.optionD },
        ];

  return {
    id: question.id,
    subjectId: question.subjectId,
    subjectName: question.subjectName,
    subjectColor: subj?.color || '#38bdf8',
    topic: question.topic,
    type: question.type,
    questionText: question.questionText,
    options,
    difficulty: question.difficulty,
    points: resolveQuestionKpReward(question, db.teacherConfig),
    buildingCategory: question.buildingCategory,
    floorPlacement: question.floorPlacement,
    placementScope: question.placementScope || 'both',
    targetBuildingId: question.targetBuildingId ?? null,
    questionSetName: qSet?.name || 'City Quiz',
    allowRetry: db.teacherConfig.allowRetryOnWrong,
    alreadyCompleted: progress.completedQuestionIds.includes(question.id),
  };
}

export function evaluatePlayerSubmission(
  db: QuestionDatabase,
  progress: PlayerQuizProgress,
  questionId: string,
  selectedAnswer: AnswerKey,
): { nextProgress: PlayerQuizProgress; outcome: PlayerSubmissionOutcome } {
  const question = db.questions.find((q) => q.id === questionId);
  if (!question) {
    return {
      nextProgress: progress,
      outcome: {
        isCorrect: false,
        pointsAwarded: 0,
        cashBonusAwarded: 0,
        allowRetry: false,
        locked: true,
        alreadyCompleted: false,
        explanation: null,
      },
    };
  }

  const alreadyCompleted = progress.completedQuestionIds.includes(questionId);
  const alreadyLocked = progress.lockedQuestionIds.includes(questionId);
  if (alreadyLocked && !alreadyCompleted) {
    return {
      nextProgress: progress,
      outcome: {
        isCorrect: false,
        pointsAwarded: 0,
        cashBonusAwarded: 0,
        allowRetry: false,
        locked: true,
        alreadyCompleted: false,
        explanation: db.teacherConfig.showExplanationOnWrong ? question.explanation || null : null,
      },
    };
  }

  const isCorrect = selectedAnswer === question.correctAnswer;
  const kpValue = resolveQuestionKpReward(question, db.teacherConfig);
  const pointsAwarded = isCorrect && !alreadyCompleted ? kpValue : 0;
  const cashBonusAwarded =
    pointsAwarded > 0 && db.teacherConfig.awardCityCashBonus
      ? Math.round(pointsAwarded * db.teacherConfig.cashPerPoint)
      : 0;

  const attempt = {
    questionId,
    selectedAnswer,
    isCorrect,
    pointsAwarded,
    attemptedAt: Date.now(),
  };

  if (isCorrect) {
    const nextCompleted = alreadyCompleted
      ? progress.completedQuestionIds
      : [...progress.completedQuestionIds, questionId];
    return {
      nextProgress: {
        completedQuestionIds: nextCompleted,
        lockedQuestionIds: progress.lockedQuestionIds.filter((id) => id !== questionId),
        earnedPoints: progress.earnedPoints + pointsAwarded,
        history: [...progress.history, attempt],
      },
      outcome: {
        isCorrect: true,
        pointsAwarded,
        cashBonusAwarded,
        allowRetry: false,
        locked: false,
        alreadyCompleted,
        explanation: question.explanation || null,
      },
    };
  }

  const allowRetry = db.teacherConfig.allowRetryOnWrong;
  const nextLocked =
    !allowRetry && !progress.lockedQuestionIds.includes(questionId)
      ? [...progress.lockedQuestionIds, questionId]
      : progress.lockedQuestionIds;

  // Security: never leak explanation/answer key while player can still retry
  const revealExplanation = !allowRetry && db.teacherConfig.showExplanationOnWrong;

  return {
    nextProgress: {
      ...progress,
      lockedQuestionIds: nextLocked,
      history: [...progress.history, attempt],
    },
    outcome: {
      isCorrect: false,
      pointsAwarded: 0,
      cashBonusAwarded: 0,
      allowRetry,
      locked: !allowRetry,
      alreadyCompleted,
      explanation: revealExplanation ? question.explanation || null : null,
    },
  };
}

export function generateCsvTemplate(): string {
  const headers = [
    'id',
    'subject',
    'topic',
    'type',
    'questionText',
    'optionA',
    'optionB',
    'optionC',
    'optionD',
    'correctAnswer',
    'explanation',
    'difficulty',
    'points',
    'buildingCategory',
    'floorPlacement',
  ];
  const rows = [
    [
      'MATH-201',
      'Mathematics',
      'Addition',
      'multiple_choice',
      'What is 18 + 27?',
      '43',
      '45',
      '46',
      '55',
      'B',
      '18 + 27 = 45.',
      'easy',
      '20',
      'commercial',
      '1',
    ],
    [
      'SCI-201',
      'Science',
      'Environment',
      'true_false',
      'Planting trees helps absorb carbon dioxide from urban air.',
      'True',
      'False',
      '',
      '',
      'A',
      'Trees absorb CO2 during photosynthesis and produce oxygen.',
      'easy',
      '15',
      'residential',
      '',
    ],
  ];

  const esc = (cell: string) => {
    if (/[",\n\r]/.test(cell)) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };
  return '\uFEFF' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

export function generateJsonTemplate(): string {
  const sample = [
    {
      id: 'MATH-201',
      subject: 'Mathematics',
      topic: 'Addition',
      type: 'multiple_choice',
      questionText: 'What is 18 + 27?',
      optionA: '43',
      optionB: '45',
      optionC: '46',
      optionD: '55',
      correctAnswer: 'B',
      explanation: '18 + 27 = 45.',
      difficulty: 'easy',
      points: 20,
      buildingCategory: 'commercial',
      floorPlacement: 1,
    },
    {
      id: 'CHR-201',
      subject: 'Christian Education',
      topic: 'Bible knowledge',
      type: 'true_false',
      questionText: 'The Golden Rule teaches us to treat others as we would like to be treated.',
      optionA: 'True',
      optionB: 'False',
      optionC: '',
      optionD: '',
      correctAnswer: 'A',
      explanation: 'Matthew 7:12 teaches treating others with the same kindness we wish to receive.',
      difficulty: 'easy',
      points: 20,
      buildingCategory: 'residential',
      floorPlacement: null,
    },
  ];
  return JSON.stringify(sample, null, 2);
}

function parseCsvRows(raw: string): string[][] {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Detect delimiter on first line (comma vs semicolon from localized Excel)
  const firstLine = text.split('\n')[0] || '';
  const delim =
    (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c.length > 0)) {
      rows.push(row);
    }
  }
  return rows;
}

function normalizeQuestionType(raw: unknown): QuestionType {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === 'true_false' || s === 'true/false' || s === 'tf' || s === 'boolean') {
    return 'true_false';
  }
  return 'multiple_choice';
}

function normalizeAnswerKey(raw: unknown, type: QuestionType): AnswerKey | '' {
  const s = String(raw || '')
    .trim()
    .toUpperCase();
  if (type === 'true_false') {
    if (s === 'A' || s === 'TRUE' || s === 'T' || s === '1') return 'A';
    if (s === 'B' || s === 'FALSE' || s === 'F' || s === '0') return 'B';
    if (s === 'C' || s === 'D') return s; // Will fail T/F validation cleanly
    return '';
  }
  if (s === 'A' || s === 'B' || s === 'C' || s === 'D') return s;
  return '';
}

function normalizeDifficulty(raw: unknown): QuestionDifficulty {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === 'special' || s === 'khusus' || s === 'bonus') return 'special';
  if (s === 'hard' || s === 'sulit') return 'hard';
  if (s === 'medium' || s === 'sedang') return 'medium';
  return 'easy';
}

function normalizeBuildingCategory(raw: unknown): PlacementCategory {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === 'residential' || s === 'commercial' || s === 'business' || s === 'industrial') {
    return s;
  }
  return 'any';
}

function normalizeFloorPlacement(raw: unknown): FloorPlacement {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim().toLowerCase();
  if (text === '' || text === 'any') return null;
  if (text === 'rooftop' || text === 'roof') return 22;
  const n = Number(text);
  if (Number.isInteger(n) && n >= 1 && n <= 22) return n;
  return null;
}

function normalizePlacementScope(raw: unknown): 'both' | 'indoor' | 'outdoor' {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'indoor' || s === 'outdoor') return s;
  return 'both';
}

function normalizeTargetBuildingId(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim();
  if (!cleaned || cleaned.toLowerCase() === 'any') return null;
  if (/^[a-zA-Z0-9_-]{1,64}$/.test(cleaned)) return cleaned;
  return null;
}

export function parseBulkImport(
  rawText: string,
  format: 'csv' | 'json',
  db: QuestionDatabase,
  targetSetId: string,
): BulkImportPreviewResult {
  const validRows: QuestionDraftInput[] = [];
  const errors: BulkImportRowError[] = [];
  const seenBatchIds = new Set<string>();
  const existingIds = new Set(db.questions.map((q) => q.id.toUpperCase()));

  let rawObjects: Array<Record<string, unknown>> = [];

  if (format === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return {
        format,
        totalRows: 0,
        validRows: [],
        errors: [{ rowNumber: 1, questionId: '-', messages: ['Invalid JSON syntax.'] }],
      };
    }
    const arr = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { questions?: unknown[] }).questions)
        ? (parsed as { questions: unknown[] }).questions
        : null;
    if (!arr) {
      return {
        format,
        totalRows: 0,
        validRows: [],
        errors: [
          {
            rowNumber: 1,
            questionId: '-',
            messages: ['JSON must be an array of question objects (or { "questions": [...] }).'],
          },
        ],
      };
    }
    rawObjects = arr.map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : {}));
  } else {
    const rows = parseCsvRows(rawText);
    if (rows.length < 2) {
      return {
        format,
        totalRows: 0,
        validRows: [],
        errors: [
          {
            rowNumber: 1,
            questionId: '-',
            messages: ['CSV must include a header row and at least one question row.'],
          },
        ],
      };
    }
    const headers = rows[0].map((h) => h.trim());
    for (let r = 1; r < rows.length; r++) {
      const obj: Record<string, unknown> = {};
      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = rows[r][c] ?? '';
      }
      rawObjects.push(obj);
    }
  }

  for (let i = 0; i < rawObjects.length; i++) {
    const rowNum = format === 'csv' ? i + 2 : i + 1;
    const obj = rawObjects[i];
    const id = String(obj.id ?? obj.questionId ?? '').trim();
    const subjectName = String(obj.subject ?? obj.subjectName ?? '').trim();
    const topic = String(obj.topic ?? '').trim();
    const type = normalizeQuestionType(obj.type);
    const questionText = String(obj.questionText ?? obj.question ?? '').trim();
    const optionA = String(obj.optionA ?? (type === 'true_false' ? 'True' : '')).trim();
    const optionB = String(obj.optionB ?? (type === 'true_false' ? 'False' : '')).trim();
    const optionC = String(obj.optionC ?? '').trim();
    const optionD = String(obj.optionD ?? '').trim();
    const correctAnswer = normalizeAnswerKey(obj.correctAnswer ?? obj.answer, type);
    const explanation = String(obj.explanation ?? '').trim();
    const difficulty = normalizeDifficulty(obj.difficulty);
    const pointsRaw = obj.points !== undefined && String(obj.points).trim() !== '' ? Number(obj.points) : 20;
    const buildingCategory = normalizeBuildingCategory(obj.buildingCategory);
    const floorPlacement = normalizeFloorPlacement(obj.floorPlacement);
    const placementScope = normalizePlacementScope(obj.placementScope);
    const targetBuildingId = normalizeTargetBuildingId(obj.targetBuildingId);

    const matchedSubj = db.subjects.find(
      (s) =>
        s.id.toLowerCase() === subjectName.toLowerCase() ||
        s.name.toLowerCase() === subjectName.toLowerCase(),
    );

    const draft: QuestionDraftInput = {
      id,
      subjectId: matchedSubj?.id || (subjectName ? slugifyId('subj', subjectName) : ''),
      subjectName,
      topic,
      type,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      explanation,
      difficulty,
      points: Number.isFinite(pointsRaw) ? Math.round(pointsRaw) : NaN,
      buildingCategory,
      floorPlacement,
      placementScope,
      targetBuildingId,
      questionSetId: String(obj.questionSetId || targetSetId || db.questionSets[0]?.id || 'set_city_core'),
    };

    const rowErrors: string[] = [];
    const val = validateQuestionInput(draft, [], null);
    if (!val.valid) {
      rowErrors.push(...val.errors);
    }

    if (id) {
      const upper = id.toUpperCase();
      if (existingIds.has(upper)) {
        rowErrors.push(`Question ID "${id}" already exists in the question bank.`);
      } else if (seenBatchIds.has(upper)) {
        rowErrors.push(`Duplicate Question ID "${id}" inside the imported file.`);
      }
      seenBatchIds.add(upper);
    }

    if (rowErrors.length > 0) {
      errors.push({
        rowNumber: rowNum,
        questionId: id || '(missing)',
        messages: rowErrors,
      });
    } else {
      validRows.push(draft);
    }
  }

  return {
    format,
    totalRows: rawObjects.length,
    validRows,
    errors,
  };
}

export function commitImportedDrafts(
  db: QuestionDatabase,
  drafts: QuestionDraftInput[],
): QuestionDatabase {
  const nextSubjects = db.subjects.map((s) => ({ ...s, topics: [...s.topics] }));
  const nextQuestions = [...db.questions];
  const now = Date.now();

  for (const draft of drafts) {
    const sName = (draft.subjectName || '').trim();
    let subj = nextSubjects.find(
      (s) =>
        s.id === draft.subjectId ||
        (sName && s.name.toLowerCase() === sName.toLowerCase()),
    );
    if (!subj) {
      subj = {
        id: draft.subjectId || slugifyId('subj', sName || 'Custom'),
        name: sName || 'Custom Subject',
        color: pickSubjectColor(nextSubjects.length),
        topics: [],
      };
      nextSubjects.push(subj);
    }
    const cleanTopic = draft.topic.trim();
    if (cleanTopic && !subj.topics.some((t) => t.toLowerCase() === cleanTopic.toLowerCase())) {
      subj.topics.push(cleanTopic);
    }

    const record: QuestionRecord = {
      id: draft.id.trim(),
      subjectId: subj.id,
      subjectName: subj.name,
      topic: cleanTopic,
      type: draft.type,
      questionText: draft.questionText.trim(),
      optionA: draft.optionA.trim(),
      optionB: draft.optionB.trim(),
      optionC: draft.type === 'true_false' ? '' : draft.optionC.trim(),
      optionD: draft.type === 'true_false' ? '' : draft.optionD.trim(),
      correctAnswer: (draft.correctAnswer || 'A') as AnswerKey,
      explanation: draft.explanation.trim(),
      difficulty: draft.difficulty,
      points: Math.round(draft.points),
      buildingCategory: draft.buildingCategory,
      floorPlacement: draft.floorPlacement,
      placementScope: draft.placementScope || 'both',
      targetBuildingId: draft.targetBuildingId ?? null,
      questionSetId: draft.questionSetId,
      status: draft.status || 'active',
      createdAt: now,
      updatedAt: now,
    };
    nextQuestions.push(record);
  }

  return {
    ...db,
    subjects: nextSubjects,
    questions: nextQuestions,
  };
}
