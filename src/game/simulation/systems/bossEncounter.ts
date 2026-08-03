import { ENEMY_KINDS, type WorldDefinition } from "../../content/world";
import { centerRect, rectanglesOverlap } from "../collision/aabb";
import {
  ENEMY_HIT_WAVE_CONFIG,
  getEnemyBodySize,
  STAGE_ONE_CONFIG,
  STAGE_TWO_CONFIG,
} from "../rules/config";
import { getPlayerBounds } from "../rules/player";
import type {
  BossActorState,
  BossAttackPattern,
  BossEncounterState,
  EnemyState,
  Facing,
  GameState,
  Vector2State,
} from "../state";
import { emitSound, emitSoundWave } from "./sound";

const BOSS_ACTOR_BODY = getEnemyBodySize(ENEMY_KINDS.waker);
const BOSS_TOP_OFFSET_Y = 120;
const PATTERN_EDGE_INSET = 54;
const PATTERN_TOP_Y = 68;
const PATTERN_FLOOR_Y = 404;
const PATTERN_CENTER_TARGET_Y = 394;
const ACTOR_EXIT_MARGIN = 100;

type DamagePlayer = (direction: Facing) => boolean;

function getBoss(
  state: GameState,
  encounter: BossEncounterState,
): EnemyState | undefined {
  return state.enemies.find((enemy) => enemy.id === encounter.bossId);
}

function nextActorId(encounter: BossEncounterState, prefix: string): string {
  const id = `${prefix}-${encounter.nextActorId}`;
  encounter.nextActorId += 1;
  return id;
}

function nextRandomPattern(encounter: BossEncounterState): BossAttackPattern {
  let value = encounter.randomState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  encounter.randomState = value >>> 0;
  return ((encounter.randomState % 4) + 1) as BossAttackPattern;
}

function createActor(
  encounter: BossEncounterState,
  actor: Omit<
    BossActorState,
    "id" | "spawnCallEmitted" | "secondCallEmitted"
  >,
): BossActorState {
  return {
    ...actor,
    id: nextActorId(encounter, `boss-${actor.kind}`),
    spawnCallEmitted: false,
    secondCallEmitted: false,
  };
}

function createPatternActor(
  encounter: BossEncounterState,
  pattern: BossAttackPattern,
  position: Vector2State,
  velocity: Vector2State,
  facing: Facing,
  flightDuration: number,
): BossActorState {
  return createActor(encounter, {
    kind: "pattern",
    pattern,
    position,
    velocity,
    facing,
    age: 0,
    launchDelay:
      STAGE_TWO_CONFIG.phaseTwoPatternWarningSeconds +
      (pattern === 4
        ? STAGE_TWO_CONFIG.phaseTwoDoubleCallDelaySeconds
        : 0),
    flightDuration,
    damagesPlayer: true,
    secondCallTime:
      pattern === 4
        ? STAGE_TWO_CONFIG.phaseTwoDoubleCallDelaySeconds
        : null,
  });
}

function emitActorCall(
  state: GameState,
  actor: BossActorState,
  shortened: boolean,
): void {
  emitSound(
    state,
    shortened ? "waker-call-short" : "waker-call",
    actor.position,
    STAGE_TWO_CONFIG.phaseTwoCallDistance,
    STAGE_TWO_CONFIG.phaseTwoCallIntensity,
    actor.id,
  );
}

function emitActorCallWave(state: GameState, actor: BossActorState): void {
  emitSoundWave(
    state,
    "waker-call",
    actor.position,
    STAGE_TWO_CONFIG.phaseTwoCallDistance,
    STAGE_TWO_CONFIG.phaseTwoCallIntensity,
    actor.id,
  );
}

function addIntroSwarm(
  encounter: BossEncounterState,
  boss: EnemyState,
): void {
  for (
    let index = 0;
    index < STAGE_TWO_CONFIG.phaseTwoIntroActorCount;
    index += 1
  ) {
    const side: Facing = index % 2 === 0 ? -1 : 1;
    const streamIndex = Math.floor(index / 2);
    const horizontalSpeed =
      STAGE_TWO_CONFIG.phaseTwoIntroMinimumSpeed + (streamIndex % 4) * 55;
    encounter.actors.push(
      createActor(encounter, {
        kind: "intro-swarm",
        pattern: null,
        position: {
          x: boss.position.x + side * 22,
          y: boss.position.y - BOSS_TOP_OFFSET_Y + (streamIndex % 2) * 8,
        },
        velocity: {
          x: side * horizontalSpeed,
          y: -190 + streamIndex * 70,
        },
        facing: side,
        age:
          -streamIndex * STAGE_TWO_CONFIG.phaseTwoIntroSpawnIntervalSeconds,
        launchDelay: 0,
        flightDuration: 1.2,
        damagesPlayer: false,
        secondCallTime: null,
      }),
    );
  }
}

