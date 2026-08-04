import type { StageDefinition, StageExit } from "../content/world";
import { PLAYER_CONFIG } from "../simulation/rules/config";
import { createInitialGameState, type GameState } from "../simulation/state";

export const CHECKPOINT_STORAGE_KEY = "echobound.checkpoint.v1";

export interface StageProgress {
  defeatedEnemyIds: string[];
  defeatedBossIds: string[];
}

export interface CheckpointSave {
  version: 1;
  currentStageId: string;
  playerPosition: { x: number; y: number };
  playerFacing: -1 | 1;
  visitedStageIds: string[];
  completedStageIds: string[];
  stageProgress: Record<string, StageProgress>;
  stageDeathCounts: Record<string, number>;
}

export interface CheckpointStorage {
  load(): string | null;
  save(value: string): void;
  clear(): void;
}

export class BrowserCheckpointStorage implements CheckpointStorage {
  load(): string | null {
    return window.localStorage.getItem(CHECKPOINT_STORAGE_KEY);
  }

  save(value: string): void {
    window.localStorage.setItem(CHECKPOINT_STORAGE_KEY, value);
  }

  clear(): void {
    window.localStorage.removeItem(CHECKPOINT_STORAGE_KEY);
  }
}

function emptyProgress(): StageProgress {
  return { defeatedEnemyIds: [], defeatedBossIds: [] };
}

