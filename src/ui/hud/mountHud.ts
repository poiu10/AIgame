import type { SessionStatus } from "../../game/simulation/state";

export const GAME_HUD_EVENT = "aigame:hud";

export interface HudState {
  health: number;
  maxHealth: number;
  remainingEnemies: number;
  status: SessionStatus;
  debugVisible: boolean;
}

export function mountHud(container: HTMLDivElement | null): void {
  if (!container) {
    throw new Error("HUD 컨테이너를 찾을 수 없습니다.");
  }

  const panel = document.createElement("section");
  panel.className = "hud-panel";
  panel.innerHTML = `
    <div class="hud-brand">ECHOBOUND <span>감각 실험실</span></div>
    <div class="hud-stats">
      <span class="hud-health" aria-label="체력"></span>
      <span class="hud-enemies"></span>
    </div>
    <div class="hud-message"></div>
    <div class="hud-controls">
      <span>A/D 이동</span><span>Space 점프</span><span>Shift 구르기</span>
      <span>J 공격</span><span>R 재시작</span>
    </div>
    <div class="hud-debug">개발 도구 · P 강제 음파 · F3 충돌체</div>
  `;
  container.replaceChildren(panel);

  const health = panel.querySelector<HTMLElement>(".hud-health");
  const enemies = panel.querySelector<HTMLElement>(".hud-enemies");
  const message = panel.querySelector<HTMLElement>(".hud-message");
  const debug = panel.querySelector<HTMLElement>(".hud-debug");

  window.addEventListener(GAME_HUD_EVENT, (rawEvent) => {
    const event = rawEvent as CustomEvent<HudState>;
    const state = event.detail;
    if (!health || !enemies || !message || !debug) {
      return;
    }

    health.textContent = `${"◆".repeat(state.health)}${"◇".repeat(
      state.maxHealth - state.health,
    )}`;
    enemies.textContent = `남은 적 ${state.remainingEnemies}`;
    debug.classList.toggle("is-active", state.debugVisible);

    if (state.status === "completed") {
      message.textContent = "모든 메아리가 멎었다 · R로 다시 시작";
      message.className = "hud-message is-complete";
    } else if (state.status === "failed") {
      message.textContent = "어둠에 쓰러졌다 · R로 다시 시작";
      message.className = "hud-message is-failed";
    } else {
      message.textContent = "소리가 그리는 윤곽을 따라 적을 처치하라";
      message.className = "hud-message";
    }
  });
}
