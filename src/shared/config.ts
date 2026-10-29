/** Initial MVP tuning. Change here rather than introducing local magic numbers. */
export const GAME_CONFIG = {
  roundSeconds: 300,
  maxHealth: 100,
  player: { eyeHeight: 1.7, radius: 0.35, walkSpeed: 4, sprintSpeed: 6 },
  weapon: {
    magazineSize: 8,
    startingReserve: 48,
    damage: 34,
    cooldownSeconds: 0.25,
    reloadSeconds: 1.5,
    presentation: {
      viewPosition: [0.31, -0.16, -0.9],
      viewRotation: [0.02, 0.15, -0.04],
      viewScale: 0.82,
      recoilDistance: 0.035,
      recoilPitchRadians: 0.045,
      recoilRecoverySeconds: 0.13,
      muzzleFlashSeconds: 0.075,
    },
  },
  zombie: { health: 100, radius: 0.4, speed: 1.1, attackRange: 1.3, damage: 10, attackCooldownSeconds: 1 },
  spawning: { initialIntervalSeconds: 4, minimumIntervalSeconds: 0.8, maxAlive: 24, minPlayerDistance: 8 },
  pickups: { healthAmount: 25, ammoAmount: 16, collectRadius: 1.2 },
  warehouse: { width: 40, depth: 56, height: 9 },
} as const;
