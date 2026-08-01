export const ASSET_KEYS = {
  player: {
    idle: "character.player.idle",
    run: "character.player.run",
    dash: "character.player.dash",
    jumpStart: "character.player.jump-start",
    jump: "character.player.jump",
    jumpTransition: "character.player.jump-transition",
    jumpFall: "character.player.jump-fall",
    attack1: "character.player.attack-1",
    attack2: "character.player.attack-2",
    attack3: "character.player.attack-3",
    airAttack: "character.player.air-attack",
    hurt: "character.player.hurt",
    death: "character.player.death",
  },
  audio: {
    attack: "audio.attack",
    landing: "audio.landing",
    enemyHit: "audio.enemy-hit",
    walk: "audio.walk",
    enemyAlert: "audio.enemy-alert",
    enemyCall: "audio.enemy-call",
    growing: "audio.growing",
    crusherPulse: "audio.crusher-pulse",
    hazardPulse: "audio.hazard-pulse",
    sleepingEnemy: "audio.sleeping-enemy",
    water: "audio.water",
  },
} as const;

export const ANIMATION_KEYS = {
  player: {
    idle: "animation.player.idle",
    run: "animation.player.run",
    dash: "animation.player.dash",
    jumpStart: "animation.player.jump-start",
    jump: "animation.player.jump",
    jumpTransition: "animation.player.jump-transition",
    jumpFall: "animation.player.jump-fall",
    attack1: "animation.player.attack-1",
    attack2: "animation.player.attack-2",
    attack3: "animation.player.attack-3",
    airAttack: "animation.player.air-attack",
    hurt: "animation.player.hurt",
    death: "animation.player.death",
  },
} as const;

export const PLAYER_SPRITE_FRAME = {
  width: 96,
  height: 96,
} as const;

export const PLAYER_SPRITE_DISPLAY_SCALE = 3;

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
  dash: {
    textureKey: ASSET_KEYS.player.dash,
    animationKey: ANIMATION_KEYS.player.dash,
    path: "assets/characters/player/dash.png",
    frameCount: 8,
    frameRate: 30,
    repeat: 0,
  },
  jumpStart: {
    textureKey: ASSET_KEYS.player.jumpStart,
    animationKey: ANIMATION_KEYS.player.jumpStart,
    path: "assets/characters/player/jump-start.png",
    frameCount: 3,
    frameRate: 30,
    repeat: 0,
  },
  jump: {
    textureKey: ASSET_KEYS.player.jump,
    animationKey: ANIMATION_KEYS.player.jump,
    path: "assets/characters/player/jump.png",
    frameCount: 3,
    frameRate: 14,
    repeat: -1,
  },
  jumpTransition: {
    textureKey: ASSET_KEYS.player.jumpTransition,
    animationKey: ANIMATION_KEYS.player.jumpTransition,
    path: "assets/characters/player/jump-transition.png",
    frameCount: 3,
    frameRate: 18,
    repeat: 0,
  },
  jumpFall: {
    textureKey: ASSET_KEYS.player.jumpFall,
    animationKey: ANIMATION_KEYS.player.jumpFall,
    path: "assets/characters/player/jump-fall.png",
    frameCount: 3,
    frameRate: 12,
    repeat: -1,
  },
  attack1: {
    textureKey: ASSET_KEYS.player.attack1,
    animationKey: ANIMATION_KEYS.player.attack1,
    path: "assets/characters/player/attack-1.png",
    frameCount: 7,
    frameRate: 23,
    repeat: 0,
  },
  attack2: {
    textureKey: ASSET_KEYS.player.attack2,
    animationKey: ANIMATION_KEYS.player.attack2,
    path: "assets/characters/player/attack-2.png",
    frameCount: 7,
    frameRate: 23,
    repeat: 0,
  },
  attack3: {
    textureKey: ASSET_KEYS.player.attack3,
    animationKey: ANIMATION_KEYS.player.attack3,
    path: "assets/characters/player/attack-3.png",
    frameCount: 6,
    frameRate: 20,
    repeat: 0,
  },
  airAttack: {
    textureKey: ASSET_KEYS.player.airAttack,
    animationKey: ANIMATION_KEYS.player.airAttack,
    path: "assets/characters/player/air-attack.png",
    frameCount: 6,
    frameRate: 20,
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
  death: {
    textureKey: ASSET_KEYS.player.death,
    animationKey: ANIMATION_KEYS.player.death,
    path: "assets/characters/player/death.png",
    frameCount: 9,
    frameRate: 12,
    repeat: 0,
  },
} as const;

export const AUDIO_ASSETS = {
  attack: {
    key: ASSET_KEYS.audio.attack,
    path: "assets/audio/attack.wav",
  },
  landing: {
    key: ASSET_KEYS.audio.landing,
    path: "assets/audio/down2.wav",
  },
  enemyHit: {
    key: ASSET_KEYS.audio.enemyHit,
    path: "assets/audio/enemy-hit.wav",
  },
  walk: {
    key: ASSET_KEYS.audio.walk,
    path: "assets/audio/walk.wav",
  },
  enemyAlert: {
    key: ASSET_KEYS.audio.enemyAlert,
    path: "assets/audio/1grrrrrun.mp3",
  },
  enemyCall: {
    key: ASSET_KEYS.audio.enemyCall,
    path: "assets/audio/1kaaaaaak.mp3",
  },
  growing: {
    key: ASSET_KEYS.audio.growing,
    path: "assets/audio/jiiiingggg.mp3",
  },
  crusherPulse: {
    key: ASSET_KEYS.audio.crusherPulse,
    path: "assets/audio/jiiiingggg.mp3",
  },
  hazardPulse: {
    key: ASSET_KEYS.audio.hazardPulse,
    path: "assets/audio/jiiiingggg.mp3",
  },
  sleepingEnemy: {
    key: ASSET_KEYS.audio.sleepingEnemy,
    path: "assets/audio/1sleep.mp3",
  },
  water: {
    key: ASSET_KEYS.audio.water,
    path: "assets/audio/1water.mp3",
  },
} as const;
