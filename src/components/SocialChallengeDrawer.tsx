import { useState, type FC, type FormEvent } from 'react';
import {
  Flag,
  Hand,
  MessageSquare,
  Send,
  ShieldAlert,
  Trophy,
  UserPlus,
  Users,
  VolumeX,
  X,
} from 'lucide-react';
import type { EmoteKind } from '../game/characterAnimator';
import type {
  ChallengeSessionState,
  ChatMessageRecord,
  MultiplayerSessionSnapshot,
  SocialGroupSnapshot,
} from '../game/multiplayerTypes';
import type { SocialModerationConfig } from '../game/questionTypes';
import {
  CHAT_MAX_LENGTH,
  DEFAULT_SOCIAL_CONFIG,
  MAX_GROUP_MEMBERS,
  filterVisibleChatMessages,
} from '../game/socialSystem';
import type { HudSnapshot } from '../game/types';

type SocialTab = 'chat' | 'groups' | 'leaderboard';

interface SocialChallengeDrawerProps {
  activeSession: MultiplayerSessionSnapshot | null;
  selfPlayerId: string | null;
  nearbyPlayers: NonNullable<HudSnapshot['nearbyPlayers']>;
  socialConfig?: SocialModerationConfig;
  chatMessages: ChatMessageRecord[];
  groups: SocialGroupSnapshot[];
  challengeState: ChallengeSessionState | null;
  mutedPlayerIds: ReadonlySet<string>;
  onSendChat: (text: string) => void;
  onGroupAction: (action: 'create' | 'join' | 'leave', groupId?: string, name?: string) => void;
  onToggleMute: (playerId: string) => void;
  onReportPlayer: (targetPlayerId: string, reason: string, excerpt?: string) => void;
  onGreetPlayer: (targetPlayerId: string, emote: EmoteKind) => void;
  onOpenSessionModal: () => void;
  onClose: () => void;
}

