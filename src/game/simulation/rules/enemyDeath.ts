import { ENEMY_KINDS, type WorldDefinition } from "../../content/world";
import type { EnemyState } from "../state";
import { ENEMY_CONFIG } from "./config";

const STAGE_TWO_ID = "stage-2";

export function isBossEnemyKind(kind: string): boolean {
  return kind === ENEMY_KINDS.cocoonBoss || kind === ENEMY_KINDS.ravenBoss;
}

export function isEnemyBodyPresent(
  world: WorldDefinition,
  enemy: EnemyState,
): boolean {
  if (enemy.alive || isBossEnemyKind(enemy.kind)) return true;
  const stageId = "id" in world ? world.id : undefined;
  return (
    stageId !== STAGE_TWO_ID ||
    enemy.actionTime < ENEMY_CONFIG.deathAnimationSeconds
  );
}
