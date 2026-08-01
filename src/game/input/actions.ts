export interface InputActions {
  moveX: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  rollPressed: boolean;
  attackPressed: boolean;
}

export const EMPTY_INPUT: InputActions = {
  moveX: 0,
  jumpPressed: false,
  jumpHeld: false,
  rollPressed: false,
  attackPressed: false,
};
