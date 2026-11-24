import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FC,
  type FormEvent,
} from 'react';
import {
  AlertTriangle,
  Award,
  BookMarked,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FolderPlus,
  GraduationCap,
  KeyRound,
  Layers,
  Lock,
  MapPin,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Square,
  Tags,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  ModerationReportRecord,
  MultiplayerSessionSnapshot,
  SessionStatus,
  StudentProgressRecord,
} from '../game/multiplayerTypes';
import { DEFAULT_CHALLENGE_SETTINGS } from '../game/challengeSystem';
import {
  DEFAULT_KP_DIFFICULTY_REWARDS,
  REWARD_SHOP_CATALOG,
} from '../game/rewardShopCatalog';
import { DEFAULT_SOCIAL_CONFIG } from '../game/socialSystem';
import {
  commitImportedDrafts,
  generateCsvTemplate,
  generateJsonTemplate,
  parseBulkImport,
  pickSubjectColor,
  slugifyId,
  suggestNextQuestionId,
  validateQuestionInput,
} from '../game/questionBank';
import type {
  AnswerKey,
  BulkImportPreviewResult,
  ChallengeModeKind,
  FloorPlacement,
  PlacementCategory,
  QuestionDatabase,
  QuestionDifficulty,
  QuestionDraftInput,
  QuestionRecord,
  QuestionSet,
  QuestionType,
  SubjectDefinition,
} from '../game/questionTypes';
import {
  changeTeacherPin,
  createTeacherSession,
  deleteTeacherSession,
  fetchTeacherDatabase,
  fetchTeacherReports,
  fetchTeacherSessions,
  manageTeacherAccounts,
  updateTeacherSessionStatus,
} from '../services/multiplayerClient';

type TeacherTab =
  | 'questions'
  | 'editor'
  | 'subjects'
  | 'topics'
  | 'import'
  | 'placement'
  | 'rewards'
  | 'sessions'
  | 'progress'
  | 'settings';

interface TeacherDashboardModalProps {
  idToken: string;
  teacherToken: string;
  teacherEmail: string;
  database: QuestionDatabase;
  onUpdateDatabase: (nextDb: QuestionDatabase) => Promise<void> | void;
  onResetToDefaults: () => Promise<QuestionDatabase> | QuestionDatabase;
  onLockTeacherMode: () => void;
  onClose: () => void;
}

const BUILDING_CATEGORIES: Array<{ value: PlacementCategory; label: string; desc: string }> = [
  {
    value: 'any',
    label: 'Any Building / City Hub',
    desc: 'Appears at City Avenue Knowledge Hub and serves as fallback across buildings.',
  },
  {
    value: 'residential',
    label: 'Residential',
    desc: 'Placed in Residential Study Terminal, Small Houses, Modern Houses, and Apartments.',
  },
  {
    value: 'commercial',
    label: 'Commercial',
    desc: 'Placed in Urban Mart, Convenience Stores, Restaurants, Cafes, and Shopping Centers.',
  },
  {
    value: 'business',
    label: 'Business',
    desc: 'Placed in Freedom Tower, Corporate Offices, and Multi-Floor Reception Lobbies.',
  },
  {
    value: 'industrial',
    label: 'Industrial',
    desc: 'Placed in Industrial Port Terminal, Workshops, Warehouses, and Factories.',
  },
];

const SUBJECT_COLOR_SWATCHES = [
  '#38bdf8',
  '#34d399',
  '#f59e0b',
  '#a78bfa',
  '#fb7185',
  '#2dd4bf',
  '#f97316',
  '#60a5fa',
];

