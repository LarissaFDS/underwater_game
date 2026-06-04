export const PLAYER_NICKNAMES_REGISTRY_KEY = "playerNicknames";
export const LOCAL_PLAYER_ID_REGISTRY_KEY = "localPlayerId";
export const PARTNER_PLAYER_ID_REGISTRY_KEY = "partnerPlayerId";

const LOGIN_NICKNAME_STORAGE_KEY = "ocean_nickname";
const LOCAL_PLAYER_ID_STORAGE_KEY = "ocean_local_player_id";
const PARTNER_PLAYER_ID_STORAGE_KEY = "ocean_partner_player_id";
const PLAYER_IDS_STORAGE_KEY = "ocean_player_ids";
const PLAYER_NICKNAMES_STORAGE_KEY = "ocean_player_nicknames";

type PlayerLike =
  | string
  | {
      id?: unknown;
      playerId?: unknown;
      socketId?: unknown;
      nickname?: unknown;
      name?: unknown;
    };

export interface GameStartIdentityPayload {
  players?: PlayerLike[];
  playerIds?: unknown;
  ids?: unknown;
  nicknames?: unknown;
}

export interface RoomJoinedIdentityPayload {
  playerId?: unknown;
  id?: unknown;
  socketId?: unknown;
  nickname?: unknown;
}

export interface PlayerIdentityState {
  playerIds: string[];
  localPlayerId?: string;
  localNickname?: string;
  partnerPlayerId?: string;
  partnerNickname?: string;
  nicknames: Record<string, string>;
}

export function rememberLoginNickname(nickname: unknown): string | undefined {
  const normalizedNickname = normalizeNickname(nickname);

  if (normalizedNickname) {
    setSessionItem(LOGIN_NICKNAME_STORAGE_KEY, normalizedNickname);
  }

  return normalizedNickname;
}

export function rememberRoomJoinedIdentity(
  payload: RoomJoinedIdentityPayload
): PlayerIdentityState {
  const playerId = normalizeId(
    payload.playerId ?? payload.id ?? payload.socketId
  );
  const nickname =
    normalizeNickname(payload.nickname) ?? readLoginNickname();
  const nicknames = readStoredNicknameMap();

  if (playerId) {
    setSessionItem(LOCAL_PLAYER_ID_STORAGE_KEY, playerId);
    mergeStoredPlayerIds([playerId]);

    if (nickname) {
      nicknames[playerId] = nickname;
    }
  }

  if (Object.keys(nicknames).length > 0) {
    writeStoredNicknameMap(nicknames);
  }

  return getPlayerIdentityState();
}

export function rememberGameStartIdentity(
  payload: GameStartIdentityPayload,
  localSocketId?: string
): PlayerIdentityState {
  const playerIds = extractPlayerIds(payload);
  const nicknames = {
    ...readStoredNicknameMap(),
    ...extractNicknameMap(payload),
  };

  const localPlayerId = resolveLocalPlayerId(playerIds, localSocketId);
  const localNickname =
    (localPlayerId ? normalizeNickname(nicknames[localPlayerId]) : undefined) ??
    readLoginNickname();

  if (localPlayerId) {
    setSessionItem(LOCAL_PLAYER_ID_STORAGE_KEY, localPlayerId);

    if (localNickname) {
      nicknames[localPlayerId] = localNickname;
    }
  }

  const partnerPlayerId = playerIds.find((playerId) => playerId !== localPlayerId);
  const partnerNickname = partnerPlayerId
    ? normalizeNickname(nicknames[partnerPlayerId])
    : undefined;

  if (partnerPlayerId) {
    setSessionItem(PARTNER_PLAYER_ID_STORAGE_KEY, partnerPlayerId);
  }

  if (playerIds.length > 0) {
    setSessionItem(PLAYER_IDS_STORAGE_KEY, JSON.stringify(playerIds));
  }

  if (Object.keys(nicknames).length > 0) {
    writeStoredNicknameMap(nicknames);
  }

  return {
    playerIds,
    localPlayerId,
    localNickname,
    partnerPlayerId,
    partnerNickname,
    nicknames,
  };
}

