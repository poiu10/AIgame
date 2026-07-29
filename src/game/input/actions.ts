export interface InputActions {
  moveX: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  rollPressed: boolean;
  attackPressed: boolean;
  restartPressed: boolean;
  debugPulsePressed: boolean;
  toggleDebugPressed: boolean;
}

export const EMPTY_INPUT: InputActions = {
  moveX: 0,
  jumpPressed: false,
  jumpHeld: false,
  rollPressed: false,
  attackPressed: false,
  restartPressed: false,
  debugPulsePressed: false,
  toggleDebugPressed: false,
};
