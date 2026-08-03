export const GAME_HUD_EVENT = "aigame:hud";

export interface HudState {
  health: number;
  maxHealth: number;
  boss: {
    health: number;
    maxHealth: number;
    phase: number;
  } | null;
}

export function mountHud(container: HTMLDivElement | null): void {
  if (!container) {
    throw new Error("HUD 컨테이너를 찾을 수 없습니다.");
  }

  const panel = document.createElement("section");
  panel.className = "hud-panel";
  panel.innerHTML = `
    <div class="hud-stats">
      <span class="hud-health" role="img" aria-label="체력"></span>
    </div>
    <div class="hud-boss" role="img" aria-label="보스 체력" hidden>
      <span class="hud-boss-track" aria-hidden="true">
        <span class="hud-boss-fill"></span>
      </span>
    </div>
  `;
  container.replaceChildren(panel);

  const health = panel.querySelector<HTMLElement>(".hud-health");
  const boss = panel.querySelector<HTMLElement>(".hud-boss");
  const bossFill = panel.querySelector<HTMLElement>(".hud-boss-fill");

  window.addEventListener(GAME_HUD_EVENT, (rawEvent) => {
    const event = rawEvent as CustomEvent<HudState>;
    const state = event.detail;
    if (!health) {
      return;
    }

    const maxHealth = Math.max(0, Math.floor(state.maxHealth));
    const currentHealth = Math.min(maxHealth, Math.max(0, Math.floor(state.health)));
    const cells = Array.from({ length: maxHealth }, (_, index) => {
      const cell = document.createElement("span");
      cell.className = "hud-health-cell";
      cell.classList.toggle("is-active", index < currentHealth);
      cell.setAttribute("aria-hidden", "true");
      return cell;
    });

    health.setAttribute("aria-label", `체력 ${currentHealth}/${maxHealth}`);
    health.replaceChildren(...cells);

    if (!boss || !bossFill) return;
    if (!state.boss) {
      boss.hidden = true;
      return;
    }
    const bossMaxHealth = Math.max(1, Math.floor(state.boss.maxHealth));
    const bossHealth = Math.min(
      bossMaxHealth,
      Math.max(0, Math.floor(state.boss.health)),
    );
    boss.hidden = false;
    bossFill.style.width = `${(bossHealth / bossMaxHealth) * 100}%`;
    boss.setAttribute(
      "aria-label",
      `보스 ${state.boss.phase}페이즈 체력 ${bossHealth}/${bossMaxHealth}`,
    );
  });
}