export function getPlayerIdentityState(
  registryNicknames?: unknown
): PlayerIdentityState {
  const nicknames = {
    ...readStoredNicknameMap(),
    ...normalizeNicknameMap(registryNicknames),
  };
  const playerIds = readStoredPlayerIds();
  const localPlayerId = normalizeId(getSessionItem(LOCAL_PLAYER_ID_STORAGE_KEY));
  const partnerPlayerId =
    normalizeId(getSessionItem(PARTNER_PLAYER_ID_STORAGE_KEY)) ??
    playerIds.find((playerId) => playerId !== localPlayerId);
  const localNickname =
    (localPlayerId ? normalizeNickname(nicknames[localPlayerId]) : undefined) ??
    readLoginNickname();
  const partnerNickname = partnerPlayerId
    ? normalizeNickname(nicknames[partnerPlayerId])
    : undefined;

  return {
    playerIds,
    localPlayerId,
    localNickname,
    partnerPlayerId,
    partnerNickname,
    nicknames,
  };
}

export function resolveNicknameForPlayerId(
  playerId: unknown,
  registryNicknames?: unknown
): string | undefined {
  const normalizedId = normalizeId(playerId);

  if (!normalizedId) {
    return undefined;
  }

  return getPlayerIdentityState(registryNicknames).nicknames[normalizedId];
}

export function normalizeNickname(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractPlayerIds(payload: GameStartIdentityPayload): string[] {
  const explicitIds = normalizeIdArray(payload.playerIds ?? payload.ids);

  if (explicitIds.length > 0) {
    return explicitIds;
  }

  if (!Array.isArray(payload.players)) {
    return [];
  }

  return payload.players
    .map((player) =>
      typeof player === "string"
        ? normalizeId(player)
        : normalizeId(player.id ?? player.playerId ?? player.socketId)
    )
    .filter((playerId): playerId is string => playerId !== undefined);
}

function extractNicknameMap(
  payload: GameStartIdentityPayload
): Record<string, string> {
  const nicknames = normalizeNicknameMap(payload.nicknames);

  if (!Array.isArray(payload.players)) {
    return nicknames;
  }

  payload.players.forEach((player) => {
    if (typeof player === "string") {
      return;
    }

    const playerId = normalizeId(player.id ?? player.playerId ?? player.socketId);
    const nickname = normalizeNickname(player.nickname ?? player.name);

    if (playerId && nickname) {
      nicknames[playerId] = nickname;
    }
  });

  return nicknames;
}

function resolveLocalPlayerId(
  playerIds: string[],
  localSocketId?: string
): string | undefined {
  const socketId = normalizeId(localSocketId);
  const storedPlayerId = normalizeId(getSessionItem(LOCAL_PLAYER_ID_STORAGE_KEY));

  if (socketId && (playerIds.length === 0 || playerIds.includes(socketId))) {
    return socketId;
  }

  if (
    storedPlayerId &&
    (playerIds.length === 0 || playerIds.includes(storedPlayerId))
  ) {
    return storedPlayerId;
  }

  return socketId ?? storedPlayerId;
}

function normalizeNicknameMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, string>
  >((result, [rawPlayerId, rawNickname]) => {
    const playerId = normalizeId(rawPlayerId);
    const nickname = normalizeNickname(rawNickname);

    if (playerId && nickname) {
      result[playerId] = nickname;
    }

    return result;
  }, {});
}

function normalizeIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeId(entry))
    .filter((playerId): playerId is string => playerId !== undefined);
}

function normalizeId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readLoginNickname(): string | undefined {
  return normalizeNickname(getSessionItem(LOGIN_NICKNAME_STORAGE_KEY));
}

function readStoredNicknameMap(): Record<string, string> {
  return parseJsonRecord(getSessionItem(PLAYER_NICKNAMES_STORAGE_KEY));
}

function writeStoredNicknameMap(nicknames: Record<string, string>): void {
  setSessionItem(PLAYER_NICKNAMES_STORAGE_KEY, JSON.stringify(nicknames));
}

function readStoredPlayerIds(): string[] {
  return normalizeIdArray(parseJsonValue(getSessionItem(PLAYER_IDS_STORAGE_KEY)));
}

function mergeStoredPlayerIds(playerIds: string[]): void {
  const mergedPlayerIds = Array.from(
    new Set([...readStoredPlayerIds(), ...playerIds])
  );

  setSessionItem(PLAYER_IDS_STORAGE_KEY, JSON.stringify(mergedPlayerIds));
}

function parseJsonRecord(value: string | null): Record<string, string> {
  return normalizeNicknameMap(parseJsonValue(value));
}

function parseJsonValue(value: string | null): unknown {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function getSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSessionItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Session storage is best-effort identity cache for UI labels only.
  }
}
