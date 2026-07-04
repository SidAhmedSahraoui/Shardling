import { tuning } from "../../config/tuning";

export type PlayerState = "grounded" | "airborne" | "doubleJumped" | "dead";

export interface StateMachineStep {
  grounded: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  vy: number;
  dtMs: number;
}

export interface JumpIntents {
  jump: boolean;
  doubleJump: boolean;
  cut: boolean;
}

export class PlayerStateMachine {
  private current: PlayerState = "airborne";
  private coyoteMsLeft = 0;
  private bufferMsLeft = 0;
  private cutArmed = false;
  private risingFromJump = false;

  private readonly intents: JumpIntents = {
    jump: false,
    doubleJump: false,
    cut: false,
  };

  get state(): PlayerState {
    return this.current;
  }

  step(input: StateMachineStep): JumpIntents {
    const intents = this.intents;
    intents.jump = false;
    intents.doubleJump = false;
    intents.cut = false;

    if (this.current === "dead") {
      return intents;
    }

    if (this.coyoteMsLeft > 0) {
      this.coyoteMsLeft = Math.max(0, this.coyoteMsLeft - input.dtMs);
    }
    if (this.bufferMsLeft > 0) {
      this.bufferMsLeft = Math.max(0, this.bufferMsLeft - input.dtMs);
    }

    const grounded = input.grounded && !(this.risingFromJump && input.vy > 0);

    if (grounded) {
      this.current = "grounded";
      this.risingFromJump = false;
      this.cutArmed = false;
      this.coyoteMsLeft = 0;

      if (this.bufferMsLeft > 0 || input.jumpPressed) {
        this.bufferMsLeft = 0;
        this.emitJump(intents, false);
      }
      return intents;
    }

    if (this.current === "grounded") {
      this.current = "airborne";
      this.coyoteMsLeft = tuning.coyoteMs;
    }

    let jumpedThisTick = false;
    if (input.jumpPressed) {
      if (this.coyoteMsLeft > 0) {
        this.coyoteMsLeft = 0;
        this.emitJump(intents, false);
        jumpedThisTick = true;
      } else if (this.current === "airborne") {
        this.emitJump(intents, true);
        jumpedThisTick = true;
      } else {
        this.bufferMsLeft = tuning.jumpBufferMs;
      }
    }

    if (!jumpedThisTick && this.cutArmed) {
      if (input.vy < 0) {
        this.cutArmed = false;
      } else if (!input.jumpHeld && input.vy > 0) {
        intents.cut = true;
        this.cutArmed = false;
      }
    }

    return intents;
  }

  refreshDoubleJump(): void {
    if (this.current === "doubleJumped") {
      this.current = "airborne";
    }
  }

  notifyLaunch(): void {
    if (this.current === "dead") {
      return;
    }
    this.current = "airborne";
    this.risingFromJump = true;
    this.cutArmed = false;
    this.coyoteMsLeft = 0;
    this.bufferMsLeft = 0;
  }

  kill(): void {
    this.current = "dead";
  }

  reset(): void {
    this.current = "airborne";
    this.coyoteMsLeft = 0;
    this.bufferMsLeft = 0;
    this.cutArmed = false;
    this.risingFromJump = false;
  }

  private emitJump(intents: JumpIntents, double: boolean): void {
    if (double) {
      intents.doubleJump = true;
      this.current = "doubleJumped";
    } else {
      intents.jump = true;
      this.current = "airborne";
    }
    this.cutArmed = true;
    this.risingFromJump = true;
  }
}
