import { describe, expect, it } from "vitest";

import { tuning } from "../src/config/tuning";
import type { JumpIntents } from "../src/entities/player/PlayerStateMachine";
import { PlayerStateMachine } from "../src/entities/player/PlayerStateMachine";

const DT_MS = 1000 / 60;

const INSIDE_COYOTE_TICKS = 5;
const PAST_COYOTE_TICKS = 8;
const INSIDE_BUFFER_TICKS = 6;
const PAST_BUFFER_TICKS = 9;

const RISING_VY = tuning.jumpVelocity;
const FALLING_VY = -4;

interface TickOverrides {
  grounded?: boolean;
  jumpPressed?: boolean;
  jumpHeld?: boolean;
  vy?: number;
  dtMs?: number;
}

function tick(sm: PlayerStateMachine, o: TickOverrides = {}): JumpIntents {
  const out = sm.step({
    grounded: o.grounded ?? false,
    jumpPressed: o.jumpPressed ?? false,
    jumpHeld: o.jumpHeld ?? false,
    vy: o.vy ?? 0,
    dtMs: o.dtMs ?? DT_MS,
  });
  return { jump: out.jump, doubleJump: out.doubleJump, cut: out.cut };
}

function pressJump(sm: PlayerStateMachine, o: TickOverrides = {}): JumpIntents {
  return tick(sm, { jumpPressed: true, jumpHeld: true, ...o });
}

const NONE: JumpIntents = { jump: false, doubleJump: false, cut: false };
const JUMP: JumpIntents = { jump: true, doubleJump: false, cut: false };
const DOUBLE: JumpIntents = { jump: false, doubleJump: true, cut: false };
const CUT: JumpIntents = { jump: false, doubleJump: false, cut: true };

function groundedMachine(): PlayerStateMachine {
  const sm = new PlayerStateMachine();
  expect(tick(sm, { grounded: true })).toEqual(NONE);
  expect(sm.state).toBe("grounded");
  return sm;
}

function spentDoubleFalling(): PlayerStateMachine {
  const sm = groundedMachine();
  expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
  expect(tick(sm, { vy: RISING_VY, jumpHeld: true })).toEqual(NONE);
  expect(pressJump(sm, { vy: RISING_VY })).toEqual(DOUBLE);
  expect(tick(sm, { vy: FALLING_VY })).toEqual(NONE);
  expect(sm.state).toBe("doubleJumped");
  return sm;
}

function walkOffAndWait(sm: PlayerStateMachine, pressTick: number): void {
  tick(sm, { vy: -1 });
  for (let i = 0; i < pressTick - 1; i += 1) {
    tick(sm, { vy: FALLING_VY });
  }
}

describe("harness assumptions", () => {
  it("tick constants sit clearly inside/outside the tuning windows", () => {
    expect(INSIDE_COYOTE_TICKS * DT_MS).toBeLessThan(tuning.coyoteMs - 10);
    expect(PAST_COYOTE_TICKS * DT_MS).toBeGreaterThan(tuning.coyoteMs + 10);
    expect(INSIDE_BUFFER_TICKS * DT_MS).toBeLessThan(tuning.jumpBufferMs - 10);
    expect(PAST_BUFFER_TICKS * DT_MS).toBeGreaterThan(tuning.jumpBufferMs + 10);
  });
});

describe("spawn and ground jump", () => {
  it("spawns airborne-neutral and grounds on the first grounded tick", () => {
    const sm = new PlayerStateMachine();
    expect(sm.state).toBe("airborne");
    expect(tick(sm, { grounded: true })).toEqual(NONE);
    expect(sm.state).toBe("grounded");
  });

  it("spawn drop-in opens no coyote window (press mid-fall is the double)", () => {
    const sm = new PlayerStateMachine();
    expect(tick(sm, { vy: FALLING_VY })).toEqual(NONE);
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(DOUBLE);
  });

  it("press while grounded emits exactly one first jump", () => {
    const sm = groundedMachine();
    expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
    expect(sm.state).toBe("airborne");
  });

  it("idle grounded ticks emit nothing", () => {
    const sm = groundedMachine();
    for (let i = 0; i < 5; i += 1) {
      expect(tick(sm, { grounded: true })).toEqual(NONE);
    }
    expect(sm.state).toBe("grounded");
  });

  it("returns one reused intents object (zero per-tick allocation)", () => {
    const sm = new PlayerStateMachine();
    const first = sm.step({
      grounded: true,
      jumpPressed: false,
      jumpHeld: false,
      vy: 0,
      dtMs: DT_MS,
    });
    const second = sm.step({
      grounded: true,
      jumpPressed: true,
      jumpHeld: true,
      vy: 0,
      dtMs: DT_MS,
    });
    expect(second).toBe(first);
    expect(second.jump).toBe(true);
  });
});

