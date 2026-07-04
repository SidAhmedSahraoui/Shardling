import { describe, expect, it } from "vitest";

import { classifyTier, type DeviceCaps } from "../src/core/Device";

function caps(
  hardwareConcurrency: number,
  deviceMemoryGb: number | undefined,
  isMobileLike: boolean,
): DeviceCaps {
  return { hardwareConcurrency, deviceMemoryGb, isMobileLike };
}

describe("classifyTier", () => {
  describe("hi (desktop-class)", () => {
    it("desktop at the 8-core boundary is hi", () => {
      expect(classifyTier(caps(8, undefined, false))).toBe("hi");
    });

    it("desktop at the 8 GiB boundary is hi even with few cores", () => {
      expect(classifyTier(caps(4, 8, false))).toBe("hi");
    });

    it("strong desktop is hi", () => {
      expect(classifyTier(caps(16, 8, false))).toBe("hi");
    });
  });

  describe("mid", () => {
    it("desktop one core below the hi boundary is mid", () => {
      expect(classifyTier(caps(7, undefined, false))).toBe("mid");
    });

    it("desktop just under the hi memory boundary is mid", () => {
      expect(classifyTier(caps(4, 7.9, false))).toBe("mid");
    });

    it("mobile-like is never hi, even with desktop-class hardware", () => {
      expect(classifyTier(caps(8, 8, true))).toBe("mid");
    });

    it("mobile-like one core above the lo boundary is mid", () => {
      expect(classifyTier(caps(5, 4, true))).toBe("mid");
    });

    it("desktop with unknown memory and middling cores is mid", () => {
      expect(classifyTier(caps(4, undefined, false))).toBe("mid");
    });
  });

  describe("lo", () => {
    it("mobile-like at the 4-core boundary is lo", () => {
      expect(classifyTier(caps(4, 4, true))).toBe("lo");
    });

    it("mobile-like at the 4-core boundary with unknown memory is lo", () => {
      expect(classifyTier(caps(4, undefined, true))).toBe("lo");
    });

    it("mobile-like at the 2 GiB boundary is lo despite many cores", () => {
      expect(classifyTier(caps(6, 2, true))).toBe("lo");
    });

    it("very weak core count is lo on any form factor", () => {
      expect(classifyTier(caps(2, undefined, false))).toBe("lo");
    });

    it("very low memory is lo on any form factor, overriding core count", () => {
      expect(classifyTier(caps(8, 2, false))).toBe("lo");
    });
  });
});
