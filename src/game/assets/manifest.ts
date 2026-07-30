export const ASSET_KEYS = {
  player: {
    idle: "character.player.idle",
    run: "character.player.run",
    attack: "character.player.attack",
    hurt: "character.player.hurt",
  },
} as const;

export const ANIMATION_KEYS = {
  player: {
    idle: "animation.player.idle",
    run: "animation.player.run",
    attack: "animation.player.attack",
    hurt: "animation.player.hurt",
  },
} as const;

export const PLAYER_SPRITE_FRAME = {
  width: 96,
  height: 96,
} as const;

export const PLAYER_SPRITESHEETS = {
  idle: {
    textureKey: ASSET_KEYS.player.idle,
    animationKey: ANIMATION_KEYS.player.idle,
    path: "assets/characters/player/idle.png",
    frameCount: 10,
    frameRate: 8,
    repeat: -1,
  },
  run: {
    textureKey: ASSET_KEYS.player.run,
    animationKey: ANIMATION_KEYS.player.run,
    path: "assets/characters/player/run.png",
    frameCount: 16,
    frameRate: 20,
    repeat: -1,
  },
  attack: {
    textureKey: ASSET_KEYS.player.attack,
    animationKey: ANIMATION_KEYS.player.attack,
    path: "assets/characters/player/attack.png",
    frameCount: 7,
    frameRate: 23,
    repeat: 0,
  },
  hurt: {
    textureKey: ASSET_KEYS.player.hurt,
    animationKey: ANIMATION_KEYS.player.hurt,
    path: "assets/characters/player/hurt.png",
    frameCount: 4,
    frameRate: 13,
    repeat: 0,
  },
} as const;
