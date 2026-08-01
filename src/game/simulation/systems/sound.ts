import {
  ENEMY_KINDS,
  type TerrainBlock,
  type WorldDefinition,
} from "../../content/world";
import { centerRect, raycastAabb, segmentIntersectsAabb } from "../collision/aabb";
import { ENEMY_CONFIG, getEnemyBodySize, SOUND_CONFIG } from "../rules/config";
import type {
  EchoMarkState,
  Facing,
  GameState,
  SoundKind,
  SoundRayState,
  Vector2State,
} from "../state";
import { getActiveTerrain, revealTerrainMechanism } from "./stageMechanisms";

export const PLAYER_SOUND_SOURCE_ID = "player";

const ADJACENT_TERRAIN_PROBE_DISTANCE = 0.5;
const ECHO_MARK_MINIMUM_LENGTH = 0.01;

export function emitSound(
  state: GameState,
  kind: SoundKind,
  position: Vector2State,
  maximumDistance: number,
  intensity: number,
  sourceId?: string,
): void {
  const rays: SoundRayState[] = [];
  for (let index = 0; index < SOUND_CONFIG.initialRayCount; index += 1) {
    const angle = (index / SOUND_CONFIG.initialRayCount) * Math.PI * 2;
    rays.push({
      position: { ...position },
      previousPosition: { ...position },
      direction: { x: Math.cos(angle), y: Math.sin(angle) },
      remainingDistance: maximumDistance,
      intensity,
      reflectionCount: 0,
      pathKey: "source",
      active: true,
    });
  }

  state.soundWaves.push({
    id: state.nextWaveId,
    kind,
    sourceId,
    origin: { ...position },
    rays,
    reactedEnemyIds: [],
  });
  state.nextWaveId += 1;
  state.events.push({ type: "sound", kind, position: { ...position }, intensity });

  if (sourceId) {
    const sourceEnemy = state.enemies.find((enemy) => enemy.id === sourceId);
    if (sourceEnemy) {
      sourceEnemy.echoTime = SOUND_CONFIG.enemyEchoSeconds;
      sourceEnemy.echoDuration = SOUND_CONFIG.enemyEchoSeconds;
    }
  }
}

export function createEchoMark(
  block: TerrainBlock,
  position: Vector2State,
  normal: Vector2State,
  intensity: number,
): EchoMarkState {
  const halfLength = 14 + 34 * intensity;
  let start: Vector2State;
  let end: Vector2State;

  if (Math.abs(normal.x) > 0.5) {
    start = {
      x: position.x,
      y: Math.max(block.bounds.y, position.y - halfLength),
    };
    end = {
      x: position.x,
      y: Math.min(block.bounds.y + block.bounds.height, position.y + halfLength),
    };
  } else {
    start = {
      x: Math.max(block.bounds.x, position.x - halfLength),
      y: position.y,
    };
    end = {
      x: Math.min(block.bounds.x + block.bounds.width, position.x + halfLength),
      y: position.y,
    };
  }

  return {
    surfaceId: block.id,
    start,
    end,
    intensity,
    time: SOUND_CONFIG.echoSeconds,
    duration: SOUND_CONFIG.echoSeconds,
  };
}

function subtractCoveredRange(
  ranges: Array<[number, number]>,
  coveredStart: number,
  coveredEnd: number,
): Array<[number, number]> {
  return ranges.flatMap(([start, end]) => {
    const overlapStart = Math.max(start, coveredStart);
    const overlapEnd = Math.min(end, coveredEnd);
    if (overlapEnd - overlapStart <= ECHO_MARK_MINIMUM_LENGTH) {
      return [[start, end]];
    }

    const remaining: Array<[number, number]> = [];
    if (overlapStart - start > ECHO_MARK_MINIMUM_LENGTH) {
      remaining.push([start, overlapStart]);
    }
    if (end - overlapEnd > ECHO_MARK_MINIMUM_LENGTH) {
      remaining.push([overlapEnd, end]);
    }
    return remaining;
  });
}

