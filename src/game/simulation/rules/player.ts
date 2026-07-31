import type { RectState } from "../../content/world";
import { centerRect } from "../collision/aabb";
import type { PlayerState } from "../state";
import { PLAYER_CONFIG } from "./config";

export function getPlayerBounds(player: PlayerState): RectState {
  return centerRect(
    {
      x: player.position.x + player.hitboxOffsetX,
      y: player.position.y,
    },
    PLAYER_CONFIG.width,
    PLAYER_CONFIG.height,
  );
}