describe("jump-cut", () => {
  it("tap: release while rising cuts exactly once, then stays silent", () => {
    const sm = groundedMachine();
    expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
    expect(tick(sm, { vy: RISING_VY })).toEqual(CUT);
    expect(tick(sm, { vy: RISING_VY - 3 })).toEqual(NONE);
    expect(tick(sm, { vy: 2 })).toEqual(NONE);
  });

  it("hold through the apex: no cut, and a release while falling stays silent", () => {
    const sm = groundedMachine();
    expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
    expect(tick(sm, { vy: RISING_VY, jumpHeld: true })).toEqual(NONE);
    expect(tick(sm, { vy: 5, jumpHeld: true })).toEqual(NONE);
    expect(tick(sm, { vy: -1, jumpHeld: true })).toEqual(NONE);
    expect(tick(sm, { vy: FALLING_VY })).toEqual(NONE);
    expect(tick(sm, { vy: FALLING_VY })).toEqual(NONE);
  });

  it("release mid-rise after holding a while cuts once", () => {
    const sm = groundedMachine();
    expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
    expect(tick(sm, { vy: RISING_VY, jumpHeld: true })).toEqual(NONE);
    expect(tick(sm, { vy: 9, jumpHeld: true })).toEqual(NONE);
    expect(tick(sm, { vy: 7 })).toEqual(CUT);
    expect(tick(sm, { vy: 5 })).toEqual(NONE);
  });

  it("stale ground contact right after the jump neither re-grounds nor disarms the cut", () => {
    const sm = groundedMachine();
    expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
    expect(tick(sm, { grounded: true, vy: RISING_VY })).toEqual(CUT);
    expect(sm.state).toBe("airborne");
    expect(tick(sm, { grounded: true, vy: RISING_VY - 2 })).toEqual(NONE);
    expect(sm.state).toBe("airborne");
  });

  it("the double jump re-arms the cut — once per jump, twice total", () => {
    const sm = groundedMachine();
    expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
    expect(tick(sm, { vy: RISING_VY })).toEqual(CUT);
    expect(pressJump(sm, { vy: 1 })).toEqual(DOUBLE);
    expect(tick(sm, { vy: RISING_VY })).toEqual(CUT);
    expect(tick(sm, { vy: RISING_VY - 3 })).toEqual(NONE);
  });

  it("never cuts on a jump's emission tick; the cut lands on the next tick", () => {
    const sm = groundedMachine();
    expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
    expect(tick(sm, { vy: RISING_VY, jumpHeld: true })).toEqual(NONE);
    expect(tick(sm, { jumpPressed: true, vy: 8 })).toEqual(DOUBLE);
    expect(tick(sm, { vy: RISING_VY })).toEqual(CUT);
  });

  it("a buffered tap still gets its jump-cut after the landing jump", () => {
    const sm = spentDoubleFalling();
    expect(pressJump(sm, { vy: FALLING_VY, jumpHeld: false })).toEqual(NONE);
    expect(tick(sm, { grounded: true })).toEqual(JUMP);
    expect(tick(sm, { vy: RISING_VY })).toEqual(CUT);
  });
});

describe("coyote time", () => {
  it("press inside the window still emits the FIRST jump", () => {
    const sm = groundedMachine();
    walkOffAndWait(sm, INSIDE_COYOTE_TICKS);
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(JUMP);
    expect(sm.state).toBe("airborne");
  });

  it("a coyote jump keeps the double jump intact", () => {
    const sm = groundedMachine();
    walkOffAndWait(sm, INSIDE_COYOTE_TICKS);
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(JUMP);
    expect(tick(sm, { vy: RISING_VY, jumpHeld: true })).toEqual(NONE);
    expect(pressJump(sm, { vy: RISING_VY })).toEqual(DOUBLE);
  });

  it("press past the window is the double jump, not a free first jump", () => {
    const sm = groundedMachine();
    walkOffAndWait(sm, PAST_COYOTE_TICKS);
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(DOUBLE);
    expect(sm.state).toBe("doubleJumped");
  });

  it("jumping off the ground opens no coyote window", () => {
    const sm = groundedMachine();
    expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
    expect(tick(sm, { vy: RISING_VY, jumpHeld: true })).toEqual(NONE);
    expect(pressJump(sm, { vy: RISING_VY })).toEqual(DOUBLE);
  });

  it("re-landing inside the window re-arms a fresh window on the next walk-off", () => {
    const sm = groundedMachine();
    walkOffAndWait(sm, 2);
    expect(tick(sm, { grounded: true })).toEqual(NONE);
    expect(sm.state).toBe("grounded");
    walkOffAndWait(sm, INSIDE_COYOTE_TICKS);
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(JUMP);
  });

  it("the window is dtMs-driven, not tick-counted", () => {
    const fast = groundedMachine();
    walkOffAndWait(fast, 4);
    expect(pressJump(fast, { vy: FALLING_VY })).toEqual(JUMP);

    const slow = groundedMachine();
    tick(slow, { vy: -1, dtMs: 40 });
    for (let i = 0; i < 3; i += 1) {
      tick(slow, { vy: FALLING_VY, dtMs: 40 });
    }
    expect(pressJump(slow, { vy: FALLING_VY, dtMs: 40 })).toEqual(DOUBLE);
  });
});