export function createExposedEchoMarks(
  block: TerrainBlock,
  terrain: TerrainBlock[],
  position: Vector2State,
  normal: Vector2State,
  intensity: number,
): EchoMarkState[] {
  const mark = createEchoMark(block, position, normal, intensity);
  const vertical = Math.abs(normal.x) > 0.5;
  const surfaceCoordinate = vertical ? mark.start.x : mark.start.y;
  const outwardNormal = vertical ? normal.x : normal.y;
  const probeCoordinate =
    surfaceCoordinate + outwardNormal * ADJACENT_TERRAIN_PROBE_DISTANCE;
  let exposedRanges: Array<[number, number]> = vertical
    ? [[mark.start.y, mark.end.y]]
    : [[mark.start.x, mark.end.x]];

  for (const other of terrain) {
    if (other.id === block.id) {
      continue;
    }

    const bounds = other.bounds;
    const blocksSurface = vertical
      ? probeCoordinate >= bounds.x &&
        probeCoordinate <= bounds.x + bounds.width
      : probeCoordinate >= bounds.y &&
        probeCoordinate <= bounds.y + bounds.height;
    if (!blocksSurface) {
      continue;
    }

    exposedRanges = vertical
      ? subtractCoveredRange(
          exposedRanges,
          bounds.y,
          bounds.y + bounds.height,
        )
      : subtractCoveredRange(
          exposedRanges,
          bounds.x,
          bounds.x + bounds.width,
        );
  }

  return exposedRanges.map(([start, end]) => ({
    ...mark,
    start: vertical
      ? { x: mark.start.x, y: start }
      : { x: start, y: mark.start.y },
    end: vertical
      ? { x: mark.end.x, y: end }
      : { x: end, y: mark.end.y },
  }));
}

function addEchoMark(
  state: GameState,
  world: WorldDefinition,
  block: TerrainBlock,
  position: Vector2State,
  normal: Vector2State,
  intensity: number,
): void {
  state.echoMarks.push(
    ...createExposedEchoMarks(
      block,
      world.terrain,
      position,
      normal,
      intensity,
    ),
  );

  if (state.echoMarks.length > SOUND_CONFIG.maximumEchoMarks) {
    state.echoMarks.splice(
      0,
      state.echoMarks.length - SOUND_CONFIG.maximumEchoMarks,
    );
  }
}

function interpolateRay(a: SoundRayState, b: SoundRayState): SoundRayState {
  const direction = {
    x: a.direction.x + b.direction.x,
    y: a.direction.y + b.direction.y,
  };
  const directionLength = Math.hypot(direction.x, direction.y);
  const normalizedDirection =
    directionLength > 0.0001
      ? { x: direction.x / directionLength, y: direction.y / directionLength }
      : { ...a.direction };

  return {
    position: {
      x: (a.position.x + b.position.x) / 2,
      y: (a.position.y + b.position.y) / 2,
    },
    previousPosition: {
      x: (a.previousPosition.x + b.previousPosition.x) / 2,
      y: (a.previousPosition.y + b.previousPosition.y) / 2,
    },
    direction: normalizedDirection,
    remainingDistance: (a.remainingDistance + b.remainingDistance) / 2,
    intensity: (a.intensity + b.intensity) / 2,
    reflectionCount: a.reflectionCount,
    pathKey: a.pathKey,
    active: true,
  };
}

function subdivideWavefront(rays: SoundRayState[]): SoundRayState[] {
  let result = rays;
  let needsAnotherPass = true;

  while (needsAnotherPass) {
    needsAnotherPass = false;
    const subdivided: SoundRayState[] = [];

    for (let index = 0; index < result.length; index += 1) {
      const ray = result[index];
      const next = result[(index + 1) % result.length];
      subdivided.push(ray);

      if (!ray.active || !next.active || ray.pathKey !== next.pathKey) {
        continue;
      }

      const separation = Math.hypot(
        next.position.x - ray.position.x,
        next.position.y - ray.position.y,
      );
      if (separation > SOUND_CONFIG.maximumRaySpacing) {
        subdivided.push(interpolateRay(ray, next));
        needsAnotherPass = true;
      }
    }

    result = subdivided;
  }

  return result;
}