const CHALLENGE_MODE_LABELS: Record<ChallengeSessionState['mode'], string> = {
  none: 'Free Exploration',
  knowledge_race: 'Knowledge Race',
  team_exploration: 'Team Exploration',
  city_tower_challenge: 'CITY TOWER Ascent',
  subject_challenge: 'Subject Challenge',
};

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export const SocialChallengeDrawer: FC<SocialChallengeDrawerProps> = ({
  activeSession,
  selfPlayerId,
  nearbyPlayers,
  socialConfig,
  chatMessages,
  groups,
  challengeState,
  mutedPlayerIds,
  onSendChat,
  onGroupAction,
  onToggleMute,
  onReportPlayer,
  onGreetPlayer,
  onOpenSessionModal,
  onClose,
}) => {
  const cfg = socialConfig || DEFAULT_SOCIAL_CONFIG;
  const [tab, setTab] = useState<SocialTab>('chat');
  const [chatInput, setChatInput] = useState('');
  const [groupNameInput, setGroupNameInput] = useState('');
  const [reportedToast, setReportedToast] = useState<string | null>(null);

  const visibleMessages = filterVisibleChatMessages(chatMessages, mutedPlayerIds);
  const myGroup = groups.find((g) => selfPlayerId && g.memberPlayerIds.includes(selfPlayerId)) || null;

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = chatInput.trim();
    if (!cleaned || !activeSession) return;
    onSendChat(cleaned);
    setChatInput('');
  };

  const handleCreateGroup = (e: FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    onGroupAction('create', undefined, groupNameInput.trim() || 'City Explorers');
    setGroupNameInput('');
  };

  const triggerReport = (targetId: string, name: string, excerpt?: string) => {
    onReportPlayer(targetId, 'Inappropriate classroom behavior', excerpt);
    setReportedToast(`Reported ${name} to teacher moderation log.`);
    window.setTimeout(() => setReportedToast(null), 3000);
  };

  return (
    <div
      className="fixed top-3 right-3 bottom-3 z-30 w-[calc(100vw-24px)] max-w-[392px] flex flex-col rounded-xl border border-white/15 shadow-2xl overflow-hidden"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.96)' }}
      role="dialog"
      aria-modal="false"
      aria-label="Social, Groups and Challenge Leaderboard"
      data-testid="social-challenge-drawer"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-400/40 flex items-center justify-center text-sky-300">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-white leading-tight">
              Social &amp; City Challenges
            </h2>
            <div className="text-[11px] text-slate-400">
              {activeSession
                ? `Session ${activeSession.session.joinCode} · ${activeSession.onlineCount} online`
                : 'Join a classroom session for live social features'}
            </div>
          </div>
        </div>
        <button
          type="button"
          data-testid="social-drawer-close"
          onClick={onClose}
          aria-label="Close Social Drawer"
          className="w-8 h-8 rounded-lg border border-white/15 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 px-3 py-2 border-b border-white/10 bg-slate-950/60">
        {(
          [
            { id: 'chat', label: 'Chat & Nearby', icon: MessageSquare },
            { id: 'groups', label: 'Groups', icon: UserPlus },
            { id: 'leaderboard', label: 'Challenge', icon: Trophy },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-testid={`social-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors ${
                active
                  ? 'bg-sky-500 text-slate-950'
                  : 'bg-slate-900 text-slate-300 border border-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {reportedToast && (
        <div className="mx-3 mt-2 rounded-lg border border-amber-400/45 bg-amber-950/60 px-3 py-1.5 text-[11px] text-amber-200">
          {reportedToast}
        </div>
      )}

      {!activeSession ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
          <Users className="w-10 h-10 text-sky-400/70" />
          <div className="text-sm font-bold text-white">Not in a Classroom Session</div>
          <p className="text-xs text-slate-400 max-w-[260px]">
            Connect to a teacher session with your Join Code to chat safely, form Exploration Groups, and compete in Live Challenges.
          </p>
          <button
            type="button"
            onClick={onOpenSessionModal}
            className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs hover:bg-sky-400"
          >
            Open Classroom Session
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* TAB 1: CHAT & NEARBY */}
          {tab === 'chat' && (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Nearby Classmates Strip */}
              {nearbyPlayers.length > 0 && (
                <div className="p-3 border-b border-white/10 bg-slate-900/60 space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    Nearby Classmates ({nearbyPlayers.length})
                  </div>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {nearbyPlayers.map((np) => (
                      <div
                        key={np.playerId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-950/70 px-2.5 py-1.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">{np.displayName}</div>
                          <div className="text-[10px] text-slate-400">{np.distance.toFixed(1)}m away</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onGreetPlayer(np.playerId, 'handshake')}
                            className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/30"
                          >
                            Handshake
                          </button>
                          <button
                            type="button"
                            onClick={() => onGreetPlayer(np.playerId, 'high_five')}
                            className="px-2 py-1 rounded bg-amber-500/20 border border-amber-400/40 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/30"
                          >
                            High-Five
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {visibleMessages.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-8">
                    No messages yet. Say hello or coordinate a building quest!
                  </div>
                ) : (
                  visibleMessages.map((msg) => {
                    const isSelf = msg.senderPlayerId === selfPlayerId;
                    return (
                      <div
                        key={msg.id}
                        className={`rounded-lg border p-2.5 text-xs ${
                          isSelf
                            ? 'border-sky-400/40 bg-sky-950/40 ml-4'
                            : 'border-white/10 bg-slate-900/80 mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-amber-300 truncate">{msg.senderName}</span>
                          {!isSelf && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                title="Mute player locally"
                                onClick={() => onToggleMute(msg.senderPlayerId)}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                              >
                                <VolumeX className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                title="Report message to teacher"
                                onClick={() => triggerReport(msg.senderPlayerId, msg.senderName, msg.text)}
                                className="p-1 rounded text-slate-400 hover:text-rose-300 hover:bg-slate-800"
                              >
                                <Flag className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="text-slate-100 mt-1 break-words">{msg.text}</div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Composer */}
              <div className="p-3 border-t border-white/10 bg-slate-950/60">
                {!cfg.chatEnabled ? (
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Classroom chat is disabled by the teacher.</span>
                  </div>
                ) : (
                  <form onSubmit={handleChatSubmit} className="flex gap-1.5">
                    <input
                      type="text"
                      maxLength={CHAT_MAX_LENGTH}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      data-testid="social-chat-input"
                      placeholder="Safe classroom message..."
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                    />
                    <button
                      type="submit"
                      data-testid="social-chat-send"
                      className="px-3 py-2 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs hover:bg-sky-400 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EXPLORATION GROUPS */}
          {tab === 'groups' && (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
              {!cfg.groupsEnabled ? (
                <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-300">
                  Exploration groups are currently disabled by your teacher.
                </div>
              ) : (
                <>
                  <form onSubmit={handleCreateGroup} className="space-y-2 rounded-xl border border-white/12 bg-slate-900/75 p-3">
                    <div className="text-xs font-bold text-white">
                      Create Exploration Group (Max {MAX_GROUP_MEMBERS})
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        maxLength={28}
                        value={groupNameInput}
                        onChange={(e) => setGroupNameInput(e.target.value)}
                        data-testid="group-name-input"
                        placeholder="Group name (e.g. Skyline Squad)"
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 text-xs text-white"
                      />
                      <button
                        type="submit"
                        data-testid="group-create-btn"
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 shrink-0"
                      >
                        Create
                      </button>
                    </div>
                  </form>

                  {myGroup && (
                    <div className="rounded-xl border border-emerald-400/50 bg-emerald-950/35 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-semibold uppercase text-emerald-300">
                            Your Active Group
                          </div>
                          <div className="text-sm font-bold text-white">{myGroup.name}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onGroupAction('leave')}
                          className="px-2.5 py-1 rounded-lg border border-rose-400/40 bg-rose-500/15 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/25"
                        >
                          Leave
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-200">
                        Members ({myGroup.memberPlayerIds.length}/{MAX_GROUP_MEMBERS}):{' '}
                        {myGroup.memberPlayerIds
                          .map(
                            (id) =>
                              activeSession.players.find((p) => p.playerId === id)?.displayName ||
                              id,
                          )
                          .join(', ')}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Session Groups ({groups.length})
                    </div>
                    {groups.length === 0 ? (
                      <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4 text-xs text-slate-400">
                        No exploration groups created yet.
                      </div>
                    ) : (
                      groups.map((grp) => {
                        const isMember = Boolean(
                          selfPlayerId && grp.memberPlayerIds.includes(selfPlayerId),
                        );
                        const isFull = grp.memberPlayerIds.length >= MAX_GROUP_MEMBERS;
                        return (
                          <div
                            key={grp.id}
                            className="rounded-lg border border-white/12 bg-slate-900/75 p-3 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">{grp.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono-hud">
                                {grp.memberPlayerIds.length}/{MAX_GROUP_MEMBERS} explorers
                              </div>
                            </div>
                            {!isMember && (
                              <button
                                type="button"
                                disabled={isFull}
                                onClick={() => onGroupAction('join', grp.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                  isFull
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                                }`}
                              >
                                {isFull ? 'Full' : 'Join'}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: CHALLENGE & LEADERBOARD */}
          {tab === 'leaderboard' && (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
              {challengeState && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold uppercase tracking-wider text-amber-300">
                      {CHALLENGE_MODE_LABELS[challengeState.mode]}
                    </span>
                    <span className="font-mono-hud text-white font-semibold">
                      {formatSeconds(challengeState.timeRemainingSeconds)}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white">{challengeState.title}</div>
                  <div className="text-[11px] text-slate-300">
                    Goal: {challengeState.targetQuestions} questions · {challengeState.subjectFilter}
                  </div>
                </div>
              )}

              {!cfg.leaderboardVisible ? (
                <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-300">
                  The live leaderboard is currently hidden by your teacher.
                </div>
              ) : (
                <>
                  {challengeState && challengeState.teamScores.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                        Exploration Team Standings
                      </div>
                      {challengeState.teamScores.map((tm) => (
                        <div
                          key={tm.groupId}
                          className="rounded-lg border border-white/12 bg-slate-900/75 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-mono-hud text-amber-300 mr-1.5">#{tm.rank}</span>
                            <span className="font-bold text-white">{tm.groupName}</span>
                            <span className="text-[10px] text-slate-400 ml-1.5">
                              ({tm.memberCount})
                            </span>
                          </div>
                          <span className="font-mono-hud font-bold text-emerald-300 shrink-0">
                            {tm.totalKp} KP
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Individual Standings
                    </div>
                    {(challengeState?.leaderboard || []).map((row) => (
                      <div
                        key={row.playerId}
                        className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-2 text-xs ${
                          row.playerId === selfPlayerId
                            ? 'border-sky-400/50 bg-sky-950/40'
                            : 'border-white/10 bg-slate-900/75'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono-hud font-bold text-amber-300">
                              #{row.rank}
                            </span>
                            <span className="font-semibold text-white truncate">
                              {row.displayName}
                            </span>
                            {row.completionStatus === 'completed' && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[9px] font-bold text-emerald-300 uppercase">
                                Done
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono-hud mt-0.5">
                            {row.questionsCompleted} Qs · Tower F{row.towerMaxFloor}
                            {row.groupName ? ` · ${row.groupName}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono-hud font-bold text-amber-300">
                            {row.kpEarned} KP
                          </span>
                          {row.playerId !== selfPlayerId && (
                            <button
                              type="button"
                              title="Send Wave"
                              onClick={() => onGreetPlayer(row.playerId, 'wave')}
                              className="p-1 rounded border border-white/10 bg-slate-800 text-sky-300 hover:bg-slate-700"
                            >
                              <Hand className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
