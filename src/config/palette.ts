export const palette = {
  bg0: 0x0e0f1a,
  bg1: 0x171a2b,
  terrain: 0x23263a,
  terrainTop: 0x2c3049,
  player: 0x14151f,
  eye: 0x7df0ff,
  shard: 0xffc24b,
  hazard: 0xff4e6a,
  portal: 0x46e0d4,
  bouncer: 0x5ee6a8,
  worldAccents: [0xffc24b, 0x9b8cff, 0x5ee6a8, 0xff7a9e],
} as const;

export const lighting = {
  hemiSky: 0xffffff,
  hemiGround: palette.bg0,
  directional: 0xffffff,
} as const;

export type Palette = typeof palette;