export function updateSoundPropagation(
  state: GameState,
  world: WorldDefinition,
  deltaSeconds: number,
): void {
  const activeTerrain = getActiveTerrain(state, world);
  const activeWorld = { ...world, terrain: activeTerrain };
  for (const mark of state.echoMarks) {
    mark.time -= deltaSeconds;
  }
  state.echoMarks = state.echoMarks.filter((mark) => mark.time > 0);

  for (const enemy of state.enemies) {
    enemy.echoTime = Math.max(0, enemy.echoTime - deltaSeconds);
  }

  const travelThisStep = SOUND_CONFIG.speed * deltaSeconds;
  for (const wave of state.soundWaves) {
    for (const ray of wave.rays) {
      if (!ray.active) {
        continue;
      }

      ray.previousPosition = { ...ray.position };
      const allowedTravel = Math.min(travelThisStep, ray.remainingDistance);
      let nearestHit: {
        hit: NonNullable<ReturnType<typeof raycastAabb>>;
        block: TerrainBlock;
      } | null = null;

      for (const block of activeTerrain) {
        const hit = raycastAabb(
          ray.position,
          ray.direction,
          allowedTravel,
          block.bounds,
        );
        if (hit && (!nearestHit || hit.distance < nearestHit.hit.distance)) {
          nearestHit = { hit, block };
        }
      }

      const segmentEnd = nearestHit
        ? nearestHit.hit.point
        : {
            x: ray.position.x + ray.direction.x * allowedTravel,
            y: ray.position.y + ray.direction.y * allowedTravel,
          };

      for (const hazard of state.hazards) {
        if (segmentIntersectsAabb(ray.position, segmentEnd, hazard.bounds)) {
          hazard.echoTime = Math.max(hazard.echoTime, SOUND_CONFIG.enemyEchoSeconds);
          hazard.echoDuration = SOUND_CONFIG.enemyEchoSeconds;
        }
      }

      for (const enemy of state.enemies) {
        const body = getEnemyBodySize(enemy.kind);
        const echoPosition = enemy.alive
          ? enemy.position
          : {
              x: enemy.position.x,
              y: enemy.position.y + ENEMY_CONFIG.corpseEchoOffsetY,
            };
        const enemyBounds = centerRect(
          echoPosition,
          enemy.alive ? body.width : ENEMY_CONFIG.corpseEchoWidth,
          enemy.alive ? body.height : ENEMY_CONFIG.corpseEchoHeight,
        );
        if (segmentIntersectsAabb(ray.position, segmentEnd, enemyBounds)) {
          if (enemy.echoTime <= SOUND_CONFIG.enemyEchoSeconds) {
            enemy.echoTime = SOUND_CONFIG.enemyEchoSeconds;
            enemy.echoDuration = SOUND_CONFIG.enemyEchoSeconds;
          }
          if (
            enemy.alive &&
            wave.sourceId === PLAYER_SOUND_SOURCE_ID &&
            enemy.kind !== ENEMY_KINDS.sleeper &&
            enemy.kind !== ENEMY_KINDS.waker &&
            !wave.reactedEnemyIds.includes(enemy.id)
          ) {
            const directionTowardSound: Facing =
              ray.direction.x > 0
                ? -1
                : ray.direction.x < 0
                  ? 1
                  : wave.origin.x <= enemy.position.x
                    ? -1
                    : 1;
            enemy.facing = directionTowardSound;
            wave.reactedEnemyIds.push(enemy.id);
          }
        }
      }

      if (nearestHit) {
        const { hit, block } = nearestHit;
        revealTerrainMechanism(state, world, block.id);
        ray.remainingDistance =
          (ray.remainingDistance - hit.distance) *
          SOUND_CONFIG.reflectionDistanceRetention;
        ray.intensity *= SOUND_CONFIG.reflectionIntensityRetention;
        const dot =
          ray.direction.x * hit.normal.x + ray.direction.y * hit.normal.y;
        ray.direction = {
          x: ray.direction.x - 2 * dot * hit.normal.x,
          y: ray.direction.y - 2 * dot * hit.normal.y,
        };
        ray.position = {
          x: hit.point.x + hit.normal.x * SOUND_CONFIG.raySurfaceOffset,
          y: hit.point.y + hit.normal.y * SOUND_CONFIG.raySurfaceOffset,
        };
        ray.reflectionCount += 1;
        ray.pathKey += `|${block.id}:${hit.normal.x},${hit.normal.y}`;
        addEchoMark(state, activeWorld, block, hit.point, hit.normal, ray.intensity);
      } else {
        ray.position = segmentEnd;
        ray.remainingDistance -= allowedTravel;
      }

      if (ray.remainingDistance < SOUND_CONFIG.minimumRemainingDistance) {
        ray.active = false;
      }
    }

    wave.rays = subdivideWavefront(wave.rays);
  }

  state.soundWaves = state.soundWaves.filter((wave) =>
    wave.rays.some((ray) => ray.active),
  );
}