function spawnPhaseOneMinion(
  state: GameState,
  encounter: BossEncounterState,
  boss: EnemyState,
  side: Facing,
): void {
  const minion: EnemyState = {
    id: nextActorId(encounter, "boss-minion"),
    kind: ENEMY_KINDS.waker,
    position: {
      x: boss.position.x + side * 30,
      y: boss.position.y - BOSS_TOP_OFFSET_Y,
    },
    velocity: {
      x: side * STAGE_TWO_CONFIG.phaseOneEjectHorizontalSpeed,
      y: -STAGE_TWO_CONFIG.phaseOneEjectVerticalSpeed,
    },
    facing: side,
    attackFacing: side,
    grounded: false,
    health: STAGE_TWO_CONFIG.phaseOneMinionHealth,
    maxHealth: STAGE_TWO_CONFIG.phaseOneMinionHealth,
    alive: true,
    action: "eject",
    actionTime: 0,
    attackCooldown: 0,
    patrolMinX: 0,
    patrolMaxX: 0,
    footstepTravel: 0,
    echoTime: 0,
    echoDuration: 0,
    activated: true,
    timeUntilPulse: STAGE_ONE_CONFIG.activeEnemyPulseIntervalSeconds,
  };
  state.enemies.push(minion);
  emitSound(
    state,
    "waker-call",
    minion.position,
    STAGE_ONE_CONFIG.wakerPulseDistance,
    STAGE_ONE_CONFIG.activeEnemyPulseIntensity,
    minion.id,
  );
}

function beginPhaseTwo(
  encounter: BossEncounterState,
  boss: EnemyState,
): void {
  encounter.phase = 2;
  encounter.timeUntilNextPattern =
    STAGE_TWO_CONFIG.phaseTwoPatternIntervalSeconds;
  encounter.lastPattern = null;
  boss.health = STAGE_TWO_CONFIG.phaseTwoHealth;
  boss.maxHealth = STAGE_TWO_CONFIG.phaseTwoHealth;
  boss.action = "sleep";
  boss.actionTime = 0;
  addIntroSwarm(encounter, boss);
}

function beginPhaseThree(
  encounter: BossEncounterState,
  boss: EnemyState,
): void {
  encounter.phase = 3;
  encounter.timeUntilNextPattern = Number.POSITIVE_INFINITY;
  encounter.lastPattern = null;
  boss.health = 0;
  boss.action = "sleep";
  boss.actionTime = 0;
}

export function damageCocoonBoss(
  state: GameState,
  boss: EnemyState,
  knockbackDirection: Facing,
): boolean {
  const encounter = state.bossEncounter;
  if (
    !encounter ||
    encounter.bossId !== boss.id ||
    encounter.phase === 3 ||
    !boss.alive
  ) {
    return false;
  }

  boss.health = Math.max(0, boss.health - 1);
  boss.action = "hurt";
  boss.actionTime = 0;
  boss.echoTime = 0.72;
  boss.echoDuration = 0.72;
  state.events.push({
    type: "impact",
    position: { ...boss.position },
    strength: 0.8,
  });
  emitSound(
    state,
    "enemy-hit",
    boss.position,
    ENEMY_HIT_WAVE_CONFIG.distance,
    ENEMY_HIT_WAVE_CONFIG.intensity,
    boss.id,
  );

  if (encounter.phase === 1) {
    spawnPhaseOneMinion(state, encounter, boss, knockbackDirection);
    if (boss.health === 0) beginPhaseTwo(encounter, boss);
  } else if (boss.health === 0) {
    beginPhaseThree(encounter, boss);
  }
  return true;
}

