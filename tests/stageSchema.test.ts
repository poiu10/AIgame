import { describe, expect, it } from "vitest";
import { STAGE_ONE } from "../src/game/content/stageOne";
import {
  formatStageAsTypeScript,
  parseStageJson,
  validateStage,
} from "../src/game/content/stageSchema";

describe("external map editor stage schema", () => {
  it("accepts the Stage 1 starter map and round-trips JSON", () => {
    expect(validateStage(STAGE_ONE)).toEqual({ valid: true, errors: [] });
    expect(parseStageJson(JSON.stringify(STAGE_ONE))).toEqual(STAGE_ONE);
  });

  it("reports duplicate ids and invalid rectangles", () => {
    const invalid = structuredClone(STAGE_ONE);
    invalid.terrain.push({
      id: invalid.spawns[0].id,
      bounds: { x: 0, y: 0, width: 0, height: 40 },
    });

    const result = validateStage(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("중복 id"))).toBe(true);
    expect(result.errors.some((error) => error.includes("범위"))).toBe(true);
  });

  it("exports directly pasteable TypeScript", () => {
    const source = formatStageAsTypeScript(STAGE_ONE, "STAGE_ONE_CUSTOM");
    expect(source).toContain("export const STAGE_ONE_CUSTOM: StageDefinition");
    expect(source).toContain('"id": "stage-1"');
  });
});
