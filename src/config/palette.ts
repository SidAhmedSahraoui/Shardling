export const palette = {
  bg0: 0x0e0f1a,
  bg1: 0x171a2b,
  fog: 0x1a2635,
  skyHorizon: 0x2b3457,
  star: 0xc4d7ff,
  island: 0x232a45,
  abyss: 0x0a0b14,
  terrain: 0x23263a,
  terrainTop: 0x2c3049,
  player: 0x323b52,
  playerVein: 0x6ad9f5,
  eye: 0x7df0ff,
  eyeWhite: 0xf4fdff,
  pupil: 0x121826,
  shard: 0xffc24b,
  hazard: 0xff4e6a,
  portal: 0x46e0d4,
  bouncer: 0x5ee6a8,
  worldAccents: [0xffc24b, 0x9b8cff, 0x5ee6a8, 0xff7a9e],
} as const;

export interface WorldTheme {
  name: string;
  skyZenith: number;
  skyMid: number;
  skyHorizonBand: number;
  skyAbyss: number;
  fog: number;
  terrain: number;
  terrainTop: number;
  grout: number;
  trim: number;
  star: number;
  island: number;
  crystal: number;
  cloud: number;
  sunTint: number;
  lightPoolStrength: number;
}

export const worldThemes: readonly [
  WorldTheme,
  WorldTheme,
  WorldTheme,
  WorldTheme,
] = [
  {
    name: "dawnmeadow",
    skyZenith: 0x4a67c8,
    skyMid: 0x7e97e2,
    skyHorizonBand: 0xf5c78e,
    skyAbyss: 0x4c5b96,
    fog: 0x8ba2da,
    terrain: 0x8188b8,
    terrainTop: 0xaab2dc,
    grout: 0x6f77a8,
    trim: 0xffc24b,
    star: 0xfff3d8,
    island: 0x6d82c4,
    crystal: 0xffd98a,
    cloud: 0xd9c0a2,
    sunTint: 0xfff1dc,
    lightPoolStrength: 0.4,
  },
  {
    name: "duskspire",
    skyZenith: 0x4a4a8f,
    skyMid: 0x7a6fc4,
    skyHorizonBand: 0xe8949e,
    skyAbyss: 0x413e78,
    fog: 0x8579c0,
    terrain: 0x79719f,
    terrainTop: 0xa79dc9,
    grout: 0x685f91,
    trim: 0x9b8cff,
    star: 0xe6dcff,
    island: 0x5f568f,
    crystal: 0xffc9a0,
    cloud: 0xc9a2c0,
    sunTint: 0xf6e3ff,
    lightPoolStrength: 0.42,
  },
  {
    name: "springglass",
    skyZenith: 0x2f6f80,
    skyMid: 0x5da9ab,
    skyHorizonBand: 0xbdf0d0,
    skyAbyss: 0x2c5a6c,
    fog: 0x6fada9,
    terrain: 0x6f958f,
    terrainTop: 0x9ec4ba,
    grout: 0x5d827d,
    trim: 0xd9f06b,
    star: 0xdcfff0,
    island: 0x49736f,
    crystal: 0xffd9a0,
    cloud: 0xb6d9c8,
    sunTint: 0xeafff2,
    lightPoolStrength: 0.42,
  },
  {
    name: "emberhollow",
    skyZenith: 0x4a2a52,
    skyMid: 0x8f4a63,
    skyHorizonBand: 0xffb079,
    skyAbyss: 0x3a1f42,
    fog: 0x9c5f6c,
    terrain: 0x8c6a78,
    terrainTop: 0xc09a9e,
    grout: 0x6f5060,
    trim: 0xff7a9e,
    star: 0xffe6cf,
    island: 0x6b4260,
    crystal: 0x8fd8ff,
    cloud: 0xe8a48f,
    sunTint: 0xffdfc9,
    lightPoolStrength: 0.5,
  },
];

export function worldTheme(world: number): WorldTheme {
  const index = Math.min(Math.max(Math.round(world), 1), worldThemes.length);
  return worldThemes[index - 1] ?? worldThemes[0];
}

export const lighting = {
  hemiSky: 0xffffff,
  hemiGround: palette.bg0,
  directional: 0xffffff,
} as const;

export type Palette = typeof palette;