describe("jump buffer", () => {
  it("press just before landing fires the ground jump on the landing tick", () => {
    const sm = spentDoubleFalling();
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(NONE);
    for (let i = 0; i < INSIDE_BUFFER_TICKS - 1; i += 1) {
      expect(tick(sm, { vy: FALLING_VY })).toEqual(NONE);
    }
    expect(tick(sm, { grounded: true })).toEqual(JUMP);
    expect(sm.state).toBe("airborne");
  });

  it("the buffered press expires after jumpBufferMs", () => {
    const sm = spentDoubleFalling();
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(NONE);
    for (let i = 0; i < PAST_BUFFER_TICKS - 1; i += 1) {
      expect(tick(sm, { vy: FALLING_VY })).toEqual(NONE);
    }
    expect(tick(sm, { grounded: true })).toEqual(NONE);
    expect(sm.state).toBe("grounded");
  });

  it("a buffered press fires only once", () => {
    const sm = spentDoubleFalling();
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(NONE);
    expect(tick(sm, { grounded: true })).toEqual(JUMP);
    expect(tick(sm, { vy: RISING_VY, jumpHeld: true })).toEqual(NONE);
    expect(tick(sm, { vy: FALLING_VY })).toEqual(NONE);
    expect(tick(sm, { grounded: true })).toEqual(NONE);
  });

  it("a press consumed by the double jump is NOT also buffered", () => {
    const sm = groundedMachine();
    expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
    expect(tick(sm, { vy: RISING_VY, jumpHeld: true })).toEqual(NONE);
    expect(pressJump(sm, { vy: 6 })).toEqual(DOUBLE);
    expect(tick(sm, { vy: FALLING_VY })).toEqual(NONE);
    expect(tick(sm, { vy: FALLING_VY })).toEqual(NONE);
    expect(tick(sm, { grounded: true })).toEqual(NONE);
    expect(sm.state).toBe("grounded");
  });

  it("a press on the landing tick itself jumps immediately (no buffer needed)", () => {
    const sm = spentDoubleFalling();
    expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
    expect(sm.state).toBe("airborne");
  });
});

describe("double jump", () => {
  it("fires only when airborne past coyote and not yet spent", () => {
    const sm = groundedMachine();
    walkOffAndWait(sm, PAST_COYOTE_TICKS);
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(DOUBLE);
    expect(sm.state).toBe("doubleJumped");
  });

  it("is spent for the rest of the airtime — a second press emits nothing", () => {
    const sm = spentDoubleFalling();
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(NONE);
    expect(sm.state).toBe("doubleJumped");
  });

  it("resets only on ground contact", () => {
    const sm = spentDoubleFalling();
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(NONE);
    for (let i = 0; i < PAST_BUFFER_TICKS - 1; i += 1) {
      expect(tick(sm, { vy: FALLING_VY })).toEqual(NONE);
    }
    expect(tick(sm, { grounded: true })).toEqual(NONE);
    expect(sm.state).toBe("grounded");
    expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
    expect(tick(sm, { vy: RISING_VY, jumpHeld: true })).toEqual(NONE);
    expect(pressJump(sm, { vy: RISING_VY })).toEqual(DOUBLE);
  });

  it("refreshDoubleJump restores it mid-air (bouncer hook)", () => {
    const sm = spentDoubleFalling();
    sm.refreshDoubleJump();
    expect(sm.state).toBe("airborne");
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(DOUBLE);
  });

  it("refreshDoubleJump is a no-op when grounded, airborne, or dead", () => {
    const sm = groundedMachine();
    sm.refreshDoubleJump();
    expect(sm.state).toBe("grounded");
    tick(sm, { vy: FALLING_VY });
    sm.refreshDoubleJump();
    expect(sm.state).toBe("airborne");
    sm.kill();
    sm.refreshDoubleJump();
    expect(sm.state).toBe("dead");
  });
});