function createEmptyDraft(db: QuestionDatabase): QuestionDraftInput {
  const firstSubj = db.subjects[0];
  const firstSet = db.questionSets.find((s) => s.isActive) || db.questionSets[0];
  return {
    id: suggestNextQuestionId(db.questions, firstSubj?.name || 'QUES'),
    subjectId: firstSubj?.id || '',
    subjectName: firstSubj?.name || '',
    topic: firstSubj?.topics[0] || '',
    type: 'multiple_choice',
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A',
    explanation: '',
    difficulty: 'easy',
    points: 20,
    buildingCategory: 'commercial',
    floorPlacement: null,
    questionSetId: firstSet?.id || 'set_city_core',
    status: 'active',
  };
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const TeacherDashboardModal: FC<TeacherDashboardModalProps> = ({
  idToken,
  teacherToken,
  teacherEmail,
  database,
  onUpdateDatabase,
  onResetToDefaults,
  onLockTeacherMode,
  onClose,
}) => {
  const [tab, setTab] = useState<TeacherTab>('questions');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Filters on Questions tab
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterTopic, setFilterTopic] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState<'all' | QuestionDifficulty>('all');
  const [filterSet, setFilterSet] = useState('all');
  const [filterCategory, setFilterCategory] = useState<'all' | PlacementCategory>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [previewQuestion, setPreviewQuestion] = useState<QuestionRecord | null>(null);

  // Question Editor tab state
  const [editingOriginalId, setEditingOriginalId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuestionDraftInput>(() => createEmptyDraft(database));
  const [editorErrors, setEditorErrors] = useState<string[]>([]);
  const [customTopicInput, setCustomTopicInput] = useState('');
  const [showEditorPreview, setShowEditorPreview] = useState(false);

  // Subjects tab state
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#38bdf8');
  const [newSubjectTopicsRaw, setNewSubjectTopicsRaw] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState('');

  // Topics tab state
  const [topicSubjectFilter, setTopicSubjectFilter] = useState<string>('all');
  const [topicInputsBySubject, setTopicInputsBySubject] = useState<Record<string, string>>({});

  // Question Sets state (inside Placement & Sets tab)
  const [newSetName, setNewSetName] = useState('');
  const [newSetDesc, setNewSetDesc] = useState('');

  // Bulk Import tab state
  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv');
  const [importRawText, setImportRawText] = useState('');
  const [importTargetSetId, setImportTargetSetId] = useState(
    database.questionSets[0]?.id || 'set_city_core',
  );
  const [importPreview, setImportPreview] = useState<BulkImportPreviewResult | null>(null);

  // Multiplayer Sessions & Student Progress state
  const [sessions, setSessions] = useState<MultiplayerSessionSnapshot[]>([]);
  const [studentProgress, setStudentProgress] = useState<StudentProgressRecord[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionSubject, setNewSessionSubject] = useState(database.subjects[0]?.name || 'General');
  const [newSessionSetId, setNewSessionSetId] = useState(database.questionSets[0]?.id || 'set_city_core');
  const [newSessionMaxPlayers, setNewSessionMaxPlayers] = useState(12);
  const [newSessionDuration, setNewSessionDuration] = useState(20);
  const [newSessionObjectives, setNewSessionObjectives] = useState(
    'Explore city districts & complete building study terminals.',
  );
  const [newSessionCode, setNewSessionCode] = useState('');

  // Account & Security Settings state
  const [teacherEmails, setTeacherEmails] = useState<string[]>([teacherEmail]);
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [moderationReports, setModerationReports] = useState<ModerationReportRecord[]>([]);

  const showNotice = (msg: string) => {
    setErrorNotice(null);
    setNotice(msg);
  };

  const showError = (msg: string) => {
    setNotice(null);
    setErrorNotice(msg);
  };

  const refreshSessionsAndProgress = useCallback(
    async (quiet = false) => {
      if (!quiet) setSessionsLoading(true);
      try {
        const res = await fetchTeacherSessions(idToken, teacherToken);
        setSessions(res.sessions);
        setStudentProgress(res.studentProgress);
      } catch (err) {
        if (!quiet) {
          showError(err instanceof Error ? err.message : 'Unable to fetch classroom sessions.');
        }
      } finally {
        if (!quiet) setSessionsLoading(false);
      }
    },
    [idToken, teacherToken],
  );

  const refreshTeacherMetadata = useCallback(async () => {
    try {
      const [dbRes, repRes] = await Promise.all([
        fetchTeacherDatabase(idToken, teacherToken),
        fetchTeacherReports(idToken, teacherToken).catch(() => ({ reports: [] })),
      ]);
      setTeacherEmails(dbRes.teacherEmails);
      setModerationReports(repRes.reports || []);
    } catch {
      // handled cleanly by parent if token expired
    }
  }, [idToken, teacherToken]);

  useEffect(() => {
    void refreshSessionsAndProgress(false);
    void refreshTeacherMetadata();
  }, [refreshSessionsAndProgress, refreshTeacherMetadata]);

  useEffect(() => {
    if (tab !== 'sessions' && tab !== 'progress') return;
    const timer = window.setInterval(() => {
      void refreshSessionsAndProgress(true);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [tab, refreshSessionsAndProgress]);

  const selectedEditorSubject = useMemo(
    () => database.subjects.find((s) => s.id === draft.subjectId) || database.subjects[0],
    [database.subjects, draft.subjectId],
  );

  const availableTopicsForFilter = useMemo(() => {
    const topics = new Set<string>();
    if (filterSubject === 'all') {
      database.subjects.forEach((s) => s.topics.forEach((t) => topics.add(t)));
      database.questions.forEach((q) => {
        if (q.topic) topics.add(q.topic);
      });
    } else {
      const subj = database.subjects.find((s) => s.id === filterSubject);
      subj?.topics.forEach((t) => topics.add(t));
      database.questions
        .filter((q) => q.subjectId === filterSubject)
        .forEach((q) => {
          if (q.topic) topics.add(q.topic);
        });
    }
    return [...topics];
  }, [database.subjects, database.questions, filterSubject]);

  const filteredQuestions = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    return database.questions.filter((q) => {
      const status = q.status || 'active';
      if (filterStatus !== 'all' && status !== filterStatus) return false;
      if (filterSubject !== 'all' && q.subjectId !== filterSubject) return false;
      if (filterTopic !== 'all' && q.topic !== filterTopic) return false;
      if (filterDifficulty !== 'all' && q.difficulty !== filterDifficulty) return false;
      if (filterSet !== 'all' && q.questionSetId !== filterSet) return false;
      if (filterCategory !== 'all' && q.buildingCategory !== filterCategory) return false;
      if (
        qLower &&
        !q.id.toLowerCase().includes(qLower) &&
        !q.questionText.toLowerCase().includes(qLower) &&
        !q.subjectName.toLowerCase().includes(qLower) &&
        !q.topic.toLowerCase().includes(qLower)
      ) {
        return false;
      }
      return true;
    });
  }, [
    database.questions,
    searchQuery,
    filterSubject,
    filterTopic,
    filterDifficulty,
    filterSet,
    filterCategory,
    filterStatus,
  ]);

  const activeSetIds = useMemo(
    () => new Set(database.questionSets.filter((s) => s.isActive).map((s) => s.id)),
    [database.questionSets],
  );

  // --- Question Handlers ---
  const openCreateQuestion = () => {
    setEditingOriginalId(null);
    setDraft(createEmptyDraft(database));
    setEditorErrors([]);
    setShowEditorPreview(false);
    setTab('editor');
  };

  const openEditQuestion = (q: QuestionRecord) => {
    setEditingOriginalId(q.id);
    setDraft({
      id: q.id,
      subjectId: q.subjectId,
      subjectName: q.subjectName,
      topic: q.topic,
      type: q.type,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      points: q.points,
      buildingCategory: q.buildingCategory,
      floorPlacement: q.floorPlacement,
      questionSetId: q.questionSetId,
      status: q.status || 'active',
    });
    setEditorErrors([]);
    setShowEditorPreview(false);
    setTab('editor');
  };

  const handleToggleQuestionStatus = (id: string) => {
    const target = database.questions.find((q) => q.id === id);
    if (!target) return;
    const nextStatus = target.status === 'inactive' ? 'active' : 'inactive';
    void onUpdateDatabase({
      ...database,
      questions: database.questions.map((q) =>
        q.id === id ? { ...q, status: nextStatus, updatedAt: Date.now() } : q,
      ),
    });
    showNotice(`Question ${id} marked ${nextStatus}.`);
  };

  const handleDeleteQuestion = (id: string) => {
    void onUpdateDatabase({
      ...database,
      questions: database.questions.filter((q) => q.id !== id),
    });
    if (previewQuestion?.id === id) setPreviewQuestion(null);
    showNotice(`Deleted question ${id}.`);
  };

  const handleSaveQuestion = () => {
    const subj = database.subjects.find((s) => s.id === draft.subjectId);
    const prepared: QuestionDraftInput = {
      ...draft,
      subjectName: subj?.name || draft.subjectName || 'Custom Subject',
      optionA: draft.type === 'true_false' && !draft.optionA.trim() ? 'True' : draft.optionA,
      optionB: draft.type === 'true_false' && !draft.optionB.trim() ? 'False' : draft.optionB,
    };

    const validation = validateQuestionInput(prepared, database.questions, editingOriginalId);
    if (!validation.valid) {
      setEditorErrors(validation.errors);
      return;
    }

    const now = Date.now();
    const record: QuestionRecord = {
      id: prepared.id.trim(),
      subjectId: prepared.subjectId,
      subjectName: subj?.name || prepared.subjectName || 'General Knowledge',
      topic: prepared.topic.trim(),
      type: prepared.type,
      questionText: prepared.questionText.trim(),
      optionA: prepared.optionA.trim(),
      optionB: prepared.optionB.trim(),
      optionC: prepared.type === 'true_false' ? '' : prepared.optionC.trim(),
      optionD: prepared.type === 'true_false' ? '' : prepared.optionD.trim(),
      correctAnswer: (prepared.correctAnswer || 'A') as AnswerKey,
      explanation: prepared.explanation.trim(),
      difficulty: prepared.difficulty,
      points: Math.round(prepared.points),
      buildingCategory: prepared.buildingCategory,
      floorPlacement: prepared.floorPlacement,
      questionSetId: prepared.questionSetId,
      status: prepared.status || 'active',
      createdAt:
        editingOriginalId
          ? database.questions.find((q) => q.id === editingOriginalId)?.createdAt || now
          : now,
      updatedAt: now,
    };

    const nextSubjects = database.subjects.map((s) => {
      if (
        s.id === record.subjectId &&
        record.topic &&
        !s.topics.some((t) => t.toLowerCase() === record.topic.toLowerCase())
      ) {
        return { ...s, topics: [...s.topics, record.topic] };
      }
      return s;
    });

    const nextQuestions = editingOriginalId
      ? database.questions.map((q) => (q.id === editingOriginalId ? record : q))
      : [record, ...database.questions];

    void onUpdateDatabase({
      ...database,
      subjects: nextSubjects,
      questions: nextQuestions,
    });
    setEditorErrors([]);
    showNotice(
      editingOriginalId
        ? `Updated question ${record.id}.`
        : `Added question ${record.id} to ${record.subjectName}.`,
    );
    setTab('questions');
  };

  // --- Subject & Topic Handlers ---
  const handleAddSubject = () => {
    const cleanName = newSubjectName.trim();
    if (!cleanName) return;
    if (database.subjects.some((s) => s.name.toLowerCase() === cleanName.toLowerCase())) {
      showError(`Subject "${cleanName}" already exists.`);
      return;
    }
    const topics = newSubjectTopicsRaw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const created: SubjectDefinition = {
      id: slugifyId('subj', cleanName),
      name: cleanName,
      color: newSubjectColor || pickSubjectColor(database.subjects.length),
      topics: topics.length > 0 ? topics : ['General'],
    };
    void onUpdateDatabase({
      ...database,
      subjects: [...database.subjects, created],
    });
    setNewSubjectName('');
    setNewSubjectTopicsRaw('');
    showNotice(`Added subject "${created.name}".`);
  };

  const handleRenameSubject = (id: string) => {
    const clean = editingSubjectName.trim();
    if (!clean) return;
    void onUpdateDatabase({
      ...database,
      subjects: database.subjects.map((s) => (s.id === id ? { ...s, name: clean } : s)),
      questions: database.questions.map((q) =>
        q.subjectId === id ? { ...q, subjectName: clean } : q,
      ),
    });
    setEditingSubjectId(null);
    setEditingSubjectName('');
    showNotice(`Renamed subject to "${clean}".`);
  };

  const handleDeleteSubject = (id: string) => {
    if (database.subjects.length <= 1) {
      showError('Keep at least one subject in the question bank.');
      return;
    }
    const target = database.subjects.find((s) => s.id === id);
    const remainingSubjects = database.subjects.filter((s) => s.id !== id);
    const fallback = remainingSubjects[0];
    void onUpdateDatabase({
      ...database,
      subjects: remainingSubjects,
      questions: database.questions.map((q) =>
        q.subjectId === id
          ? { ...q, subjectId: fallback.id, subjectName: fallback.name }
          : q,
      ),
    });
    showNotice(`Removed subject "${target?.name || id}". Existing questions reassigned to ${fallback.name}.`);
  };

  const handleAddTopicToSubject = (subjId: string) => {
    const clean = (topicInputsBySubject[subjId] || '').trim();
    if (!clean) return;
    void onUpdateDatabase({
      ...database,
      subjects: database.subjects.map((s) =>
        s.id === subjId && !s.topics.some((t) => t.toLowerCase() === clean.toLowerCase())
          ? { ...s, topics: [...s.topics, clean] }
          : s,
      ),
    });
    setTopicInputsBySubject((prev) => ({ ...prev, [subjId]: '' }));
    showNotice(`Added topic "${clean}".`);
  };

  const handleRemoveTopicFromSubject = (subjId: string, topicName: string) => {
    void onUpdateDatabase({
      ...database,
      subjects: database.subjects.map((s) =>
        s.id === subjId ? { ...s, topics: s.topics.filter((t) => t !== topicName) } : s,
      ),
    });
    showNotice(`Removed topic "${topicName}".`);
  };

  // --- Question Sets Handlers ---
  const handleCreateSet = () => {
    const clean = newSetName.trim();
    if (!clean) return;
    const nextSet: QuestionSet = {
      id: slugifyId('set', clean),
      name: clean,
      description: newSetDesc.trim() || 'Custom teacher question set',
      isActive: true,
      createdAt: Date.now(),
    };
    void onUpdateDatabase({
      ...database,
      questionSets: [...database.questionSets, nextSet],
    });
    setNewSetName('');
    setNewSetDesc('');
    showNotice(`Created question set "${clean}".`);
  };

  const handleToggleSetActive = (setId: string) => {
    void onUpdateDatabase({
      ...database,
      questionSets: database.questionSets.map((s) =>
        s.id === setId ? { ...s, isActive: !s.isActive } : s,
      ),
    });
  };

  const handleDeleteSet = (setId: string) => {
    if (database.questionSets.length <= 1) {
      showError('At least one question set must remain.');
      return;
    }
    const remaining = database.questionSets.filter((s) => s.id !== setId);
    const fallbackId = remaining[0].id;
    void onUpdateDatabase({
      ...database,
      questionSets: remaining,
      questions: database.questions.map((q) =>
        q.questionSetId === setId ? { ...q, questionSetId: fallbackId } : q,
      ),
    });
    showNotice('Deleted question set and reassigned its questions.');
  };

  // --- Placement Reassignment Helper ---
  const handleReassignQuestionPlacement = (
    questionId: string,
    buildingCategory: PlacementCategory,
    floorPlacement: FloorPlacement,
  ) => {
    void onUpdateDatabase({
      ...database,
      questions: database.questions.map((q) =>
        q.id === questionId
          ? { ...q, buildingCategory, floorPlacement, updatedAt: Date.now() }
          : q,
      ),
    });
    showNotice(`Updated placement for ${questionId}.`);
  };

  // --- Bulk Import Handlers ---
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isJson = file.name.toLowerCase().endsWith('.json');
    const fmt = isJson ? 'json' : 'csv';
    setImportFormat(fmt);
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      setImportRawText(content);
      setImportPreview(parseBulkImport(content, fmt, database, importTargetSetId));
    };
    reader.readAsText(file);
  };

  const handleValidateImport = () => {
    const res = parseBulkImport(importRawText, importFormat, database, importTargetSetId);
    setImportPreview(res);
  };

  const handleCommitImport = () => {
    if (!importPreview || importPreview.validRows.length === 0) return;
    const nextDb = commitImportedDrafts(database, importPreview.validRows);
    void onUpdateDatabase(nextDb);
    const count = importPreview.validRows.length;
    setImportPreview(null);
    setImportRawText('');
    showNotice(`Imported ${count} validated question${count === 1 ? '' : 's'} into the bank!`);
    setTab('questions');
  };

  // --- Multiplayer Sessions Handlers ---
  const handleCreateSession = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) {
      showError('Enter a classroom session name.');
      return;
    }
    try {
      const res = await createTeacherSession(idToken, teacherToken, {
        name: newSessionName.trim(),
        subject: newSessionSubject.trim() || 'General',
        questionSetId: newSessionSetId,
        maxPlayers: Math.max(2, Math.min(30, Number(newSessionMaxPlayers) || 12)),
        durationMinutes: Math.max(5, Math.min(180, Number(newSessionDuration) || 20)),
        objectives: newSessionObjectives.trim(),
        joinCode: newSessionCode.trim() || undefined,
      });
      setNewSessionName('');
      setNewSessionCode('');
      setSessions((prev) => [res.snapshot, ...prev]);
      showNotice(
        `Created session "${res.snapshot.session.name}" with Join Code ${res.snapshot.session.joinCode}.`,
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to create session.');
    }
  };

  const handleSessionStatusChange = async (sessionId: string, status: SessionStatus) => {
    try {
      const res = await updateTeacherSessionStatus(idToken, teacherToken, sessionId, status);
      setSessions((prev) => prev.map((s) => (s.session.id === sessionId ? res.snapshot : s)));
      showNotice(`Session ${res.snapshot.session.joinCode} is now ${status}.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to update session status.');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteTeacherSession(idToken, teacherToken, sessionId);
      setSessions((prev) => prev.filter((s) => s.session.id !== sessionId));
      showNotice('Removed classroom session.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to delete session.');
    }
  };

  const handleCopyJoinCode = (code: string) => {
    void navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode((cur) => (cur === code ? null : cur)), 1800);
  };

  // --- Teacher Account & PIN Settings Handlers ---
  const handleChangePin = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6,12}$/.test(newPin)) {
      showError('New Teacher PIN must contain 6 to 12 numeric digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      showError('New PIN confirmation does not match.');
      return;
    }
    setSavingSettings(true);
    try {
      await changeTeacherPin(idToken, teacherToken, currentPin, newPin);
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
      showNotice('Teacher security PIN updated successfully.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to change Teacher PIN.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddTeacherEmail = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = newTeacherEmail.trim().toLowerCase();
    if (!cleaned || !cleaned.includes('@')) {
      showError('Enter a valid Google email address.');
      return;
    }
    setSavingSettings(true);
    try {
      const res = await manageTeacherAccounts(idToken, teacherToken, 'add', cleaned);
      setTeacherEmails(res.teacherEmails);
      setNewTeacherEmail('');
      showNotice(`Authorized instructor account: ${cleaned}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to authorize teacher email.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRemoveTeacherEmail = async (email: string) => {
    setSavingSettings(true);
    try {
      const res = await manageTeacherAccounts(idToken, teacherToken, 'remove', email);
      setTeacherEmails(res.teacherEmails);
      showNotice(`Removed instructor authorization for ${email}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to remove instructor email.');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4"
      style={{ backgroundColor: 'rgba(9, 14, 24, 0.8)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-dashboard-title"
      data-testid="teacher-modal"
    >
      <div
        className="w-full max-w-6xl h-[93vh] flex flex-col rounded-xl border border-white/15 shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.97)' }}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                Protected Instructor Suite · {teacherEmail}
              </div>
              <h2
                id="teacher-dashboard-title"
                className="font-display text-lg sm:text-xl font-bold text-white"
              >
                Teacher Management &amp; Classroom Sessions
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-white/10 text-xs font-mono-hud text-slate-200">
              <span>{database.questions.length} Questions</span>
              <span className="text-slate-500">·</span>
              <span>{database.subjects.length} Subjects</span>
              <span className="text-slate-500">·</span>
              <span>{sessions.filter((s) => s.session.status === 'active').length} Live</span>
            </span>
            <button
              type="button"
              data-testid="teacher-lock-btn"
              onClick={onLockTeacherMode}
              title="Lock Teacher Mode & Clear Elevation Token"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
            <button
              type="button"
              data-testid="teacher-close-btn"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (All 9 Management Sections + Question Editor) */}
        <div className="flex items-center gap-1.5 px-4 sm:px-6 py-2.5 border-b border-white/10 overflow-x-auto bg-slate-950/50">
          {[
            { id: 'questions' as const, label: '1. Question Bank', icon: BookMarked },
            { id: 'subjects' as const, label: '2. Subjects', icon: Layers },
            { id: 'topics' as const, label: '3. Topics', icon: Tags },
            { id: 'import' as const, label: '4. Import', icon: FileSpreadsheet },
            { id: 'placement' as const, label: '5. Placements & Sets', icon: Building2 },
            { id: 'rewards' as const, label: '6. Rewards', icon: Award },
            { id: 'sessions' as const, label: '7. Sessions', icon: Radio },
            { id: 'progress' as const, label: '8. Student Progress', icon: Users },
            { id: 'settings' as const, label: '9. Account Settings', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const active =
              tab === item.id || (tab === 'editor' && item.id === 'questions');
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`teacher-tab-${item.id}`}
                onClick={() => {
                  setTab(item.id);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800/80 text-slate-300 border border-white/10 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Status / Error Banners */}
        {notice && (
          <div className="mx-4 sm:mx-6 mt-3 flex items-center justify-between gap-2 rounded-lg border border-emerald-400/40 bg-emerald-950/60 px-3.5 py-2 text-xs text-emerald-200">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{notice}</span>
            </span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-slate-300 hover:text-white"
              aria-label="Dismiss notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {errorNotice && (
          <div className="mx-4 sm:mx-6 mt-3 flex items-center justify-between gap-2 rounded-lg border border-rose-400/45 bg-rose-950/60 px-3.5 py-2 text-xs text-rose-200">
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorNotice}</span>
            </span>
            <button
              type="button"
              onClick={() => setErrorNotice(null)}
              className="text-slate-300 hover:text-white"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* SECTION 1: QUESTION BANK LIST & FILTERS */}
          {tab === 'questions' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                <div className="lg:col-span-2 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ID, topic, or question..."
                    data-testid="teacher-search-input"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <select
                  value={filterSubject}
                  onChange={(e) => {
                    setFilterSubject(e.target.value);
                    setFilterTopic('all');
                  }}
                  aria-label="Filter by subject"
                  className="px-2.5 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="all">All Subjects</option>
                  {database.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterTopic}
                  onChange={(e) => setFilterTopic(e.target.value)}
                  aria-label="Filter by topic"
                  className="px-2.5 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="all">All Topics</option>
                  {availableTopicsForFilter.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <select
                  value={filterDifficulty}
                  onChange={(e) =>
                    setFilterDifficulty(e.target.value as 'all' | QuestionDifficulty)
                  }
                  aria-label="Filter by difficulty"
                  className="px-2.5 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="all">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="special">Special Challenge</option>
                </select>

                <select
                  value={filterSet}
                  onChange={(e) => setFilterSet(e.target.value)}
                  aria-label="Filter by question set"
                  className="px-2.5 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="all">All Sets</option>
                  {database.questionSets.map((qs) => (
                    <option key={qs.id} value={qs.id}>
                      {qs.name} {qs.isActive ? '' : '(Inactive)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={filterCategory}
                    onChange={(e) =>
                      setFilterCategory(e.target.value as 'all' | PlacementCategory)
                    }
                    aria-label="Filter by building category"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="all">All Building Categories</option>
                    {BUILDING_CATEGORIES.map((bc) => (
                      <option key={bc.value} value={bc.value}>
                        {bc.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) =>
                      setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')
                    }
                    aria-label="Filter by status"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Questions</option>
                    <option value="inactive">Inactive Questions</option>
                  </select>
                  <span className="text-xs font-mono-hud text-slate-400">
                    Showing {filteredQuestions.length} of {database.questions.length}
                  </span>
                </div>

                <button
                  type="button"
                  data-testid="teacher-new-question-btn"
                  onClick={openCreateQuestion}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Question</span>
                </button>
              </div>

              {/* Preview Drawer inside Teacher Mode */}
              {previewQuestion && (
                <div
                  data-testid="teacher-question-preview"
                  className="rounded-xl border border-sky-400/45 bg-slate-900/95 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                      Teacher Preview · {previewQuestion.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewQuestion(null)}
                      className="text-xs text-slate-300 hover:text-white"
                    >
                      Close Preview
                    </button>
                  </div>
                  <div className="text-sm font-bold text-white">{previewQuestion.questionText}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(['A', 'B', 'C', 'D'] as const).map((key) => {
                      const val =
                        key === 'A'
                          ? previewQuestion.optionA
                          : key === 'B'
                            ? previewQuestion.optionB
                            : key === 'C'
                              ? previewQuestion.optionC
                              : previewQuestion.optionD;
                      if (!val) return null;
                      const isKey = previewQuestion.correctAnswer === key;
                      return (
                        <div
                          key={key}
                          className={`px-3 py-2 rounded-lg border ${
                            isKey
                              ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200 font-semibold'
                              : 'border-white/10 bg-slate-800/70 text-slate-300'
                          }`}
                        >
                          <span className="font-mono-hud mr-2">{key}.</span>
                          {val} {isKey ? '✓ (Correct Key)' : ''}
                        </div>
                      );
                    })}
                  </div>
                  {previewQuestion.explanation && (
                    <div className="text-xs text-slate-300 border-t border-white/10 pt-2">
                      <span className="font-semibold text-amber-300">Explanation: </span>
                      {previewQuestion.explanation}
                    </div>
                  )}
                </div>
              )}

              {/* Question List */}
              {filteredQuestions.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
                  No questions match your current filters. Try clearing filters or add a new question.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredQuestions.map((q) => {
                    const subj = database.subjects.find((s) => s.id === q.subjectId);
                    const qSet = database.questionSets.find((s) => s.id === q.questionSetId);
                    const isSetActive = activeSetIds.has(q.questionSetId);
                    const isQuestionActive = q.status !== 'inactive';
                    return (
                      <div
                        key={q.id}
                        data-testid={`teacher-question-row-${q.id}`}
                        className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isQuestionActive
                            ? 'border-white/10 bg-slate-900/75'
                            : 'border-slate-700/60 bg-slate-900/40 opacity-75'
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-mono-hud font-bold text-amber-300">
                              {q.id}
                            </span>
                            <span
                              className="px-2 py-0.5 rounded font-semibold text-white"
                              style={{
                                backgroundColor: `${subj?.color || '#38bdf8'}26`,
                                border: `1px solid ${subj?.color || '#38bdf8'}66`,
                              }}
                            >
                              {q.subjectName}
                            </span>
                            <span className="text-slate-300 font-medium">{q.topic}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 capitalize">
                              {q.difficulty}
                            </span>
                            <span className="font-mono-hud text-emerald-400 font-semibold">
                              +{q.points} pts
                            </span>
                            <span className="text-slate-400">
                              {q.buildingCategory}
                              {q.floorPlacement ? ` · Floor ${q.floorPlacement}` : ''}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                isSetActive
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {qSet?.name || q.questionSetId}
                              {isSetActive ? '' : ' (Set Off)'}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-white line-clamp-2">
                            {q.questionText}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            data-testid={`toggle-question-status-${q.id}`}
                            onClick={() => handleToggleQuestionStatus(q.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                              isQuestionActive
                                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                                : 'border-white/15 bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {isQuestionActive ? 'Active' : 'Inactive'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewQuestion(q)}
                            title="Preview Question & Answer Key"
                            className="p-2 rounded-lg border border-white/10 bg-slate-800 text-sky-300 hover:bg-slate-700 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            data-testid={`edit-question-${q.id}`}
                            onClick={() => openEditQuestion(q)}
                            title="Edit Question"
                            className="p-2 rounded-lg border border-white/10 bg-slate-800 text-amber-300 hover:bg-slate-700 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            data-testid={`delete-question-${q.id}`}
                            onClick={() => handleDeleteQuestion(q.id)}
                            title="Delete Question"
                            className="p-2 rounded-lg border border-white/10 bg-slate-800 text-rose-400 hover:bg-rose-950/60 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CREATE / EDIT QUESTION FORM */}
          {tab === 'editor' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base sm:text-lg font-bold text-white">
                  {editingOriginalId ? `Editing ${editingOriginalId}` : 'Create New Question'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowEditorPreview((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-400/40 bg-sky-500/15 text-xs font-semibold text-sky-300 hover:bg-sky-500/25"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{showEditorPreview ? 'Hide Preview' : 'Teacher Preview'}</span>
                </button>
              </div>

              {editorErrors.length > 0 && (
                <div
                  data-testid="editor-validation-errors"
                  className="rounded-xl border border-rose-400/50 bg-rose-950/60 p-3.5 text-xs text-rose-200 space-y-1"
                >
                  <div className="font-bold flex items-center gap-1.5 text-rose-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Please fix the following before saving:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {editorErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {showEditorPreview && (
                <div className="rounded-xl border border-sky-400/40 bg-slate-900/90 p-4 space-y-2 text-xs">
                  <div className="font-semibold text-sky-300 uppercase tracking-wide">
                    Live Preview ({draft.subjectName || selectedEditorSubject?.name} ·{' '}
                    {draft.topic || 'Topic'})
                  </div>
                  <div className="text-sm font-bold text-white">
                    {draft.questionText || '(Question text will appear here)'}
                  </div>
                  <div className="text-emerald-300 font-mono-hud">
                    Teacher Answer Key: {draft.correctAnswer || 'None'} · +{draft.points || 0} pts
                  </div>
                  {draft.explanation && (
                    <div className="text-slate-300">Explanation: {draft.explanation}</div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Question ID *
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={draft.id}
                      onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                      data-testid="editor-id-input"
                      placeholder="e.g. MATH-301"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs font-mono-hud text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          id: suggestNextQuestionId(
                            database.questions,
                            selectedEditorSubject?.name || 'QUES',
                          ),
                        })
                      }
                      className="px-2.5 py-2 rounded-lg bg-slate-800 border border-white/15 text-[11px] text-slate-200 hover:bg-slate-700 shrink-0"
                    >
                      Auto
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Subject *
                  </label>
                  <select
                    value={draft.subjectId}
                    data-testid="editor-subject-select"
                    onChange={(e) => {
                      const nextSubj = database.subjects.find((s) => s.id === e.target.value);
                      setDraft({
                        ...draft,
                        subjectId: e.target.value,
                        subjectName: nextSubj?.name || '',
                        topic: nextSubj?.topics[0] || draft.topic,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {database.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Question Type *
                  </label>
                  <select
                    value={draft.type}
                    data-testid="editor-type-select"
                    onChange={(e) => {
                      const nextType = e.target.value as QuestionType;
                      setDraft({
                        ...draft,
                        type: nextType,
                        optionA: nextType === 'true_false' ? 'True' : draft.optionA,
                        optionB: nextType === 'true_false' ? 'False' : draft.optionB,
                        correctAnswer:
                          nextType === 'true_false' &&
                          draft.correctAnswer !== 'A' &&
                          draft.correctAnswer !== 'B'
                            ? 'A'
                            : draft.correctAnswer,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="true_false">True / False</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Topic *
                  </label>
                  <input
                    type="text"
                    list="editor-topic-suggestions"
                    value={draft.topic}
                    onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
                    data-testid="editor-topic-input"
                    placeholder="Select or type a topic..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <datalist id="editor-topic-suggestions">
                    {(selectedEditorSubject?.topics || []).map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Question Set *
                  </label>
                  <select
                    value={draft.questionSetId}
                    data-testid="editor-set-select"
                    onChange={(e) => setDraft({ ...draft, questionSetId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {database.questionSets.map((qs) => (
                      <option key={qs.id} value={qs.id}>
                        {qs.name} {qs.isActive ? '(Active)' : '(Inactive)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Question Status
                  </label>
                  <select
                    value={draft.status || 'active'}
                    data-testid="editor-status-select"
                    onChange={(e) =>
                      setDraft({ ...draft, status: e.target.value as 'active' | 'inactive' })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="active">Active (Visible in 3D World)</option>
                    <option value="inactive">Inactive (Hidden from Students)</option>
                  </select>
                </div>
              </div>

              {selectedEditorSubject && selectedEditorSubject.topics.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Saved topics:</span>
                  {selectedEditorSubject.topics.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDraft({ ...draft, topic: t })}
                      className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                        draft.topic === t
                          ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                          : 'border-white/10 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                  <div className="inline-flex items-center gap-1 ml-1">
                    <input
                      type="text"
                      value={customTopicInput}
                      onChange={(e) => setCustomTopicInput(e.target.value)}
                      placeholder="New topic..."
                      className="w-28 px-2 py-0.5 rounded bg-slate-900 border border-white/15 text-[11px] text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = customTopicInput.trim();
                        if (!clean) return;
                        setDraft({ ...draft, topic: clean });
                        setCustomTopicInput('');
                      }}
                      className="px-2 py-0.5 rounded bg-slate-800 border border-white/15 text-[11px] text-amber-300 hover:bg-slate-700"
                    >
                      Use
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Question Text *
                </label>
                <textarea
                  rows={3}
                  value={draft.questionText}
                  onChange={(e) => setDraft({ ...draft, questionText: e.target.value })}
                  data-testid="editor-question-text"
                  placeholder="Enter the educational question students will see in the 3D city..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Answer Option A *
                  </label>
                  <input
                    type="text"
                    value={draft.optionA}
                    onChange={(e) => setDraft({ ...draft, optionA: e.target.value })}
                    data-testid="editor-option-a"
                    placeholder={draft.type === 'true_false' ? 'True' : 'Option A'}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Answer Option B *
                  </label>
                  <input
                    type="text"
                    value={draft.optionB}
                    onChange={(e) => setDraft({ ...draft, optionB: e.target.value })}
                    data-testid="editor-option-b"
                    placeholder={draft.type === 'true_false' ? 'False' : 'Option B'}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                {draft.type === 'multiple_choice' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Answer Option C *
                      </label>
                      <input
                        type="text"
                        value={draft.optionC}
                        onChange={(e) => setDraft({ ...draft, optionC: e.target.value })}
                        data-testid="editor-option-c"
                        placeholder="Option C"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Answer Option D *
                      </label>
                      <input
                        type="text"
                        value={draft.optionD}
                        onChange={(e) => setDraft({ ...draft, optionD: e.target.value })}
                        data-testid="editor-option-d"
                        placeholder="Option D"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Correct Answer *
                  </label>
                  <select
                    value={draft.correctAnswer}
                    data-testid="editor-correct-select"
                    onChange={(e) =>
                      setDraft({ ...draft, correctAnswer: e.target.value as AnswerKey })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs font-mono-hud text-emerald-300 focus:outline-none focus:border-amber-400"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    {draft.type === 'multiple_choice' && <option value="C">C</option>}
                    {draft.type === 'multiple_choice' && <option value="D">D</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={draft.difficulty}
                    data-testid="editor-difficulty-select"
                    onChange={(e) =>
                      setDraft({ ...draft, difficulty: e.target.value as QuestionDifficulty })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="easy">Easy (10 KP)</option>
                    <option value="medium">Medium (20 KP)</option>
                    <option value="hard">Hard (30 KP)</option>
                    <option value="special">Special Challenge (50 KP)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Point Value *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={Number.isNaN(draft.points) ? '' : draft.points}
                    data-testid="editor-points-input"
                    onChange={(e) =>
                      setDraft({ ...draft, points: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs font-mono-hud text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Building Category
                  </label>
                  <select
                    value={draft.buildingCategory}
                    data-testid="editor-category-select"
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        buildingCategory: e.target.value as PlacementCategory,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {BUILDING_CATEGORIES.map((bc) => (
                      <option key={bc.value} value={bc.value}>
                        {bc.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Floor (Optional)
                  </label>
                  <select
                    value={draft.floorPlacement === null ? '' : String(draft.floorPlacement)}
                    data-testid="editor-floor-select"
                    onChange={(e) => {
                      const raw = e.target.value;
                      const parsed = Number(raw);
                      setDraft({
                        ...draft,
                        floorPlacement:
                          raw !== '' && Number.isInteger(parsed) && parsed >= 1 && parsed <= 22
                            ? (parsed as FloorPlacement)
                            : null,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">Any Floor</option>
                    {Array.from({ length: 22 }, (_, i) => i + 1).map((fl) => (
                      <option key={fl} value={String(fl)}>
                        {fl === 22 ? 'Floor 22 (Rooftop)' : `Floor ${fl}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Explanation After Answering
                </label>
                <textarea
                  rows={2}
                  value={draft.explanation}
                  onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
                  data-testid="editor-explanation-input"
                  placeholder="Shown to the student after answering correctly..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingOriginalId(null);
                    setTab('questions');
                  }}
                  className="px-4 py-2 rounded-lg border border-white/15 bg-slate-800 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="editor-save-btn"
                  onClick={handleSaveQuestion}
                  className="px-5 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs sm:text-sm hover:bg-emerald-400 transition-colors"
                >
                  {editingOriginalId ? 'Save Changes' : 'Add Question to Bank'}
                </button>
              </div>
            </div>
          )}

          {/* SECTION 2: SUBJECT MANAGEMENT */}
          {tab === 'subjects' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-white/15 bg-slate-900/80 p-4 space-y-3">
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Add Custom Subject</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    data-testid="new-subject-name-input"
                    placeholder="Subject name (e.g. Physics, Music)"
                    className="px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={newSubjectTopicsRaw}
                    onChange={(e) => setNewSubjectTopicsRaw(e.target.value)}
                    data-testid="new-subject-topics-input"
                    placeholder="Starter topics (comma separated)"
                    className="px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {SUBJECT_COLOR_SWATCHES.slice(0, 6).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewSubjectColor(c)}
                          aria-label={`Color ${c}`}
                          className={`w-5 h-5 rounded-full border-2 ${
                            newSubjectColor === c ? 'border-white scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      data-testid="add-subject-btn"
                      onClick={handleAddSubject}
                      className="px-3.5 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 shrink-0"
                    >
                      Add Subject
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {database.subjects.map((subj) => {
                  const qCount = database.questions.filter((q) => q.subjectId === subj.id).length;
                  const isEditingName = editingSubjectId === subj.id;
                  return (
                    <div
                      key={subj.id}
                      data-testid={`subject-card-${subj.id}`}
                      className="rounded-xl border border-white/10 bg-slate-900/75 p-4 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: subj.color }}
                        />
                        {isEditingName ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingSubjectName}
                              onChange={(e) => setEditingSubjectName(e.target.value)}
                              className="px-2 py-1 rounded bg-slate-950 border border-amber-400 text-xs text-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleRenameSubject(subj.id)}
                              className="px-2 py-1 rounded bg-emerald-500 text-slate-950 text-[11px] font-semibold"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <h4 className="font-display text-sm font-bold text-white truncate">
                              {subj.name}
                            </h4>
                            <div className="text-[11px] text-slate-400">
                              {qCount} questions · {subj.topics.length} topics
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSubjectId(subj.id);
                            setEditingSubjectName(subj.name);
                          }}
                          title="Rename Subject"
                          className="p-1.5 rounded bg-slate-800 text-amber-300 hover:bg-slate-700"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubject(subj.id)}
                          title="Delete Subject"
                          className="p-1.5 rounded bg-slate-800 text-rose-400 hover:bg-rose-950/60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 3: TOPIC MANAGEMENT */}
          {tab === 'topics' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    Curriculum Topic Management
                  </h3>
                  <p className="text-xs text-slate-400">
                    Organize and curate topics inside each subject for cleaner terminal filtering.
                  </p>
                </div>
                <select
                  value={topicSubjectFilter}
                  onChange={(e) => setTopicSubjectFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-xs text-white"
                >
                  <option value="all">All Subjects</option>
                  {database.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {database.subjects
                  .filter((s) => topicSubjectFilter === 'all' || s.id === topicSubjectFilter)
                  .map((subj) => (
                    <div
                      key={subj.id}
                      className="rounded-xl border border-white/10 bg-slate-900/75 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: subj.color }}
                          />
                          <h4 className="font-display text-sm font-bold text-white">
                            {subj.name}
                          </h4>
                        </div>
                        <span className="text-[11px] font-mono-hud text-slate-400">
                          {subj.topics.length} topics
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {subj.topics.map((topic) => {
                          const topicQs = database.questions.filter(
                            (q) => q.subjectId === subj.id && q.topic === topic,
                          ).length;
                          return (
                            <span
                              key={topic}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-white/10 text-xs text-slate-200"
                            >
                              <span>{topic}</span>
                              <span className="text-[10px] font-mono-hud text-slate-400">
                                ({topicQs})
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTopicFromSubject(subj.id, topic)}
                                aria-label={`Remove topic ${topic}`}
                                className="text-slate-400 hover:text-rose-400"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>

                      <div className="flex gap-1.5 pt-1">
                        <input
                          type="text"
                          value={topicInputsBySubject[subj.id] || ''}
                          onChange={(e) =>
                            setTopicInputsBySubject((prev) => ({
                              ...prev,
                              [subj.id]: e.target.value,
                            }))
                          }
                          placeholder={`Add topic to ${subj.name}...`}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddTopicToSubject(subj.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/15 text-xs font-semibold text-amber-300 hover:bg-slate-700"
                        >
                          + Add Topic
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* SECTION 4: BULK IMPORT */}
          {tab === 'import' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    Question Import (CSV / Excel &amp; JSON)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Download a starter template, upload a file, or paste rows below to validate before importing.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        'urban_life_questions_template.csv',
                        generateCsvTemplate(),
                        'text/csv;charset=utf-8;',
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-slate-800 text-xs font-semibold text-emerald-300 hover:bg-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV / Excel Template</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        'urban_life_questions_template.json',
                        generateJsonTemplate(),
                        'application/json;charset=utf-8;',
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-slate-800 text-xs font-semibold text-sky-300 hover:bg-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON Template</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-white/10 bg-slate-900/80 p-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Import Format
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['csv', 'json'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setImportFormat(fmt)}
                        className={`py-1.5 rounded-lg border text-xs font-semibold uppercase ${
                          importFormat === fmt
                            ? 'border-amber-400 bg-amber-500 text-slate-950'
                            : 'border-white/10 bg-slate-800 text-slate-300'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Target Question Set
                  </label>
                  <select
                    value={importTargetSetId}
                    onChange={(e) => setImportTargetSetId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-white"
                  >
                    {database.questionSets.map((qs) => (
                      <option key={qs.id} value={qs.id}>
                        {qs.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Upload File (.csv or .json)
                  </label>
                  <label className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-amber-400/50 bg-slate-950 text-xs font-semibold text-amber-300 hover:bg-slate-800 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose File</span>
                    <input
                      type="file"
                      accept=".csv,.json,text/csv,application/json"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Paste {importFormat.toUpperCase()} Data
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setImportRawText(
                        importFormat === 'csv' ? generateCsvTemplate() : generateJsonTemplate(),
                      )
                    }
                    className="text-[11px] text-amber-300 hover:underline"
                  >
                    Load Sample {importFormat.toUpperCase()}
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={importRawText}
                  onChange={(e) => setImportRawText(e.target.value)}
                  data-testid="bulk-import-textarea"
                  placeholder={
                    importFormat === 'csv'
                      ? 'id,subject,topic,type,questionText,optionA,optionB,optionC,optionD,correctAnswer,explanation,difficulty,points,buildingCategory,floorPlacement'
                      : '[{"id":"MATH-201","subject":"Mathematics","topic":"Addition",...}]'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 font-mono-hud text-[11px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  data-testid="bulk-validate-btn"
                  onClick={handleValidateImport}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors"
                >
                  Preview &amp; Validate
                </button>
              </div>

              {importPreview && (
                <div
                  data-testid="bulk-import-preview"
                  className="rounded-xl border border-white/15 bg-slate-900/90 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-xs font-mono-hud">
                      <span className="text-slate-300">Rows: {importPreview.totalRows}</span>
                      <span className="text-emerald-400 font-bold">
                        Valid: {importPreview.validRows.length}
                      </span>
                      <span
                        className={
                          importPreview.errors.length > 0
                            ? 'text-rose-400 font-bold'
                            : 'text-slate-400'
                        }
                      >
                        Errors: {importPreview.errors.length}
                      </span>
                    </div>

                    {importPreview.validRows.length > 0 && (
                      <button
                        type="button"
                        data-testid="bulk-commit-btn"
                        onClick={handleCommitImport}
                        className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 transition-colors"
                      >
                        Import {importPreview.validRows.length} Valid Question
                        {importPreview.validRows.length === 1 ? '' : 's'}
                      </button>
                    )}
                  </div>

                  {importPreview.errors.length > 0 && (
                    <div
                      data-testid="bulk-import-errors"
                      className="rounded-lg border border-rose-400/40 bg-rose-950/50 p-3 space-y-1.5 text-xs text-rose-200 max-h-44 overflow-y-auto"
                    >
                      {importPreview.errors.map((err, idx) => (
                        <div key={idx}>
                          <span className="font-mono-hud font-bold text-rose-300">
                            Row {err.rowNumber} ({err.questionId}):{' '}
                          </span>
                          <span>{err.messages.join(' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {importPreview.validRows.length > 0 && (
                    <div className="space-y-1.5 text-xs">
                      <div className="font-semibold text-emerald-300">Ready to Import:</div>
                      {importPreview.validRows.slice(0, 6).map((row) => (
                        <div
                          key={row.id}
                          className="flex items-center justify-between gap-2 px-3 py-1.5 rounded bg-slate-800/80 border border-white/10"
                        >
                          <span className="truncate text-white">
                            <span className="font-mono-hud text-amber-300 mr-2">{row.id}</span>
                            {row.questionText}
                          </span>
                          <span className="text-slate-400 shrink-0">
                            {row.subjectName} · +{row.points} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION 5: BUILDING PLACEMENT SETTINGS & QUESTION SETS */}
          {tab === 'placement' && (
            <div className="space-y-6">
              {/* Building Category Overview & Reassignment */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    3D Building &amp; Floor Placement Settings
                  </h3>
                  <p className="text-xs text-slate-400">
                    Control which building categories and floors host each educational question terminal across the city.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                  {BUILDING_CATEGORIES.map((bc) => {
                    const count = database.questions.filter(
                      (q) =>
                        q.status !== 'inactive' &&
                        activeSetIds.has(q.questionSetId) &&
                        q.buildingCategory === bc.value,
                    ).length;
                    return (
                      <div
                        key={bc.value}
                        className="rounded-xl border border-white/10 bg-slate-900/80 p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-amber-300 capitalize">
                            {bc.value}
                          </span>
                          <span className="font-mono-hud text-xs font-semibold text-emerald-300">
                            {count} Active
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 leading-snug">{bc.desc}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/75 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/10 text-xs font-semibold text-slate-200 flex items-center justify-between">
                    <span>Quick Placement Assignment ({database.questions.length} Questions)</span>
                    <span className="text-[11px] text-slate-400">
                      Updates apply immediately in 3D world
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                    {database.questions.map((q) => (
                      <div
                        key={q.id}
                        className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono-hud text-amber-300 mr-2">{q.id}</span>
                          <span className="text-white font-medium">{q.questionText}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={q.buildingCategory}
                            onChange={(e) =>
                              handleReassignQuestionPlacement(
                                q.id,
                                e.target.value as PlacementCategory,
                                q.floorPlacement,
                              )
                            }
                            aria-label={`Category for ${q.id}`}
                            className="px-2 py-1 rounded bg-slate-950 border border-white/15 text-[11px] text-white"
                          >
                            {BUILDING_CATEGORIES.map((bc) => (
                              <option key={bc.value} value={bc.value}>
                                {bc.value}
                              </option>
                            ))}
                          </select>
                          <select
                            value={q.floorPlacement === null ? '' : String(q.floorPlacement)}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const parsed = Number(raw);
                              handleReassignQuestionPlacement(
                                q.id,
                                q.buildingCategory,
                                raw !== '' && Number.isInteger(parsed) && parsed >= 1 && parsed <= 22
                                  ? (parsed as FloorPlacement)
                                  : null,
                              );
                            }}
                            aria-label={`Floor for ${q.id}`}
                            className="px-2 py-1 rounded bg-slate-950 border border-white/15 text-[11px] text-white"
                          >
                            <option value="">Any Floor</option>
                            {Array.from({ length: 22 }, (_, i) => i + 1).map((fl) => (
                              <option key={fl} value={String(fl)}>
                                {fl === 22 ? 'Floor 22 (Rooftop)' : `Floor ${fl}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Question Sets Management */}
              <div className="space-y-3 border-t border-white/10 pt-5">
                <h3 className="font-display text-sm font-bold text-white">
                  Question Sets (Activate / Deactivate in 3D World)
                </h3>

                <div className="rounded-xl border border-white/15 bg-slate-900/80 p-3.5 space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSetName}
                      onChange={(e) => setNewSetName(e.target.value)}
                      data-testid="new-set-name-input"
                      placeholder="New question set title..."
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-white"
                    />
                    <button
                      type="button"
                      data-testid="add-set-btn"
                      onClick={handleCreateSet}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Create</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newSetDesc}
                    onChange={(e) => setNewSetDesc(e.target.value)}
                    placeholder="Optional short description..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-white/15 text-xs text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {database.questionSets.map((qs) => {
                    const count = database.questions.filter(
                      (q) => q.questionSetId === qs.id,
                    ).length;
                    return (
                      <div
                        key={qs.id}
                        data-testid={`question-set-card-${qs.id}`}
                        className="rounded-xl border border-white/10 bg-slate-900/75 p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-sm font-bold text-white truncate">
                              {qs.name}
                            </span>
                            <span className="text-[11px] font-mono-hud text-slate-400">
                              {count} Qs
                            </span>
                          </div>
                          {qs.description && (
                            <div className="text-xs text-slate-400 mt-0.5">{qs.description}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            data-testid={`toggle-set-${qs.id}`}
                            onClick={() => handleToggleSetActive(qs.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              qs.isActive
                                ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                                : 'border-white/15 bg-slate-800 text-slate-400'
                            }`}
                          >
                            {qs.isActive ? 'Active' : 'Inactive'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSet(qs.id)}
                            title="Delete Question Set"
                            className="p-2 rounded-lg bg-slate-800 border border-white/10 text-rose-400 hover:bg-rose-950/60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: REWARD CONFIGURATION, KP ECONOMY, SHOP & SOCIAL MODERATION */}
          {tab === 'rewards' && (
            <div className="max-w-4xl mx-auto space-y-5">
              <div>
                <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>Knowledge Points (KP), Reward Shop &amp; Social Rules</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure KP rewards by difficulty, Challenge Mode, Reward Shop pricing, and student safety permissions enforced server-side.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* KP Difficulty Rewards & Quiz Rules */}
                <div className="rounded-xl border border-white/15 bg-slate-900/80 p-4 space-y-3.5 text-xs">
                  <div className="font-display text-sm font-bold text-amber-300">
                    Knowledge Point (KP) Rewards
                  </div>

                  <label className="flex items-start justify-between gap-3 cursor-pointer">
                    <div>
                      <div className="font-semibold text-white">Use Difficulty KP Table</div>
                      <div className="text-slate-400 mt-0.5">
                        Award server-verified KP based on question difficulty instead of fixed question points.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={database.teacherConfig.useDifficultyKpTable !== false}
                      onChange={(e) =>
                        void onUpdateDatabase({
                          ...database,
                          teacherConfig: {
                            ...database.teacherConfig,
                            useDifficultyKpTable: e.target.checked,
                          },
                        })
                      }
                      className="mt-1 accent-amber-500 w-4 h-4"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2.5 border-t border-white/10 pt-3">
                    {(
                      [
                        { key: 'easy', label: 'Easy (KP)' },
                        { key: 'medium', label: 'Medium (KP)' },
                        { key: 'hard', label: 'Hard (KP)' },
                        { key: 'special', label: 'Special (KP)' },
                      ] as const
                    ).map((row) => {
                      const currentRewards = {
                        ...DEFAULT_KP_DIFFICULTY_REWARDS,
                        ...(database.teacherConfig.kpRewards || {}),
                      };
                      return (
                        <div key={row.key}>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            {row.label}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={1000}
                            data-testid={`teacher-kp-${row.key}`}
                            value={currentRewards[row.key]}
                            onChange={(e) =>
                              void onUpdateDatabase({
                                ...database,
                                teacherConfig: {
                                  ...database.teacherConfig,
                                  kpRewards: {
                                    ...currentRewards,
                                    [row.key]: Math.max(1, Math.min(1000, Number(e.target.value) || 1)),
                                  },
                                },
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 font-mono-hud text-white"
                          />
                        </div>
                      );
                    })}
                  </div>

                  <label className="flex items-start justify-between gap-3 cursor-pointer border-t border-white/10 pt-3">
                    <div>
                      <div className="font-semibold text-white">Allow Retry on Wrong Answer</div>
                      <div className="text-slate-400 mt-0.5">
                        If disabled, students get 1 attempt per terminal question.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={database.teacherConfig.allowRetryOnWrong}
                      onChange={(e) =>
                        void onUpdateDatabase({
                          ...database,
                          teacherConfig: {
                            ...database.teacherConfig,
                            allowRetryOnWrong: e.target.checked,
                          },
                        })
                      }
                      className="mt-1 accent-amber-500 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-start justify-between gap-3 cursor-pointer border-t border-white/10 pt-3">
                    <div>
                      <div className="font-semibold text-white">Award City Cash Bonus</div>
                      <div className="text-slate-400 mt-0.5">
                        Correct answers also grant city dollars for vehicles.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={database.teacherConfig.awardCityCashBonus}
                      onChange={(e) =>
                        void onUpdateDatabase({
                          ...database,
                          teacherConfig: {
                            ...database.teacherConfig,
                            awardCityCashBonus: e.target.checked,
                          },
                        })
                      }
                      className="mt-1 accent-amber-500 w-4 h-4"
                    />
                  </label>

                  <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                    <div>
                      <div className="font-semibold text-white">City Cash per KP</div>
                      <div className="text-slate-400">Multiplier for in-game cash</div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={database.teacherConfig.cashPerPoint}
                      onChange={(e) =>
                        void onUpdateDatabase({
                          ...database,
                          teacherConfig: {
                            ...database.teacherConfig,
                            cashPerPoint: Math.max(0, Math.min(20, Number(e.target.value) || 0)),
                          },
                        })
                      }
                      className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 font-mono-hud text-white text-center"
                    />
                  </div>

                  <label className="flex items-start justify-between gap-3 cursor-pointer border-t border-white/10 pt-3">
                    <div>
                      <div className="font-semibold text-white">
                        Show Explanation on Final Wrong Lockout
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        Only applies when retries are disabled.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={database.teacherConfig.showExplanationOnWrong}
                      onChange={(e) =>
                        void onUpdateDatabase({
                          ...database,
                          teacherConfig: {
                            ...database.teacherConfig,
                            showExplanationOnWrong: e.target.checked,
                          },
                        })
                      }
                      className="mt-1 accent-amber-500 w-4 h-4"
                    />
                  </label>
                </div>

                {/* Challenge Mode & Social Moderation Permissions */}
                <div className="rounded-xl border border-white/15 bg-slate-900/80 p-4 space-y-3.5 text-xs">
                  <div className="font-display text-sm font-bold text-sky-300">
                    Challenge Mode &amp; Social Moderation
                  </div>

                  {(() => {
                    const chCfg = {
                      ...DEFAULT_CHALLENGE_SETTINGS,
                      ...(database.teacherConfig.challengeConfig || {}),
                    };
                    const socCfg = {
                      ...DEFAULT_SOCIAL_CONFIG,
                      ...(database.teacherConfig.socialConfig || {}),
                    };
                    return (
                      <>
                        <div className="space-y-2.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Active Challenge Mode
                            </label>
                            <select
                              value={chCfg.mode}
                              data-testid="teacher-challenge-mode"
                              onChange={(e) =>
                                void onUpdateDatabase({
                                  ...database,
                                  teacherConfig: {
                                    ...database.teacherConfig,
                                    challengeConfig: {
                                      ...chCfg,
                                      mode: e.target.value as ChallengeModeKind,
                                    },
                                  },
                                })
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 text-white"
                            >
                              <option value="none">Free Exploration (No Challenge)</option>
                              <option value="knowledge_race">Knowledge Race (Fastest KP)</option>
                              <option value="team_exploration">Team Exploration Challenge</option>
                              <option value="city_tower_challenge">CITY TOWER 22F Ascent</option>
                              <option value="subject_challenge">Subject-Specific Challenge</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                Challenge Title
                              </label>
                              <input
                                type="text"
                                value={chCfg.title}
                                onChange={(e) =>
                                  void onUpdateDatabase({
                                    ...database,
                                    teacherConfig: {
                                      ...database.teacherConfig,
                                      challengeConfig: { ...chCfg, title: e.target.value },
                                    },
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                Target Questions
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={chCfg.targetQuestions}
                                onChange={(e) =>
                                  void onUpdateDatabase({
                                    ...database,
                                    teacherConfig: {
                                      ...database.teacherConfig,
                                      challengeConfig: {
                                        ...chCfg,
                                        targetQuestions: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                                      },
                                    },
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 font-mono-hud text-white"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-white/10 pt-3 space-y-2.5">
                          {(
                            [
                              { key: 'chatEnabled', label: 'Enable Filtered Student Chat' },
                              { key: 'groupsEnabled', label: 'Allow Exploration Groups (Max 5)' },
                              { key: 'emoteWheelEnabled', label: 'Allow Character Emotes' },
                              { key: 'leaderboardVisible', label: 'Show Live Challenge Leaderboard' },
                              { key: 'groupMinimapMarkers', label: 'Show Group Members on Minimap' },
                            ] as const
                          ).map((toggle) => (
                            <label
                              key={toggle.key}
                              className="flex items-center justify-between gap-3 cursor-pointer"
                            >
                              <span className="font-semibold text-white">{toggle.label}</span>
                              <input
                                type="checkbox"
                                checked={socCfg[toggle.key]}
                                onChange={(e) =>
                                  void onUpdateDatabase({
                                    ...database,
                                    teacherConfig: {
                                      ...database.teacherConfig,
                                      socialConfig: {
                                        ...socCfg,
                                        [toggle.key]: e.target.checked,
                                      },
                                    },
                                  })
                                }
                                className="accent-sky-400 w-4 h-4"
                              />
                            </label>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Reward Shop Item Pricing & Availability */}
              <div className="rounded-xl border border-white/15 bg-slate-900/80 p-4 space-y-3">
                <div>
                  <div className="font-display text-sm font-bold text-white">
                    Reward Shop Pricing &amp; Item Availability
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Customize KP costs or disable specific outfits, accessories, and character presets in CITY REWARD CENTER.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                  {REWARD_SHOP_CATALOG.filter((item) => !item.starterOwned).map((item) => {
                    const ov = database.teacherConfig.shopItemOverrides?.[item.id];
                    const effectivePrice = typeof ov?.priceKp === 'number' ? ov.priceKp : item.priceKp;
                    const effectiveEnabled = typeof ov?.enabled === 'boolean' ? ov.enabled : item.enabled;
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-white/10 bg-slate-950/75 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-400 capitalize">{item.category}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={0}
                            max={1000}
                            aria-label={`${item.name} KP price`}
                            value={effectivePrice}
                            onChange={(e) => {
                              const nextPrice = Math.max(0, Math.min(1000, Number(e.target.value) || 0));
                              void onUpdateDatabase({
                                ...database,
                                teacherConfig: {
                                  ...database.teacherConfig,
                                  shopItemOverrides: {
                                    ...(database.teacherConfig.shopItemOverrides || {}),
                                    [item.id]: {
                                      enabled: effectiveEnabled,
                                      priceKp: nextPrice,
                                    },
                                  },
                                },
                              });
                            }}
                            className="w-16 px-2 py-1 rounded bg-slate-900 border border-white/15 font-mono-hud text-amber-300 text-center"
                          />
                          <input
                            type="checkbox"
                            title="Available in Reward Shop"
                            checked={effectiveEnabled}
                            onChange={(e) =>
                              void onUpdateDatabase({
                                ...database,
                                teacherConfig: {
                                  ...database.teacherConfig,
                                  shopItemOverrides: {
                                    ...(database.teacherConfig.shopItemOverrides || {}),
                                    [item.id]: {
                                      priceKp: effectivePrice,
                                      enabled: e.target.checked,
                                    },
                                  },
                                },
                              })
                            }
                            className="accent-emerald-400 w-4 h-4"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Moderation Reports Log */}
              <div className="rounded-xl border border-white/15 bg-slate-900/80 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display text-sm font-bold text-white">
                    Student Moderation Reports ({moderationReports.length})
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshTeacherMetadata()}
                    className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>
                {moderationReports.length === 0 ? (
                  <div className="text-xs text-slate-400">No student reports logged.</div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
                    {moderationReports.map((rep) => (
                      <div
                        key={rep.id}
                        className="rounded-lg border border-rose-400/30 bg-rose-950/30 px-3 py-2 flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            {rep.reporterName} reported {rep.targetName}
                          </div>
                          <div className="text-slate-300 text-[11px]">{rep.reason}</div>
                          {rep.messageExcerpt && (
                            <div className="text-rose-200 text-[11px] italic mt-0.5">
                              &ldquo;{rep.messageExcerpt}&rdquo;
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-mono-hud text-slate-400 shrink-0">
                          {new Date(rep.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-rose-400/25 bg-rose-950/25 p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Restore Starter Question Bank
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Resets subjects, sets, and questions back to starter defaults.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void Promise.resolve(onResetToDefaults()).then(() => {
                      showNotice('Restored starter Question Bank defaults.');
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-400/40 bg-rose-500/15 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>
              </div>
            </div>
          )}

          {/* SECTION 7: MULTIPLAYER SESSION MANAGEMENT */}
          {tab === 'sessions' && (
            <div className="space-y-5">
              <form
                onSubmit={handleCreateSession}
                className="rounded-xl border border-white/15 bg-slate-900/80 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-white flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-sky-400" />
                    <span>Create Classroom Multiplayer Session</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => void refreshSessionsAndProgress(false)}
                    className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Session Name *
                    </label>
                    <input
                      type="text"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      data-testid="session-create-name"
                      placeholder="e.g. Grade 7 Math Explore"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={newSessionSubject}
                      onChange={(e) => setNewSessionSubject(e.target.value)}
                      placeholder="Mathematics"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Question Set
                    </label>
                    <select
                      value={newSessionSetId}
                      onChange={(e) => setNewSessionSetId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-white"
                    >
                      {database.questionSets.map((qs) => (
                        <option key={qs.id} value={qs.id}>
                          {qs.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Custom Join Code (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={newSessionCode}
                      onChange={(e) => setNewSessionCode(e.target.value.toUpperCase())}
                      placeholder="Auto (e.g. URB482)"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono-hud text-xs uppercase text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Max Capacity
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={30}
                      value={newSessionMaxPlayers}
                      onChange={(e) => setNewSessionMaxPlayers(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono-hud text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={newSessionDuration}
                      onChange={(e) => setNewSessionDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono-hud text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2 flex gap-2">
                    <input
                      type="text"
                      value={newSessionObjectives}
                      onChange={(e) => setNewSessionObjectives(e.target.value)}
                      placeholder="Exploration objectives for students..."
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-white"
                    />
                    <button
                      type="submit"
                      data-testid="session-create-submit"
                      className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs hover:bg-sky-400 shrink-0"
                    >
                      Create Session
                    </button>
                  </div>
                </div>
              </form>

              {sessions.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-8 text-center text-xs text-slate-400">
                  No classroom sessions created yet. Create a session above to generate a live Join Code.
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map(({ session, players, onlineCount }) => (
                    <div
                      key={session.id}
                      data-testid={`teacher-session-card-${session.id}`}
                      className="rounded-xl border border-white/15 bg-slate-900/75 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-sm sm:text-base font-bold text-white">
                              {session.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyJoinCode(session.joinCode)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-amber-400/40 font-mono-hud text-xs font-bold text-amber-300 hover:bg-slate-700"
                            >
                              <span>{session.joinCode}</span>
                              {copiedCode === session.joinCode ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                session.status === 'active'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : session.status === 'paused'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : session.status === 'waiting'
                                      ? 'bg-sky-500/20 text-sky-300'
                                      : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {session.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                            <span>{session.subject}</span>
                            <span className="inline-flex items-center gap-1 font-mono-hud text-slate-200">
                              <Users className="w-3 h-3 text-sky-400" />
                              {onlineCount}/{session.maxPlayers} online
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono-hud text-amber-300">
                              <Clock className="w-3 h-3" />
                              {formatTimer(session.remainingSeconds)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {(session.status === 'waiting' || session.status === 'paused') && (
                            <button
                              type="button"
                              onClick={() => void handleSessionStatusChange(session.id, 'active')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>{session.status === 'paused' ? 'Resume' : 'Start'}</span>
                            </button>
                          )}
                          {session.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => void handleSessionStatusChange(session.id, 'paused')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 text-amber-300 font-semibold text-xs hover:bg-amber-500/25"
                            >
                              <Pause className="w-3.5 h-3.5" />
                              <span>Pause</span>
                            </button>
                          )}
                          {session.status !== 'ended' && (
                            <button
                              type="button"
                              onClick={() => void handleSessionStatusChange(session.id, 'ended')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 text-rose-300 font-semibold text-xs hover:bg-rose-500/25"
                            >
                              <Square className="w-3 h-3 fill-current" />
                              <span>End</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleDeleteSession(session.id)}
                            title="Delete Session"
                            className="p-1.5 rounded-lg border border-white/10 bg-slate-800 text-rose-400 hover:bg-rose-950/60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {players.length > 0 && (
                        <div className="border-t border-white/10 pt-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {players.map((p) => (
                            <div
                              key={p.playerId}
                              className="rounded-lg bg-slate-950/70 border border-white/10 px-3 py-2 text-xs flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-white truncate flex items-center gap-1.5">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      p.connectionStatus === 'online'
                                        ? 'bg-emerald-400'
                                        : 'bg-slate-500'
                                    }`}
                                  />
                                  <span className="truncate">{p.displayName}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                  {p.currentBuilding
                                    ? `${p.currentBuilding} · F${p.currentFloor}`
                                    : p.currentActivity}
                                </div>
                              </div>
                              <div className="text-right font-mono-hud shrink-0">
                                <div className="text-emerald-300 font-semibold">
                                  {p.pointsEarned} pts
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {p.questionsCompleted} Qs
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 8: STUDENT PROGRESS MONITOR */}
          {tab === 'progress' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    Live Student Progress Monitor
                  </h3>
                  <p className="text-xs text-slate-400">
                    Real-time student locations, classroom activity, quiz completions, and points earned.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshSessionsAndProgress(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {studentProgress.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-8 text-center text-xs text-slate-400">
                  No active or recorded student participants yet. Students appear here as soon as they join a session or submit quiz answers.
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-slate-900/75 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/60">
                      <tr>
                        <th className="px-4 py-2.5">Student</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Session</th>
                        <th className="px-4 py-2.5">City Location</th>
                        <th className="px-4 py-2.5">Activity</th>
                        <th className="px-4 py-2.5 text-right">Solved</th>
                        <th className="px-4 py-2.5 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {studentProgress.map((sp) => (
                        <tr key={sp.uid} className="hover:bg-slate-800/40">
                          <td className="px-4 py-2.5 font-semibold text-white">
                            {sp.displayName}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                sp.connectionStatus === 'online'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : sp.connectionStatus === 'reconnecting'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {sp.connectionStatus}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-300">
                            {sp.sessionName || 'Solo / Free Roam'}
                          </td>
                          <td className="px-4 py-2.5 text-sky-300">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {sp.currentBuilding
                                ? `${sp.currentBuilding} (F${sp.currentFloor})`
                                : 'Open World'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-300">{sp.currentActivity}</td>
                          <td className="px-4 py-2.5 text-right font-mono-hud text-slate-200">
                            {sp.questionsCompleted}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono-hud font-bold text-emerald-400">
                            {sp.pointsEarned} pts
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SECTION 9: TEACHER ACCOUNT & SECURITY SETTINGS */}
          {tab === 'settings' && (
            <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Change Teacher PIN */}
              <form
                onSubmit={handleChangePin}
                className="rounded-xl border border-white/15 bg-slate-900/80 p-4 space-y-3"
              >
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Change Teacher Security PIN</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  PINs require at least 6 numeric digits and are stored as salted scrypt hashes on the server.
                </p>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Current PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={12}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono-hud text-sm tracking-widest text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    New PIN (6–12 digits)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={12}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono-hud text-sm tracking-widest text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Confirm New PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={12}
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono-hud text-sm tracking-widest text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 disabled:opacity-60"
                >
                  {savingSettings ? 'Updating...' : 'Update Teacher PIN'}
                </button>
              </form>

              {/* Authorized Teacher Accounts */}
              <div className="rounded-xl border border-white/15 bg-slate-900/80 p-4 space-y-3">
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Authorized Instructor Accounts</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Only Google accounts listed here can verify the Teacher PIN and access this dashboard.
                </p>

                <form onSubmit={handleAddTeacherEmail} className="flex gap-1.5">
                  <input
                    type="email"
                    value={newTeacherEmail}
                    onChange={(e) => setNewTeacherEmail(e.target.value)}
                    placeholder="co-teacher@school.edu"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-white"
                  />
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </form>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {teacherEmails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs"
                    >
                      <span className="inline-flex items-center gap-1.5 text-slate-200 truncate">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{email}</span>
                      </span>
                      {email.toLowerCase() === teacherEmail.toLowerCase() ? (
                        <span className="text-[10px] font-mono-hud text-amber-300 shrink-0">
                          Current
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleRemoveTeacherEmail(email)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                          title="Remove teacher access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