export function triggerBossPattern(
  state: GameState,
  world: WorldDefinition,
  pattern: BossAttackPattern,
): BossActorState[] {
  const encounter = state.bossEncounter;
  if (!encounter || encounter.phase !== 2) return [];

  const speed = STAGE_TWO_CONFIG.phaseTwoPatternSpeed;
  const leftX = PATTERN_EDGE_INSET;
  const rightX = world.width - PATTERN_EDGE_INSET;
  const spawned: BossActorState[] = [];

  if (pattern === 1) {
    const side: Facing = nextRandomPattern(encounter) % 2 === 0 ? -1 : 1;
    const position = {
      x: side < 0 ? leftX : rightX,
      y: PATTERN_FLOOR_Y,
    };
    spawned.push(
      createPatternActor(
        encounter,
        pattern,
        position,
        { x: -side * speed, y: 0 },
        -side as Facing,
        (world.width + ACTOR_EXIT_MARGIN * 2) / speed,
      ),
    );
  } else if (pattern === 2) {
    const clampedPlayerX = Math.max(
      PATTERN_EDGE_INSET,
      Math.min(world.width - PATTERN_EDGE_INSET, state.player.position.x),
    );
    spawned.push(
      createPatternActor(
        encounter,
        pattern,
        { x: clampedPlayerX, y: PATTERN_TOP_Y },
        { x: 0, y: speed },
        1,
        (world.height + ACTOR_EXIT_MARGIN) / speed,
      ),
    );
  } else {
    for (const side of [-1, 1] as const) {
      const position = {
        x: side < 0 ? leftX : rightX,
        y: PATTERN_TOP_Y,
      };
      let velocity: Vector2State;
      let flightDuration: number;
      if (pattern === 3) {
        const target = {
          x: world.width / 2,
          y: PATTERN_CENTER_TARGET_Y,
        };
        const deltaX = target.x - position.x;
        const deltaY = target.y - position.y;
        const distance = Math.hypot(deltaX, deltaY);
        velocity = {
          x: (deltaX / distance) * speed,
          y: (deltaY / distance) * speed,
        };
        flightDuration = distance / speed;
      } else {
        velocity = { x: 0, y: speed };
        flightDuration = (world.height + ACTOR_EXIT_MARGIN) / speed;
      }
      spawned.push(
        createPatternActor(
          encounter,
          pattern,
          position,
          velocity,
          velocity.x < 0 ? -1 : 1,
          flightDuration,
        ),
      );
    }
  }

  encounter.lastPattern = pattern;
  encounter.actors.push(...spawned);
  for (const actor of spawned) emitActorCall(state, actor, pattern === 4);
  return spawned;
}

function actorTouchesPlayer(state: GameState, actor: BossActorState): boolean {
  return rectanglesOverlap(
    getPlayerBounds(state.player),
    centerRect(actor.position, BOSS_ACTOR_BODY.width, BOSS_ACTOR_BODY.height),
  );
}

function updateActors(
  state: GameState,
  world: WorldDefinition,
  deltaSeconds: number,
  damagePlayer: DamagePlayer,
): void {
  const encounter = state.bossEncounter;
  if (!encounter) return;

  for (const actor of encounter.actors) {
    const previousAge = actor.age;
    actor.age += deltaSeconds;
    if (
      actor.kind === "intro-swarm" &&
      !actor.spawnCallEmitted &&
      actor.age >= 0
    ) {
      actor.spawnCallEmitted = true;
      emitSound(
        state,
        "waker-call-burst",
        actor.position,
        STAGE_TWO_CONFIG.phaseTwoCallDistance,
        STAGE_TWO_CONFIG.phaseTwoCallIntensity,
        actor.id,
      );
    }
    if (
      actor.secondCallTime !== null &&
      !actor.secondCallEmitted &&
      previousAge < actor.secondCallTime &&
      actor.age >= actor.secondCallTime
    ) {
      actor.secondCallEmitted = true;
      emitActorCallWave(state, actor);
    }

    const previousFlightTime = Math.max(0, previousAge - actor.launchDelay);
    const flightTime = Math.max(0, actor.age - actor.launchDelay);
    const movementSeconds =
      Math.min(actor.flightDuration, flightTime) -
      Math.min(actor.flightDuration, previousFlightTime);
    if (movementSeconds > 0) {
      actor.position.x += actor.velocity.x * movementSeconds;
      actor.position.y += actor.velocity.y * movementSeconds;
      if (actor.damagesPlayer && actorTouchesPlayer(state, actor)) {
        const direction: Facing =
          actor.velocity.x < 0
            ? -1
            : actor.velocity.x > 0
              ? 1
              : actor.position.x < state.player.position.x
                ? 1
                : -1;
        damagePlayer(direction);
      }
    }
  }

  encounter.actors = encounter.actors.filter((actor) => {
    const flightFinished = actor.age - actor.launchDelay >= actor.flightDuration;
    const farOutside =
      actor.position.x < -ACTOR_EXIT_MARGIN ||
      actor.position.x > world.width + ACTOR_EXIT_MARGIN ||
      actor.position.y < -ACTOR_EXIT_MARGIN ||
      actor.position.y > world.height + ACTOR_EXIT_MARGIN;
    return !flightFinished && !farOutside;
  });
}

export function updateBossEncounter(
  state: GameState,
  world: WorldDefinition,
  deltaSeconds: number,
  damagePlayer: DamagePlayer,
): void {
  const encounter = state.bossEncounter;
  if (!encounter) return;

  updateActors(state, world, deltaSeconds, damagePlayer);
  if (encounter.phase !== 2 || state.player.action === "dead") return;

  encounter.timeUntilNextPattern -= deltaSeconds;
  while (encounter.timeUntilNextPattern <= 0) {
    triggerBossPattern(state, world, nextRandomPattern(encounter));
    encounter.timeUntilNextPattern +=
      STAGE_TWO_CONFIG.phaseTwoPatternIntervalSeconds;
  }

  const boss = getBoss(state, encounter);
  if (!boss) encounter.timeUntilNextPattern = Number.POSITIVE_INFINITY;
}
