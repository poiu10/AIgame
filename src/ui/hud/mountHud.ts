export function mountHud(container: HTMLDivElement | null): void {
  if (!container) {
    throw new Error("HUD 컨테이너를 찾을 수 없습니다.");
  }

  const panel = document.createElement("div");
  panel.className = "hud-panel";
  panel.textContent = "프로토타입 · 이동 테스트";
  container.replaceChildren(panel);
}
