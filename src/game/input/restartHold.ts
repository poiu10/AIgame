export const FULL_RESET_HOLD_SECONDS = 3;

export type RestartInputAction = "none" | "restore-checkpoint" | "full-reset";

export class RestartHoldTracker {
  private wasDown = false;
  private heldSeconds = 0;
  private fullResetTriggered = false;

  update(isDown: boolean, elapsedSeconds: number): RestartInputAction {
    let action: RestartInputAction = "none";

    if (isDown && !this.wasDown) {
      this.heldSeconds = 0;
      this.fullResetTriggered = false;
      action = "restore-checkpoint";
    }

    if (isDown && !this.fullResetTriggered) {
      this.heldSeconds += Math.max(0, elapsedSeconds);
      if (this.heldSeconds >= FULL_RESET_HOLD_SECONDS) {
        this.fullResetTriggered = true;
        action = "full-reset";
      }
    } else if (!isDown) {
      this.heldSeconds = 0;
      this.fullResetTriggered = false;
    }

    this.wasDown = isDown;
    return action;
  }
}
