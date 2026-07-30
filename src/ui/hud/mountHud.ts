export const GAME_HUD_EVENT = "aigame:hud";

export interface HudState {
  health: number;
  maxHealth: number;
  debugVisible: boolean;
}

const FILLED_HEALTH_PATTERN = [
  "00100",
  "01110",
  "11111",
  "01110",
  "00100",
] as const;

const EMPTY_HEALTH_PATTERN = [
  "00100",
  "01010",
  "10001",
  "01010",
  "00100",
] as const;

function createHealthPip(filled: boolean): HTMLSpanElement {
  const pip = document.createElement("span");
  pip.className = `hud-health-pip${filled ? " is-filled" : ""}`;
  pip.setAttribute("aria-hidden", "true");
  const pattern = filled ? FILLED_HEALTH_PATTERN : EMPTY_HEALTH_PATTERN;
  for (const row of pattern) {
    for (const cell of row) {
      const pixel = document.createElement("i");
      pixel.className = cell === "1" ? "is-on" : "";
      pip.append(pixel);
    }
  }
  return pip;
}

export function mountHud(container: HTMLDivElement | null): void {
  if (!container) {
    throw new Error("HUD 컨테이너를 찾을 수 없습니다.");
  }

  const panel = document.createElement("section");
  panel.className = "hud-panel";
  panel.innerHTML = `
    <div class="hud-stats">
      <span class="hud-health" aria-label="체력"></span>
    </div>
    <div class="hud-debug">개발 도구 · P 강제 음파 · F3 충돌체 · R 리셋</div>
  `;
  container.replaceChildren(panel);

  const health = panel.querySelector<HTMLElement>(".hud-health");
  const debug = panel.querySelector<HTMLElement>(".hud-debug");

  window.addEventListener(GAME_HUD_EVENT, (rawEvent) => {
    const event = rawEvent as CustomEvent<HudState>;
    const state = event.detail;
    if (!health || !debug) {
      return;
    }

    health.setAttribute("aria-label", `체력 ${state.health} / ${state.maxHealth}`);
    health.replaceChildren(
      ...Array.from({ length: state.maxHealth }, (_, index) =>
        createHealthPip(index < state.health),
      ),
    );
    debug.classList.toggle("is-active", state.debugVisible);
  });
}
