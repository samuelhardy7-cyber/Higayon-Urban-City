import { useEffect, useState, type FC } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Coins,
  HelpCircle,
  Lock,
  RotateCcw,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { getPlacementTargetLabel } from '../game/questionPlacement';
import type {
  AnswerKey,
  PlayerQuestionChallenge,
  PlayerSubmissionOutcome,
} from '../game/questionTypes';

interface PlayerQuizModalProps {
  challenge: PlayerQuestionChallenge;
  onSubmitAnswer: (
    questionId: string,
    selectedAnswer: AnswerKey,
  ) => Promise<PlayerSubmissionOutcome>;
  onClose: () => void;
}

const DIFFICULTY_STYLES: Record<PlayerQuestionChallenge['difficulty'], string> = {
  easy: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10',
  medium: 'text-amber-300 border-amber-400/40 bg-amber-500/10',
  hard: 'text-rose-300 border-rose-400/40 bg-rose-500/10',
  special: 'text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-500/10',
};

const CATEGORY_LABELS: Record<PlayerQuestionChallenge['buildingCategory'], string> = {
  any: 'All City Locations',
  residential: 'Residential',
  commercial: 'Commercial',
  business: 'Business',
  industrial: 'Industrial',
};

export const PlayerQuizModal: FC<PlayerQuizModalProps> = ({
  challenge,
  onSubmitAnswer,
  onClose,
}) => {
  const [selected, setSelected] = useState<AnswerKey | null>(null);
  const [outcome, setOutcome] = useState<PlayerSubmissionOutcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
    setOutcome(null);
    setSubmitting(false);
    setSubmitError(null);
  }, [challenge.id]);

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onSubmitAnswer(challenge.id, selected);
      setOutcome(result);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setSelected(null);
    setOutcome(null);
    setSubmitError(null);
  };

  const floorLabel =
    challenge.floorPlacement !== null ? `Floor ${challenge.floorPlacement}` : 'Any Floor';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5"
      style={{ backgroundColor: 'rgba(9, 14, 24, 0.78)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-quiz-heading"
      data-testid="player-quiz-modal"
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/15 p-5 sm:p-6 shadow-2xl"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.97)' }}
      >
        {/* Top Metadata Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-white"
                style={{
                  borderColor: `${challenge.subjectColor}88`,
                  backgroundColor: `${challenge.subjectColor}22`,
                }}
                data-testid="quiz-subject-badge"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: challenge.subjectColor }}
                />
                <span>{challenge.subjectName}</span>
              </span>

              <span className="text-slate-300 font-medium">{challenge.topic}</span>

              <span
                className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                  DIFFICULTY_STYLES[challenge.difficulty]
                }`}
              >
                {challenge.difficulty}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1 text-amber-300 font-mono-hud font-semibold">
                <Award className="w-3.5 h-3.5" />
                +{challenge.points} KP
              </span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                {challenge.questionSetName}
              </span>
              <span className="text-slate-500">
                {getPlacementTargetLabel(challenge.targetBuildingId) ||
                  CATEGORY_LABELS[challenge.buildingCategory]}{' '}
                · {floorLabel}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="quiz-close-btn"
            aria-label="Close quiz"
            className="w-9 h-9 rounded-lg border border-white/15 flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Question Prompt */}
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-mono-hud text-slate-400">
              ID: {challenge.id}
            </span>
            {challenge.alreadyCompleted && !outcome && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completed Practice
              </span>
            )}
          </div>
          <h2
            id="player-quiz-heading"
            data-testid="quiz-question-text"
            className="font-display text-base sm:text-lg font-bold text-white leading-snug"
          >
            {challenge.questionText}
          </h2>
        </div>

        {/* Selectable Answer Options */}
        <div className="mt-4 space-y-2.5" role="radiogroup" aria-label="Answer choices">
          {challenge.options.map((opt) => {
            const isChosen = selected === opt.key;
            const lockedCorrect = outcome?.isCorrect && isChosen;
            const lockedWrong = outcome && !outcome.isCorrect && isChosen;

            let borderCls = 'border-white/15 bg-slate-800/75 text-slate-100 hover:border-amber-400/60 hover:bg-slate-800';
            if (lockedCorrect) {
              borderCls = 'border-emerald-400 bg-emerald-500/20 text-white';
            } else if (lockedWrong) {
              borderCls = 'border-rose-400 bg-rose-500/20 text-white';
            } else if (isChosen) {
              borderCls = 'border-amber-400 bg-amber-500/20 text-white';
            }

            return (
              <button
                key={opt.key}
                type="button"
                disabled={Boolean(outcome)}
                data-testid={`quiz-option-${opt.key}`}
                onClick={() => setSelected(opt.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${borderCls} ${
                  outcome ? 'cursor-default' : 'cursor-pointer'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg font-mono-hud text-xs font-bold flex items-center justify-center shrink-0 ${
                    lockedCorrect
                      ? 'bg-emerald-500 text-slate-950'
                      : lockedWrong
                        ? 'bg-rose-500 text-white'
                        : isChosen
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-900/90 text-slate-300 border border-white/10'
                  }`}
                >
                  {opt.key}
                </span>
                <span className="text-sm font-medium leading-snug">{opt.text}</span>
              </button>
            );
          })}
        </div>

        {/* Outcome / Feedback Banner */}
        {outcome && (
          <div
            data-testid="quiz-outcome-banner"
            className={`mt-4 rounded-xl border p-4 ${
              outcome.isCorrect
                ? 'border-emerald-400/50 bg-emerald-950/55'
                : 'border-rose-400/50 bg-rose-950/50'
            }`}
          >
            {outcome.isCorrect ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-emerald-300 font-display text-base font-bold">
                    <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>
                      {outcome.alreadyCompleted
                        ? 'Correct! (Practice Review)'
                        : 'Awesome! Correct Answer!'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono-hud text-xs font-bold">
                    <span className="px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                      +{outcome.pointsAwarded} KP
                    </span>
                    {outcome.cashBonusAwarded > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300">
                        <Coins className="w-3.5 h-3.5" />
                        +${outcome.cashBonusAwarded}
                      </span>
                    )}
                  </div>
                </div>
                {outcome.explanation && (
                  <p
                    data-testid="quiz-explanation"
                    className="mt-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed"
                  >
                    {outcome.explanation}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-rose-300 font-display text-base font-bold">
                    {outcome.locked ? (
                      <Lock className="w-4 h-4 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 shrink-0" />
                    )}
                    <span>
                      {outcome.locked
                        ? 'Not quite — terminal locked for this question.'
                        : 'Not quite! Give it another try.'}
                    </span>
                  </div>
                  <span className="font-mono-hud text-xs font-bold text-slate-300">+0 KP</span>
                </div>
                {outcome.explanation ? (
                  <p
                    data-testid="quiz-explanation"
                    className="mt-2 text-xs sm:text-sm text-slate-200 leading-relaxed"
                  >
                    {outcome.explanation}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-300 inline-flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      {outcome.allowRetry
                        ? 'Think carefully about the clue in the question and try another option.'
                        : 'This teacher configuration allows one attempt per question.'}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {submitError && (
          <div className="mt-3 rounded-lg border border-rose-400/45 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
            {submitError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
          {!outcome && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-white/15 bg-slate-800/80 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Leave Terminal
              </button>
              <button
                type="button"
                disabled={!selected || submitting}
                data-testid="quiz-submit-btn"
                onClick={() => void handleSubmit()}
                className={`px-5 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-colors ${
                  selected && !submitting
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                {submitting ? 'Checking...' : 'Submit Answer'}
              </button>
            </>
          )}

          {outcome && !outcome.isCorrect && outcome.allowRetry && (
            <button
              type="button"
              data-testid="quiz-retry-btn"
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-amber-400/50 bg-amber-500/15 text-xs sm:text-sm font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          )}

          {outcome && (
            <button
              type="button"
              data-testid="quiz-continue-btn"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs sm:text-sm hover:bg-emerald-400 transition-colors"
            >
              Continue Exploring
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
