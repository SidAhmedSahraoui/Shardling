import { tuning } from "../config/tuning";

export type DeviceTier = "lo" | "mid" | "hi";

export interface DeviceProfile {
  tier: DeviceTier;
  maxDpr: number;
  bloomHalfRes: boolean;
  smaa: boolean;
  shadowMaps: boolean;
}

export interface DeviceCaps {
  hardwareConcurrency: number;
  deviceMemoryGb: number | undefined;
  isMobileLike: boolean;
}

const WEAK_MAX_CORES = 2;
const WEAK_MAX_MEMORY_GB = 2;
const MOBILE_LO_MAX_CORES = 4;
const HI_MIN_CORES = 8;
const HI_MIN_MEMORY_GB = 8;
const FALLBACK_CORES = 4;

export function classifyTier(caps: DeviceCaps): DeviceTier {
  const {
    hardwareConcurrency: cores,
    deviceMemoryGb: memGb,
    isMobileLike,
  } = caps;
  const veryWeak =
    cores <= WEAK_MAX_CORES ||
    (memGb !== undefined && memGb <= WEAK_MAX_MEMORY_GB);
  if (veryWeak || (isMobileLike && cores <= MOBILE_LO_MAX_CORES)) {
    return "lo";
  }
  if (
    !isMobileLike &&
    (cores >= HI_MIN_CORES ||
      (memGb !== undefined && memGb >= HI_MIN_MEMORY_GB))
  ) {
    return "hi";
  }
  return "mid";
}

export function profileForTier(tier: DeviceTier): DeviceProfile {
  switch (tier) {
    case "lo":
      return {
        tier,
        maxDpr: Math.min(tuning.tierDprLo, tuning.maxDpr),
        bloomHalfRes: true,
        smaa: false,
        shadowMaps: false,
      };
    case "mid":
      return {
        tier,
        maxDpr: Math.min(tuning.tierDprMid, tuning.maxDpr),
        bloomHalfRes: true,
        smaa: false,
        shadowMaps: false,
      };
    case "hi":
      return {
        tier,
        maxDpr: Math.min(tuning.tierDprHi, tuning.maxDpr),
        bloomHalfRes: false,
        smaa: true,
        shadowMaps: true,
      };
  }
}

interface BrowserGlobals {
  navigator?: {
    hardwareConcurrency?: number;
    deviceMemory?: number;
    userAgentData?: { mobile?: boolean };
  };
  location?: { search: string };
  matchMedia?: (query: string) => { matches: boolean };
}

export function detectDevice(): DeviceProfile {
  const g = globalThis as BrowserGlobals;
  const override = parseTierOverride(g.location?.search ?? "");
  return profileForTier(override ?? classifyTier(readCaps(g)));
}

function readCaps(g: BrowserGlobals): DeviceCaps {
  return {
    hardwareConcurrency: g.navigator?.hardwareConcurrency || FALLBACK_CORES,
    deviceMemoryGb: g.navigator?.deviceMemory,
    isMobileLike: detectMobileLike(g),
  };
}

function detectMobileLike(g: BrowserGlobals): boolean {
  if (g.navigator?.userAgentData?.mobile === true) {
    return true;
  }
  return g.matchMedia?.("(pointer: coarse)").matches ?? false;
}

function parseTierOverride(search: string): DeviceTier | undefined {
  const value = new URLSearchParams(search).get("tier");
  return value === "lo" || value === "mid" || value === "hi"
    ? value
    : undefined;
}
