import type { RectState, StageDefinition } from "./world";

export interface StageValidationResult {
  valid: boolean;
  errors: string[];
}

function isFiniteRect(bounds: RectState): boolean {
  return [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
    && bounds.width > 0
    && bounds.height > 0;
}

export function validateStage(stage: StageDefinition): StageValidationResult {
  const errors: string[] = [];
  if (stage.schemaVersion !== 1) errors.push("schemaVersion은 1이어야 합니다.");
  if (!stage.id.trim()) errors.push("스테이지 id가 필요합니다.");
  if (!stage.name.trim()) errors.push("스테이지 이름이 필요합니다.");
  if (!Number.isFinite(stage.width) || stage.width <= 0) errors.push("width는 양수여야 합니다.");
  if (!Number.isFinite(stage.height) || stage.height <= 0) errors.push("height는 양수여야 합니다.");

  const ids = new Set<string>();
  const register = (id: string, label: string) => {
    if (!id.trim()) errors.push(`${label}에 id가 없습니다.`);
    else if (ids.has(id)) errors.push(`중복 id: ${id}`);
    ids.add(id);
  };

  for (const terrain of stage.terrain) {
    register(terrain.id, "지형");
    if (!isFiniteRect(terrain.bounds)) errors.push(`지형 ${terrain.id}의 범위가 올바르지 않습니다.`);
  }
  for (const hazard of stage.hazards ?? []) {
    register(hazard.id, "장해물");
    if (!isFiniteRect(hazard.bounds)) errors.push(`장해물 ${hazard.id}의 범위가 올바르지 않습니다.`);
  }
  for (const enemy of stage.enemies) {
    register(enemy.id, "적");
    if (enemy.patrolMinX > enemy.patrolMaxX) errors.push(`적 ${enemy.id}의 순찰 범위가 뒤집혔습니다.`);
  }
  for (const spawn of stage.spawns) register(spawn.id, "출구 도착점");
  for (const exit of stage.exits) {
    register(exit.id, "출구");
    if (!isFiniteRect(exit.bounds)) errors.push(`출구 ${exit.id}의 범위가 올바르지 않습니다.`);
    if (!exit.targetStageId.trim() || !exit.targetSpawnId.trim()) {
      errors.push(`출구 ${exit.id}의 대상 스테이지와 도착점이 필요합니다.`);
    }
  }
  if (stage.spawns.length === 0) errors.push("출구에서 들어올 도착점이 하나 이상 필요합니다.");

  return { valid: errors.length === 0, errors };
}

export function parseStageJson(source: string): StageDefinition {
  const parsed = JSON.parse(source) as StageDefinition;
  if (!parsed || typeof parsed !== "object") throw new Error("스테이지 JSON 객체가 아닙니다.");
  if (!Array.isArray(parsed.terrain) || !Array.isArray(parsed.enemies)) {
    throw new Error("terrain과 enemies 배열이 필요합니다.");
  }
  parsed.hazards ??= [];
  parsed.soundEmitters ??= [];
  parsed.exits ??= [];
  parsed.spawns ??= [];
  const result = validateStage(parsed);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  return parsed;
}

export function formatStageAsTypeScript(stage: StageDefinition, exportName = "CUSTOM_STAGE"): string {
  const safeName = exportName.replace(/[^A-Za-z0-9_$]/g, "_").replace(/^[0-9]/, "_$&") || "CUSTOM_STAGE";
  return [
    'import type { StageDefinition } from "./world";',
    "",
    `export const ${safeName}: StageDefinition = ${JSON.stringify(stage, null, 2)};`,
    "",
  ].join("\n");
}