describe("kill and reset", () => {
  it("kill() silences every intent, whatever the inputs", () => {
    const sm = groundedMachine();
    sm.kill();
    expect(sm.state).toBe("dead");
    expect(pressJump(sm, { grounded: true })).toEqual(NONE);
    expect(tick(sm, { vy: RISING_VY })).toEqual(NONE);
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(NONE);
    expect(sm.state).toBe("dead");
  });

  it("reset() restores a fresh, playable machine", () => {
    const sm = groundedMachine();
    sm.kill();
    sm.reset();
    expect(sm.state).toBe("airborne");
    expect(tick(sm, { grounded: true })).toEqual(NONE);
    expect(sm.state).toBe("grounded");
    expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
  });

  it("reset() clears a buffered press", () => {
    const sm = spentDoubleFalling();
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(NONE);
    sm.kill();
    sm.reset();
    expect(tick(sm, { grounded: true })).toEqual(NONE);
  });

  it("reset() disarms a pending jump-cut", () => {
    const sm = groundedMachine();
    expect(pressJump(sm, { grounded: true })).toEqual(JUMP);
    sm.reset();
    expect(tick(sm, { vy: RISING_VY })).toEqual(NONE);
  });

  it("reset() restores the double jump", () => {
    const sm = spentDoubleFalling();
    sm.kill();
    sm.reset();
    expect(pressJump(sm, { vy: FALLING_VY })).toEqual(DOUBLE);
  });
});

describe("state flow", () => {
  it("walks the full arc grounded → airborne → doubleJumped → grounded", () => {
    const sm = new PlayerStateMachine();
    tick(sm, { grounded: true });
    expect(sm.state).toBe("grounded");
    pressJump(sm, { grounded: true });
    expect(sm.state).toBe("airborne");
    tick(sm, { vy: RISING_VY, jumpHeld: true });
    pressJump(sm, { vy: RISING_VY });
    expect(sm.state).toBe("doubleJumped");
    tick(sm, { vy: FALLING_VY });
    tick(sm, { grounded: true });
    expect(sm.state).toBe("grounded");
  });
});

describe("notifyLaunch (bouncer, §1.6)", () => {
  it("a press on the stale-grounded tick after a launch double-jumps instead of ground-jumping", () => {
    const sm = new PlayerStateMachine();
    tick(sm, { grounded: true });
    sm.notifyLaunch();
    const intents = pressJump(sm, { grounded: true, vy: RISING_VY });
    expect(intents.jump).toBe(false);
    expect(intents.doubleJump).toBe(true);
  });

  it("releasing the jump key while rising from a launch never cuts it", () => {
    const sm = new PlayerStateMachine();
    tick(sm, { grounded: true });
    sm.notifyLaunch();
    for (let i = 0; i < 10; i += 1) {
      const intents = tick(sm, { jumpHeld: false, vy: RISING_VY });
      expect(intents.cut).toBe(false);
    }
  });

  it("does not open a coyote window: a press past the launch tick is the double, and a second press buffers", () => {
    const sm = new PlayerStateMachine();
    tick(sm, { grounded: true });
    sm.notifyLaunch();
    tick(sm, { vy: RISING_VY });
    const first = pressJump(sm, { vy: RISING_VY });
    expect(first.jump).toBe(false);
    expect(first.doubleJump).toBe(true);
    const second = pressJump(sm, { vy: RISING_VY });
    expect(second.jump).toBe(false);
    expect(second.doubleJump).toBe(false);
    const landed = tick(sm, { grounded: true, vy: FALLING_VY });
    expect(landed.jump).toBe(true);
  });

  it("consumes a pre-launch buffered press (the launch IS the jump it waited for)", () => {
    const sm = new PlayerStateMachine();
    tick(sm, { grounded: true });
    pressJump(sm);
    tick(sm, { vy: RISING_VY, jumpHeld: true });
    pressJump(sm, { vy: RISING_VY });
    pressJump(sm, { vy: FALLING_VY });
    sm.notifyLaunch();
    tick(sm, { vy: RISING_VY });
    const landed = tick(sm, { grounded: true, vy: FALLING_VY });
    expect(landed.jump).toBe(false);
  });

  it("never revives a dead machine", () => {
    const sm = new PlayerStateMachine();
    sm.kill();
    sm.notifyLaunch();
    expect(sm.state).toBe("dead");
  });
});
