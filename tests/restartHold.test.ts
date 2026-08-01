import { describe, expect, it } from "vitest";
import {
  FULL_RESET_HOLD_SECONDS,
  RestartHoldTracker,
} from "../src/game/input/restartHold";

describe("R restart hold input", () => {
  it("restores the checkpoint on press and requests a full reset at three seconds", () => {
    const tracker = new RestartHoldTracker();

    expect(tracker.update(true, 0)).toBe("restore-checkpoint");
    expect(tracker.update(true, FULL_RESET_HOLD_SECONDS - 0.01)).toBe("none");
    expect(tracker.update(true, 0.01)).toBe("full-reset");
  });

  it("fires the full reset only once until R is released and pressed again", () => {
    const tracker = new RestartHoldTracker();

    tracker.update(true, FULL_RESET_HOLD_SECONDS);
    expect(tracker.update(true, FULL_RESET_HOLD_SECONDS)).toBe("none");
    expect(tracker.update(false, 0)).toBe("none");
    expect(tracker.update(true, 0)).toBe("restore-checkpoint");
    expect(tracker.update(true, FULL_RESET_HOLD_SECONDS)).toBe("full-reset");
  });
});
