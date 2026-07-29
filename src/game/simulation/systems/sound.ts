import type { WorldDefinition } from "../../content/world";
import { centerRect, raycastAabb, segmentIntersectsAabb } from "../collision/aabb";
import { ENEMY_CONFIG, SOUND_CONFIG } from "../rules/config";
import type {
  GameState,
  SoundKind,
  SoundRayState,
  Vector2State,
} from "../state";

export function emitSound(
  state: GameState,
  kind: SoundKind,
  position: Vector2State,
  maximumDistance: number,
  intensity: number,
  sourceId?: string,
): void {
  const rays: SoundRayState[] = [];
  for (let index = 0; index < SOUND_CONFIG.rayCount; index += 1) {
    const angle = (index / SOUND_CONFIG.rayCount) * Math.PI * 2;
    rays.push({
      position: { ...position },
      previousPosition: { ...position },
      direction: { x: Math.cos(angle), y: Math.sin(angle) },
      remainingDistance: maximumDistance,
      intensity,
      reflectionCount: 0,
      active: true,
    });
  }

  state.soundWaves.push({
    id: state.nextWaveId,
    kind,
    sourceId,
    origin: { ...position },
    rays,
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

function addEchoMark(
  state: GameState,
  position: Vector2State,
  normal: Vector2State,
  intensity: number,
): void {
  state.echoMarks.push({
    position: { ...position },
    normal: { ...normal },
    intensity,
    time: SOUND_CONFIG.echoSeconds,
    duration: SOUND_CONFIG.echoSeconds,
  });

  if (state.echoMarks.length > SOUND_CONFIG.maximumEchoMarks) {
    state.echoMarks.splice(
      0,
      state.echoMarks.length - SOUND_CONFIG.maximumEchoMarks,
    );
  }
}

export function updateSoundPropagation(
  state: GameState,
  world: WorldDefinition,
  deltaSeconds: number,
): void {
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
      let nearestHit: ReturnType<typeof raycastAabb> = null;

      for (const block of world.terrain) {
        const hit = raycastAabb(
          ray.position,
          ray.direction,
          allowedTravel,
          block.bounds,
        );
        if (hit && (!nearestHit || hit.distance < nearestHit.distance)) {
          nearestHit = hit;
        }
      }

      const segmentEnd = nearestHit
        ? nearestHit.point
        : {
            x: ray.position.x + ray.direction.x * allowedTravel,
            y: ray.position.y + ray.direction.y * allowedTravel,
          };

      for (const enemy of state.enemies) {
        if (!enemy.alive) {
          continue;
        }
        const enemyBounds = centerRect(
          enemy.position,
          ENEMY_CONFIG.width,
          ENEMY_CONFIG.height,
        );
        if (segmentIntersectsAabb(ray.position, segmentEnd, enemyBounds)) {
          enemy.echoTime = Math.max(enemy.echoTime, SOUND_CONFIG.enemyEchoSeconds);
          enemy.echoDuration = SOUND_CONFIG.enemyEchoSeconds;
        }
      }

      if (nearestHit) {
        ray.remainingDistance =
          (ray.remainingDistance - nearestHit.distance) *
          SOUND_CONFIG.reflectionDistanceRetention;
        ray.intensity *= SOUND_CONFIG.reflectionIntensityRetention;
        const dot =
          ray.direction.x * nearestHit.normal.x +
          ray.direction.y * nearestHit.normal.y;
        ray.direction = {
          x: ray.direction.x - 2 * dot * nearestHit.normal.x,
          y: ray.direction.y - 2 * dot * nearestHit.normal.y,
        };
        ray.position = {
          x:
            nearestHit.point.x +
            nearestHit.normal.x * SOUND_CONFIG.raySurfaceOffset,
          y:
            nearestHit.point.y +
            nearestHit.normal.y * SOUND_CONFIG.raySurfaceOffset,
        };
        ray.reflectionCount += 1;
        addEchoMark(state, nearestHit.point, nearestHit.normal, ray.intensity);
      } else {
        ray.position = segmentEnd;
        ray.remainingDistance -= allowedTravel;
      }

      if (ray.remainingDistance < SOUND_CONFIG.minimumRemainingDistance) {
        ray.active = false;
      }
    }
  }

  state.soundWaves = state.soundWaves.filter((wave) =>
    wave.rays.some((ray) => ray.active),
  );
}
