import type { SocialModerationConfig } from './questionTypes';
import type { ChatMessageRecord, SocialGroupSnapshot } from './multiplayerTypes';

export const DEFAULT_SOCIAL_CONFIG: SocialModerationConfig = {
  chatEnabled: true,
  groupsEnabled: true,
  emoteWheelEnabled: true,
  leaderboardVisible: true,
  groupMinimapMarkers: true,
};

export const CHAT_MAX_LENGTH = 180;
export const CHAT_MIN_INTERVAL_MS = 1500;

const BLOCKED_PROFANITY_PATTERNS: RegExp[] = [
  /\b(fuck|shit|bitch|asshole|bastard|dick|pussy|cunt|whore|slut|retard)\b/gi,
  /\b(anjing|bangsat|kontol|memek|ngentot|goblok|tolol|babi|pantek)\b/gi,
];

const CONTACT_AND_PII_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    reason: 'email address',
  },
  {
    pattern: /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g,
    reason: 'phone number',
  },
  {
    pattern: /(https?:\/\/|www\.)\S+/gi,
    reason: 'external link',
  },
  {
    pattern: /\b(whatsapp|wa\.me|telegram|t\.me|discord\.gg|instagram|snapchat|tiktok|line id)\b/gi,
    reason: 'external social/contact handle',
  },
];

export interface SanitizedChatResult {
  allowed: boolean;
  text: string;
  redacted: boolean;
  error?: string;
}

export function validateAndFilterChatMessage(
  rawText: string,
  lastSentAtMs: number | undefined,
  nowMs: number,
  config?: Partial<SocialModerationConfig> | null,
): SanitizedChatResult {
  const chatEnabled = config?.chatEnabled ?? DEFAULT_SOCIAL_CONFIG.chatEnabled;
  if (!chatEnabled) {
    return {
      allowed: false,
      text: '',
      redacted: false,
      error: 'Chat is currently disabled by your teacher.',
    };
  }

  if (typeof lastSentAtMs === 'number' && nowMs - lastSentAtMs < CHAT_MIN_INTERVAL_MS) {
    return {
      allowed: false,
      text: '',
      redacted: false,
      error: 'Please wait a moment before sending another message.',
    };
  }

  const trimmed = rawText.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return {
      allowed: false,
      text: '',
      redacted: false,
      error: 'Message cannot be empty.',
    };
  }

  const clipped = trimmed.slice(0, CHAT_MAX_LENGTH);

  // Reject PII / external contact sharing explicitly so students stay protected
  for (const rule of CONTACT_AND_PII_PATTERNS) {
    rule.pattern.lastIndex = 0;
    const match = rule.pattern.exec(clipped);
    if (match) {
      // Allow short plain numbers like "10 KP" or "Floor 22" (at most 5 digits without punctuation)
      if (rule.reason === 'phone number') {
        const digitsOnly = match[0].replace(/\D/g, '');
        if (digitsOnly.length < 7) {
          continue;
        }
      }
      return {
        allowed: false,
        text: '',
        redacted: false,
        error: `Sharing ${rule.reason}s is not allowed in classroom chat.`,
      };
    }
  }

  let filtered = clipped;
  let redacted = false;
  for (const pat of BLOCKED_PROFANITY_PATTERNS) {
    pat.lastIndex = 0;
    if (pat.test(filtered)) {
      pat.lastIndex = 0;
      filtered = filtered.replace(pat, (m) => '*'.repeat(Math.max(3, m.length)));
      redacted = true;
    }
  }

  return {
    allowed: true,
    text: filtered,
    redacted,
  };
}

export function filterVisibleChatMessages(
  messages: ChatMessageRecord[],
  mutedPlayerIds: ReadonlySet<string>,
): ChatMessageRecord[] {
  if (mutedPlayerIds.size === 0) return messages;
  return messages.filter((m) => !mutedPlayerIds.has(m.senderPlayerId));
}

export const MAX_GROUP_MEMBERS = 5;

export function createSocialGroup(
  groups: SocialGroupSnapshot[],
  leaderPlayerId: string,
  rawName: string,
  nowMs: number,
): { groups: SocialGroupSnapshot[]; group: SocialGroupSnapshot; error?: string } {
  const cleanName = rawName.replace(/\s+/g, ' ').trim().slice(0, 28) || 'Explorers';
  const cleanedGroups = leaveSocialGroup(groups, leaderPlayerId);
  const id = `grp_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const created: SocialGroupSnapshot = {
    id,
    name: cleanName,
    leaderPlayerId,
    memberPlayerIds: [leaderPlayerId],
    createdAt: nowMs,
  };
  return {
    groups: [...cleanedGroups, created],
    group: created,
  };
}

export function joinSocialGroup(
  groups: SocialGroupSnapshot[],
  playerId: string,
  groupId: string,
): { groups: SocialGroupSnapshot[]; joined: boolean; error?: string } {
  const target = groups.find((g) => g.id === groupId);
  if (!target) {
    return { groups, joined: false, error: 'Exploration group no longer exists.' };
  }
  if (target.memberPlayerIds.includes(playerId)) {
    return { groups, joined: true };
  }
  if (target.memberPlayerIds.length >= MAX_GROUP_MEMBERS) {
    return { groups, joined: false, error: 'That exploration group is full (max 5).' };
  }
  const left = leaveSocialGroup(groups, playerId);
  const next = left.map((g) =>
    g.id === groupId ? { ...g, memberPlayerIds: [...g.memberPlayerIds, playerId] } : g,
  );
  return { groups: next, joined: true };
}

export function leaveSocialGroup(
  groups: SocialGroupSnapshot[],
  playerId: string,
): SocialGroupSnapshot[] {
  const updated: SocialGroupSnapshot[] = [];
  for (const g of groups) {
    if (!g.memberPlayerIds.includes(playerId)) {
      updated.push(g);
      continue;
    }
    const remaining = g.memberPlayerIds.filter((id) => id !== playerId);
    if (remaining.length === 0) {
      continue;
    }
    updated.push({
      ...g,
      leaderPlayerId: g.leaderPlayerId === playerId ? remaining[0] : g.leaderPlayerId,
      memberPlayerIds: remaining,
    });
  }
  return updated;
}
