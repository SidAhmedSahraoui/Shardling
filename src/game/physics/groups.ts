export const GROUP_PLAYER = 0x0001;
export const GROUP_TERRAIN = 0x0002;
export const GROUP_HAZARD = 0x0004;
export const GROUP_PICKUP = 0x0008;
export const GROUP_TRIGGER = 0x0010;

const QUERY_MEMBERSHIP_ALL = 0xffff;

export function interactionGroups(membership: number, filter: number): number {
  return ((membership << 16) | filter) >>> 0;
}

export const playerColliderGroups = interactionGroups(
  GROUP_PLAYER,
  GROUP_TERRAIN | GROUP_HAZARD | GROUP_PICKUP | GROUP_TRIGGER,
);

export const terrainColliderGroups = interactionGroups(
  GROUP_TERRAIN,
  GROUP_PLAYER,
);

export const hazardColliderGroups = interactionGroups(
  GROUP_HAZARD,
  GROUP_PLAYER,
);

export const pickupColliderGroups = interactionGroups(
  GROUP_PICKUP,
  GROUP_PLAYER,
);

export const triggerColliderGroups = interactionGroups(
  GROUP_TRIGGER,
  GROUP_PLAYER,
);

export const castFilterTerrainOnly = interactionGroups(
  QUERY_MEMBERSHIP_ALL,
  GROUP_TERRAIN,
);