export function createInitialCheckpoint(stage: StageDefinition): CheckpointSave {
  const spawn = stage.spawns[0];
  return {
    version: 1,
    currentStageId: stage.id,
    playerPosition: { ...(spawn?.position ?? stage.playerSpawn) },
    playerFacing: spawn?.facing ?? 1,
    visitedStageIds: [stage.id],
    completedStageIds: [],
    stageProgress: { [stage.id]: emptyProgress() },
    stageDeathCounts: { [stage.id]: 0 },
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function createTransitionCheckpoint(
  previous: CheckpointSave,
  currentStage: StageDefinition,
  state: GameState,
  exit: StageExit,
  targetStage: StageDefinition,
): CheckpointSave {
  const deadIds = new Set(state.enemies.filter((enemy) => !enemy.alive).map((enemy) => enemy.id));
  const priorProgress = previous.stageProgress[currentStage.id] ?? emptyProgress();
  const defeatedBossIds = currentStage.enemies
    .filter((spawn) => spawn.role === "boss" && deadIds.has(spawn.id))
    .map((spawn) => spawn.id);
  const defeatedEnemyIds = currentStage.enemies
    .filter((spawn) => spawn.role !== "boss" && deadIds.has(spawn.id))
    .map((spawn) => spawn.id);
  const currentProgress: StageProgress = {
    defeatedEnemyIds: unique([...priorProgress.defeatedEnemyIds, ...defeatedEnemyIds]),
    defeatedBossIds: unique([...priorProgress.defeatedBossIds, ...defeatedBossIds]),
  };
  const allDefeated = currentStage.enemies.length > 0
    && currentStage.enemies.every((spawn) => deadIds.has(spawn.id)
      || currentProgress.defeatedEnemyIds.includes(spawn.id)
      || currentProgress.defeatedBossIds.includes(spawn.id));
  const targetSpawn = targetStage.spawns.find((spawn) => spawn.id === exit.targetSpawnId);
  if (!targetSpawn) throw new Error(`${targetStage.id}에 도착점 ${exit.targetSpawnId}이 없습니다.`);

  return {
    version: 1,
    currentStageId: targetStage.id,
    playerPosition: { ...targetSpawn.position },
    playerFacing: targetSpawn.facing ?? 1,
    visitedStageIds: unique([...previous.visitedStageIds, targetStage.id]),
    completedStageIds: allDefeated
      ? unique([...previous.completedStageIds, currentStage.id])
      : [...previous.completedStageIds],
    stageProgress: {
      ...previous.stageProgress,
      [currentStage.id]: currentProgress,
      [targetStage.id]: previous.stageProgress[targetStage.id] ?? emptyProgress(),
    },
    stageDeathCounts: {
      ...previous.stageDeathCounts,
      [currentStage.id]: Math.max(
        previous.stageDeathCounts[currentStage.id] ?? 0,
        state.stageDeathCount,
      ),
      [targetStage.id]: previous.stageDeathCounts[targetStage.id] ?? 0,
    },
  };
}

export function recordStageDeathCount(
  save: CheckpointSave,
  stageId: string,
  deathCount: number,
): CheckpointSave {
  return {
    ...save,
    stageDeathCounts: {
      ...save.stageDeathCounts,
      [stageId]: Math.max(
        save.stageDeathCounts[stageId] ?? 0,
        Math.max(0, Math.floor(deathCount)),
      ),
    },
  };
}

export function restoreCheckpointState(save: CheckpointSave, stage: StageDefinition): GameState {
  const state = createInitialGameState(stage);
  const progress = save.stageProgress[stage.id] ?? emptyProgress();
  const defeated = new Set([...progress.defeatedEnemyIds, ...progress.defeatedBossIds]);
  state.enemies = state.enemies.filter((enemy) => !defeated.has(enemy.id));
  if (
    state.bossEncounter &&
    !state.enemies.some((enemy) => enemy.id === state.bossEncounter?.bossId)
  ) {
    state.bossEncounter = null;
  }
  const savedPositionIsInStage =
    save.playerPosition.x >= 0 &&
    save.playerPosition.x <= stage.width &&
    save.playerPosition.y >= 0 &&
    save.playerPosition.y <= stage.height;
  const fallbackSpawn = stage.spawns[0];
  const restoredPosition = savedPositionIsInStage
    ? save.playerPosition
    : (fallbackSpawn?.position ?? stage.playerSpawn);
  state.player.position = { ...restoredPosition };
  state.player.airborneApexY = restoredPosition.y;
  state.player.facing = save.playerFacing;
  state.player.attackFacing = save.playerFacing;
  state.player.health = PLAYER_CONFIG.maxHealth;
  state.stageDeathCount = save.stageDeathCounts[stage.id] ?? 0;
  return state;
}

export function findTouchedExit(state: GameState, stage: StageDefinition): StageExit | undefined {
  const halfWidth = PLAYER_CONFIG.width / 2;
  const halfHeight = PLAYER_CONFIG.height / 2;
  return stage.exits.find((exit) => {
    const bounds = exit.bounds;
    return state.player.position.x + halfWidth > bounds.x
      && state.player.position.x - halfWidth < bounds.x + bounds.width
      && state.player.position.y + halfHeight > bounds.y
      && state.player.position.y - halfHeight < bounds.y + bounds.height;
  });
}

export function serializeCheckpoint(save: CheckpointSave): string {
  return JSON.stringify(save);
}

export function parseCheckpoint(value: string): CheckpointSave | null {
  try {
    const parsed = JSON.parse(value) as CheckpointSave & {
      stageDeathCounts?: Record<string, unknown>;
    };
    if (parsed?.version !== 1 || typeof parsed.currentStageId !== "string") return null;
    if (!Number.isFinite(parsed.playerPosition?.x) || !Number.isFinite(parsed.playerPosition?.y)) return null;
    if (parsed.playerFacing !== -1 && parsed.playerFacing !== 1) return null;
    if (!Array.isArray(parsed.visitedStageIds) || !Array.isArray(parsed.completedStageIds)) return null;
    if (!parsed.stageProgress || typeof parsed.stageProgress !== "object") return null;
    const progressEntries = Object.values(parsed.stageProgress) as StageProgress[];
    if (progressEntries.some((entry) =>
      !Array.isArray(entry?.defeatedEnemyIds) || !Array.isArray(entry?.defeatedBossIds)
    )) return null;
    const rawStageDeathCounts = parsed.stageDeathCounts;
    if (
      rawStageDeathCounts !== undefined &&
      (typeof rawStageDeathCounts !== "object" ||
        rawStageDeathCounts === null ||
        Array.isArray(rawStageDeathCounts))
    ) return null;
    const stageDeathCounts = rawStageDeathCounts ?? {};
    if (Object.values(stageDeathCounts).some((count) =>
      !Number.isInteger(count) || (count as number) < 0
    )) return null;
    return {
      ...parsed,
      stageDeathCounts: stageDeathCounts as Record<string, number>,
    };
  } catch {
    return null;
  }
}
