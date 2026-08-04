import { describe, expect, it } from "vitest";
import { STAGE_ONE } from "../src/game/content/stageOne";
import { TUTORIAL_STAGE } from "../src/game/content/tutorialStage";
import {
  createInitialCheckpoint,
  createTransitionCheckpoint,
  findTouchedExit,
  parseCheckpoint,
  recordStageDeathCount,
  restoreCheckpointState,
  serializeCheckpoint,
} from "../src/game/progression/checkpoint";
import { createInitialGameState } from "../src/game/simulation/state";
import { killPlayer } from "../src/game/simulation/systems/combat";

describe("stage progression checkpoints", () => {
  it("detects the tutorial corridor exit with the player hitbox", () => {
    const state = createInitialGameState(TUTORIAL_STAGE);
    const exit = TUTORIAL_STAGE.exits[0];
    state.player.position = {
      x: exit.bounds.x + exit.bounds.width / 2,
      y: exit.bounds.y + exit.bounds.height / 2,
    };

    expect(findTouchedExit(state, TUTORIAL_STAGE)?.id).toBe("to-stage-1");
  });

  it("records defeated entities and restores them as defeated after returning", () => {
    const tutorialState = createInitialGameState(TUTORIAL_STAGE);
    for (const enemy of tutorialState.enemies) enemy.alive = false;

    const initial = createInitialCheckpoint(TUTORIAL_STAGE);
    const enteredStageOne = createTransitionCheckpoint(
      initial,
      TUTORIAL_STAGE,
      tutorialState,
      TUTORIAL_STAGE.exits[0],
      STAGE_ONE,
    );

    expect(enteredStageOne.currentStageId).toBe("stage-1");
    expect(enteredStageOne.playerPosition).toEqual(
      STAGE_ONE.spawns.find((spawn) => spawn.id === "spawn-3")?.position,
    );
    expect(enteredStageOne.stageProgress.tutorial.defeatedEnemyIds).toEqual([
      "lesson-sentinel",
      "trial-sentinel",
    ]);
    expect(enteredStageOne.completedStageIds).toContain("tutorial");

    const stageOneState = restoreCheckpointState(enteredStageOne, STAGE_ONE);
    const returnedToTutorial = createTransitionCheckpoint(
      enteredStageOne,
      STAGE_ONE,
      stageOneState,
      STAGE_ONE.exits[0],
      TUTORIAL_STAGE,
    );
    const restoredTutorial = restoreCheckpointState(returnedToTutorial, TUTORIAL_STAGE);

    expect(restoredTutorial.enemies).toHaveLength(0);
    expect(restoredTutorial.player.position).toEqual(
      TUTORIAL_STAGE.spawns.find((spawn) => spawn.id === "from-stage-1")?.position,
    );
  });

  it("round-trips a valid checkpoint and rejects broken save data", () => {
    const checkpoint = createInitialCheckpoint(TUTORIAL_STAGE);
    expect(parseCheckpoint(serializeCheckpoint(checkpoint))).toEqual(checkpoint);
    expect(parseCheckpoint('{"version":999}')).toBeNull();
    expect(parseCheckpoint("not-json")).toBeNull();
  });

  it("persists stage death counts across checkpoint restores", () => {
    let checkpoint = createInitialCheckpoint(STAGE_ONE);
    for (let death = 1; death <= 4; death += 1) {
      const state = restoreCheckpointState(checkpoint, STAGE_ONE);
      expect(state.stageDeathCount).toBe(death - 1);
      expect(killPlayer(state)).toBe(true);
      checkpoint = recordStageDeathCount(
        checkpoint,
        STAGE_ONE.id,
        state.stageDeathCount,
      );
    }

    expect(checkpoint.stageDeathCounts[STAGE_ONE.id]).toBe(4);
    expect(restoreCheckpointState(checkpoint, STAGE_ONE).stageDeathCount).toBe(4);
  });

  it("loads older version-one checkpoints without death counts", () => {
    const checkpoint = createInitialCheckpoint(STAGE_ONE);
    const legacy = JSON.parse(serializeCheckpoint(checkpoint)) as Record<
      string,
      unknown
    >;
    delete legacy.stageDeathCounts;

    expect(parseCheckpoint(JSON.stringify(legacy))?.stageDeathCounts).toEqual({});
    legacy.stageDeathCounts = { [STAGE_ONE.id]: -1 };
    expect(parseCheckpoint(JSON.stringify(legacy))).toBeNull();
  });

  it("falls back to the stage entry when an older checkpoint is outside the map", () => {
    const checkpoint = createInitialCheckpoint(STAGE_ONE);
    checkpoint.playerPosition = { x: 180, y: 1258 };

    const restored = restoreCheckpointState(checkpoint, STAGE_ONE);

    expect(restored.player.position).toEqual(STAGE_ONE.spawns[0].position);
  });

  it("keeps boss defeats separate from normal enemy defeats", () => {
    const bossStage = structuredClone(TUTORIAL_STAGE);
    bossStage.id = "boss-test";
    bossStage.enemies[0].role = "boss";
    const state = createInitialGameState(bossStage);
    state.enemies[0].alive = false;

    const checkpoint = createTransitionCheckpoint(
      createInitialCheckpoint(bossStage),
      bossStage,
      state,
      bossStage.exits[0],
      STAGE_ONE,
    );

    expect(checkpoint.stageProgress["boss-test"].defeatedBossIds).toEqual([
      "lesson-sentinel",
    ]);
    expect(checkpoint.stageProgress["boss-test"].defeatedEnemyIds).not.toContain(
      "lesson-sentinel",
    );
  });
});
